//go:build unix

package search

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// TestMain doubles as a stand-in daemon: it holds socket.lock and records
// its pid there, as `fsearch serve` does.
func TestMain(m *testing.M) {
	if dir := os.Getenv("SIFT_FAKE_DAEMON"); dir != "" {
		f, err := os.OpenFile(filepath.Join(dir, "socket.lock"), os.O_WRONLY|os.O_CREATE, 0o644)
		if err != nil || syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
			os.Exit(2)
		}
		fmt.Fprint(f, os.Getpid())
		time.Sleep(time.Minute)
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestStopDaemonAt(t *testing.T) {
	dir := t.TempDir()
	if err := stopDaemonAt(dir); err != nil {
		t.Fatalf("no daemon: %v", err)
	}
	cmd := exec.Command(os.Args[0])
	cmd.Env = append(os.Environ(), "SIFT_FAKE_DAEMON="+dir)
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	for start := time.Now(); ; time.Sleep(20 * time.Millisecond) {
		if b, _ := os.ReadFile(filepath.Join(dir, "socket.lock")); len(b) > 0 {
			break
		}
		if time.Since(start) > 5*time.Second {
			t.Fatal("fake daemon did not start")
		}
	}
	if err := stopDaemonAt(dir); err != nil {
		t.Fatal(err)
	}
	select {
	case <-exited:
	case <-time.After(2 * time.Second):
		t.Fatal("daemon still running")
	}
}
