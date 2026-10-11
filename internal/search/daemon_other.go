//go:build !unix

package search

func startDaemon(string) error { return ErrNoFsearch }

// StopDaemons has nothing to stop where fsearch cannot run.
func StopDaemons() {}
