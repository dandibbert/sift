//go:build unix

package search

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

var (
	spawnedMu sync.Mutex
	spawned   []*os.Process
)

// startDaemon runs `fsearch serve` in its own session, so that a crash of
// the search window does not take the index with it. StopDaemons ends it
// when Sift quits.
func startDaemon(bin string) error {
	cmd := exec.Command(bin, "serve")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	spawnedMu.Lock()
	spawned = append(spawned, cmd.Process)
	spawnedMu.Unlock()
	go func() {
		cmd.Wait()
		spawnedMu.Lock()
		defer spawnedMu.Unlock()
		for i, p := range spawned {
			if p == cmd.Process {
				spawned = append(spawned[:i], spawned[i+1:]...)
				break
			}
		}
	}()
	return nil
}

// stopDaemonAt stops the daemon serving the socket in dir, whoever started
// it, and waits until it has let go of its lock, as `fsearch stop` does.
func stopDaemonAt(dir string) error {
	f, err := os.Open(filepath.Join(dir, "socket.lock"))
	if err != nil {
		return nil
	}
	defer f.Close()
	fd := int(f.Fd())
	signaled := false
	for range 50 {
		if syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB) == nil {
			syscall.Flock(fd, syscall.LOCK_UN)
			return nil
		}
		if !signaled {
			signaled = true
			b, _ := os.ReadFile(f.Name())
			if pid, err := strconv.Atoi(strings.TrimSpace(string(b))); err == nil && pid > 1 {
				syscall.Kill(pid, syscall.SIGTERM)
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return errors.New("fsearch 守护进程没有退出")
}

// HasFullDiskAccess reports whether this process may read protected
// folders. The system TCC database is readable only with Full Disk Access,
// which is also how fsearch checks for itself.
func HasFullDiskAccess() bool {
	f, err := os.Open("/Library/Application Support/com.apple.TCC/TCC.db")
	if err != nil {
		return false
	}
	f.Close()
	return true
}

// StopDaemons asks the fsearch daemons this process started to exit. A
// daemon that was already running, such as one installed as a login item,
// is left alone.
func StopDaemons() {
	spawnedMu.Lock()
	defer spawnedMu.Unlock()
	for _, p := range spawned {
		p.Signal(syscall.SIGTERM)
	}
	spawned = nil
}
