//go:build unix

package search

import (
	"os/exec"
	"syscall"
)

// startDaemon runs `fsearch serve` in its own session, so that it outlives
// the search window like the daemon `fsearch` itself starts.
func startDaemon(bin string) error {
	cmd := exec.Command(bin, "serve")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}
