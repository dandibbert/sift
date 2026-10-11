//go:build !unix

package search

func startDaemon(string) error { return ErrNoFsearch }

func stopDaemonAt(string) error { return ErrNoFsearch }

// HasFullDiskAccess is a macOS notion.
func HasFullDiskAccess() bool { return false }

// StopDaemons has nothing to stop where fsearch cannot run.
func StopDaemons() {}
