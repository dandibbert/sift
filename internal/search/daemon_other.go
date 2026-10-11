//go:build !unix

package search

func startDaemon(string) error { return ErrNoFsearch }
