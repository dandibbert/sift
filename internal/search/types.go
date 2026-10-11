// Package search runs queries against fsearch, or against a small built-in
// index when fsearch is not installed.
package search

import (
	"context"
	"path/filepath"
)

// Mode picks what a query looks at.
type Mode string

const (
	ModeName    Mode = "name"
	ModeContent Mode = "content"
)

// Filters are the chips of the search bar. Each maps onto an fsearch
// filter of the same name.
type Filters struct {
	// Type is one of image, video, audio, doc, code, archive, app.
	Type string `json:"type,omitempty"`
	// Kind is file or dir.
	Kind string `json:"kind,omitempty"`
	// Modified is an fsearch age range such as "<1d" or "<30d".
	Modified string `json:"modified,omitempty"`
	// Size is an fsearch size range such as ">100mb".
	Size string `json:"size,omitempty"`
	// In limits results to a folder.
	In string `json:"in,omitempty"`
}

// Request is one query from the search window.
type Request struct {
	Query   string  `json:"query"`
	Mode    Mode    `json:"mode"`
	Filters Filters `json:"filters"`
	Limit   int     `json:"limit"`
}

// LineMatch is one matching line of a content search.
type LineMatch struct {
	Line int    `json:"line"`
	Text string `json:"text"`
}

// Hit is one result.
type Hit struct {
	Path    string      `json:"path"`
	Name    string      `json:"name"`
	Dir     string      `json:"dir"`
	Kind    string      `json:"kind"`
	Size    int64       `json:"size"`
	Mtime   int64       `json:"mtime"`
	Score   int         `json:"score"`
	Matches []LineMatch `json:"matches,omitempty"`
}

// Result answers a Request.
type Result struct {
	Hits   []Hit  `json:"hits"`
	TookUs int64  `json:"tookUs"`
	Engine string `json:"engine"`
	Mode   Mode   `json:"mode"`
	// Partial is set when a content search ran out of its time budget or
	// the content index is still being built.
	Partial bool `json:"partial"`
}

// Status describes the engine behind the search window.
type Status struct {
	// Engine is "fsearch" or "builtin".
	Engine         string `json:"engine"`
	Ready          bool   `json:"ready"`
	Entries        int    `json:"entries"`
	FullDiskAccess bool   `json:"fullDiskAccess"`
	// Message explains a degraded state: indexing, fsearch missing, ...
	Message string `json:"message"`
	// Home is shown as ~ in paths.
	Home string `json:"home"`
}

// Engine answers queries.
type Engine interface {
	Search(ctx context.Context, req Request) (Result, error)
	Status(ctx context.Context) Status
	Close() error
}

func newHit(path, kind string, size, mtime int64, score int) Hit {
	return Hit{
		Path:  path,
		Name:  filepath.Base(path),
		Dir:   filepath.Dir(path),
		Kind:  kind,
		Size:  size,
		Mtime: mtime,
		Score: score,
	}
}
