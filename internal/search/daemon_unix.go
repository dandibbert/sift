//go:build unix

package search

import (
	"os"
	"os/exec"
	"sync"
	"syscall"
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
