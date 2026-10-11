package search

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ErrNoFsearch means neither a running daemon nor an fsearch binary was
// found.
var ErrNoFsearch = errors.New("fsearch is not installed")

// DefaultSocket is where fsearch's daemon listens.
func DefaultSocket() string {
	if s := os.Getenv("SIFT_FSEARCH_SOCKET"); s != "" {
		return s
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Application Support", "FSearch", "fsearch.sock")
}

// FindBinary looks for the fsearch CLI where `fsearch install` and package
// managers put it.
func FindBinary() string {
	if b := os.Getenv("SIFT_FSEARCH_BIN"); b != "" {
		return b
	}
	if p, err := exec.LookPath("fsearch"); err == nil {
		return p
	}
	home, _ := os.UserHomeDir()
	for _, p := range []string{
		filepath.Join(home, ".local", "bin", "fsearch"),
		"/opt/homebrew/bin/fsearch",
		"/usr/local/bin/fsearch",
	} {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

// Fsearch talks JSON lines to the fsearch daemon over one long-lived
// connection, which keeps the daemon's cores warm between keystrokes.
type Fsearch struct {
	socket string
	bin    string

	mu   sync.Mutex
	conn net.Conn
	r    *bufio.Reader
	seq  int
}

// NewFsearch connects to the daemon, starting it with `fsearch serve` when
// the socket is not there yet.
func NewFsearch(ctx context.Context, socket string) (*Fsearch, error) {
	f := &Fsearch{socket: socket, bin: FindBinary()}
	if err := f.connect(ctx); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *Fsearch) connect(ctx context.Context) error {
	if f.conn != nil {
		return nil
	}
	dial := func() error {
		var d net.Dialer
		c, err := d.DialContext(ctx, "unix", f.socket)
		if err != nil {
			return err
		}
		f.conn, f.r = c, bufio.NewReaderSize(c, 1<<20)
		return nil
	}
	if dial() == nil {
		return nil
	}
	if f.bin == "" || runtime.GOOS != "darwin" {
		return ErrNoFsearch
	}
	if err := startDaemon(f.bin); err != nil {
		return fmt.Errorf("start fsearch: %w", err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if dial() == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}
	return errors.New("fsearch daemon did not come up")
}

func (f *Fsearch) drop() {
	if f.conn != nil {
		f.conn.Close()
	}
	f.conn, f.r = nil, nil
}

// call sends one request and reads its answer, reconnecting once if the
// daemon restarted in between.
func (f *Fsearch) call(ctx context.Context, req map[string]any, out any) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		if err = f.connect(ctx); err != nil {
			return err
		}
		f.seq++
		req["id"] = f.seq
		var line []byte
		line, err = json.Marshal(req)
		if err != nil {
			return err
		}
		if dl, ok := ctx.Deadline(); ok {
			f.conn.SetDeadline(dl)
		} else {
			f.conn.SetDeadline(time.Now().Add(10 * time.Second))
		}
		if _, err = f.conn.Write(append(line, '\n')); err != nil {
			f.drop()
			continue
		}
		var resp []byte
		resp, err = f.r.ReadBytes('\n')
		if err != nil {
			f.drop()
			continue
		}
		var head struct {
			OK    bool   `json:"ok"`
			Error string `json:"error"`
		}
		if err = json.Unmarshal(resp, &head); err != nil {
			return err
		}
		if !head.OK {
			return errors.New(head.Error)
		}
		return json.Unmarshal(resp, out)
	}
	return err
}

type fsHit struct {
	Kind  string `json:"kind"`
	Mtime int64  `json:"mtime"`
	Path  string `json:"path"`
	Score int    `json:"score"`
	Size  int64  `json:"size"`
}

type fsFile struct {
	Path    string      `json:"path"`
	Matches []LineMatch `json:"matches"`
}

type fsAnswer struct {
	Hits     []fsHit  `json:"hits"`
	Files    []fsFile `json:"files"`
	TookUs   int64    `json:"took_us"`
	Complete *bool    `json:"complete"`
	Indexing int      `json:"indexing"`
}

func (f *Fsearch) Search(ctx context.Context, req Request) (Result, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 60
	}
	msg := map[string]any{"limit": limit}
	addFilters(msg, req.Filters)
	mode := req.Mode
	if mode == ModeContent {
		filters, pattern := splitContent(req.Query)
		if strings.TrimSpace(pattern) == "" {
			return Result{Engine: "fsearch", Mode: mode, Hits: []Hit{}}, nil
		}
		msg["op"], msg["q"], msg["pattern"] = "grep", filters, pattern
		msg["per_file"], msg["budget_ms"] = 3, 1500
	} else {
		msg["q"] = req.Query
		if isContentQuery(req.Query) {
			mode = ModeContent
			msg["per_file"], msg["budget_ms"] = 3, 1500
		}
	}
	var a fsAnswer
	if err := f.call(ctx, msg, &a); err != nil {
		return Result{}, err
	}
	res := Result{Engine: "fsearch", Mode: mode, TookUs: a.TookUs, Hits: make([]Hit, 0, len(a.Hits)+len(a.Files))}
	for _, h := range a.Hits {
		res.Hits = append(res.Hits, newHit(h.Path, h.Kind, h.Size, h.Mtime, h.Score))
	}
	for i, file := range a.Files {
		if i >= limit {
			break
		}
		h := newHit(file.Path, "file", 0, 0, 0)
		if st, err := os.Stat(file.Path); err == nil {
			h.Size, h.Mtime = st.Size(), st.ModTime().Unix()
		}
		h.Matches = file.Matches
		res.Hits = append(res.Hits, h)
	}
	if a.Complete != nil && !*a.Complete || a.Indexing > 0 {
		res.Partial = true
	}
	return res, nil
}

func addFilters(msg map[string]any, f Filters) {
	if f.Type != "" {
		msg["type"] = f.Type
	}
	if f.Kind != "" {
		msg["kind"] = f.Kind
	}
	if f.Modified != "" {
		msg["mtime"] = f.Modified
	}
	if f.Size != "" {
		msg["size"] = f.Size
	}
	if f.In != "" {
		msg["in"] = f.In
	}
}

func (f *Fsearch) Status(ctx context.Context) Status {
	var s struct {
		Entries        int  `json:"entries"`
		FullDiskAccess bool `json:"full_disk_access"`
		ContentPending int  `json:"content_pending"`
	}
	st := Status{Engine: "fsearch"}
	if err := f.call(ctx, map[string]any{"op": "status"}, &s); err != nil {
		st.Message = err.Error()
		return st
	}
	st.Ready, st.Entries, st.FullDiskAccess = true, s.Entries, s.FullDiskAccess
	if !s.FullDiskAccess {
		st.Message = "fsearch 没有完全磁盘访问权限，受保护的文件夹不会被索引"
	} else if s.ContentPending > 0 {
		st.Message = fmt.Sprintf("内容索引中，剩余 %d 个文件", s.ContentPending)
	}
	return st
}

func (f *Fsearch) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.drop()
	return nil
}
