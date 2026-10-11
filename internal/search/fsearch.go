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
	"regexp"
	"runtime"
	"strconv"
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

// FindBinary looks for fsearch next to the Sift executable, where the app
// bundle carries it, then where `fsearch install` and package managers put
// it.
func FindBinary() string {
	if b := os.Getenv("SIFT_FSEARCH_BIN"); b != "" {
		return b
	}
	if exe, err := os.Executable(); err == nil {
		if exe, err = filepath.EvalSymlinks(exe); err == nil {
			p := filepath.Join(filepath.Dir(exe), "fsearch")
			if st, err := os.Stat(p); err == nil && !st.IsDir() && p != exe {
				return p
			}
		}
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
		return decodeAnswer(resp, out)
	}
	return err
}

// once sends one request on a connection of its own and half-closes it.
// The daemon spins a core for a moment after answering a client that stays
// connected, betting on a next keystroke; that is worth it for queries but
// not for status checks.
func (f *Fsearch) once(ctx context.Context, req map[string]any, out any) error {
	var d net.Dialer
	c, err := d.DialContext(ctx, "unix", f.socket)
	if err != nil {
		return err
	}
	defer c.Close()
	if dl, ok := ctx.Deadline(); ok {
		c.SetDeadline(dl)
	} else {
		c.SetDeadline(time.Now().Add(5 * time.Second))
	}
	line, err := json.Marshal(req)
	if err != nil {
		return err
	}
	if _, err := c.Write(append(line, '\n')); err != nil {
		return err
	}
	if uc, ok := c.(*net.UnixConn); ok {
		uc.CloseWrite()
	}
	resp, err := bufio.NewReader(c).ReadBytes('\n')
	if err != nil {
		return err
	}
	return decodeAnswer(resp, out)
}

func decodeAnswer(resp []byte, out any) error {
	var head struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(resp, &head); err != nil {
		return err
	}
	if !head.OK {
		return errors.New(head.Error)
	}
	return json.Unmarshal(resp, out)
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
		if n, ok := indexingProgress(err); ok {
			return Result{Engine: "fsearch", Mode: mode, Hits: []Hit{}, Indexing: true, Notice: indexingNotice(n)}, nil
		}
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
	st, _ := f.status(ctx)
	return st
}

// status also returns the error that left the daemon unreachable, if any.
func (f *Fsearch) status(ctx context.Context) (Status, error) {
	var s struct {
		Entries        int  `json:"entries"`
		FullDiskAccess bool `json:"full_disk_access"`
		ContentPending int  `json:"content_pending"`
	}
	st := Status{Engine: "fsearch"}
	if err := f.once(ctx, map[string]any{"op": "status"}, &s); err != nil {
		if n, ok := indexingProgress(err); ok {
			st.Entries, st.FullDiskAccess, st.Message = n, true, indexingNotice(n)
			return st, nil
		}
		st.Message = err.Error()
		return st, err
	}
	st.Ready, st.Entries, st.FullDiskAccess = true, s.Entries, s.FullDiskAccess
	if !s.FullDiskAccess {
		st.Message = "Sift 没有完全磁盘访问权限，“邮件”“信息”等受保护的文件夹不会被搜索"
	} else if s.ContentPending > 0 {
		st.Message = fmt.Sprintf("内容索引中，剩余 %d 个文件", s.ContentPending)
	}
	return st, nil
}

var indexingRe = regexp.MustCompile(`^indexing: ([0-9.]+)M entries`)

// indexingProgress recognizes the answer fsearch gives to every query
// while its first index builds, and returns how many entries it has listed.
func indexingProgress(err error) (int, bool) {
	m := indexingRe.FindStringSubmatch(err.Error())
	if m == nil {
		return 0, false
	}
	millions, _ := strconv.ParseFloat(m[1], 64)
	return int(millions * 1e6), true
}

func indexingNotice(entries int) string {
	if entries < 50_000 {
		return "正在建立索引，第一次启动需要半分钟左右"
	}
	return fmt.Sprintf("正在建立索引，已扫描 %.1f 万项，第一次启动需要半分钟左右", float64(entries)/1e4)
}

// Restart stops the daemon and starts a fresh one, which reads macOS
// permissions again: fsearch checks for Full Disk Access only when it
// starts. With rebuild, the saved index is dropped first: a daemon that
// loads an index lacking the protected folders adds them one event at a
// time, which takes far longer than a new parallel scan of the disk.
func (f *Fsearch) Restart(ctx context.Context, rebuild bool) error {
	if f.bin == "" {
		return ErrNoFsearch
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.drop()
	dir := filepath.Dir(f.socket)
	if err := stopDaemonAt(dir); err != nil {
		return err
	}
	if rebuild {
		for _, name := range []string{"index.bin", "skipped"} {
			if err := os.Remove(filepath.Join(dir, name)); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
	}
	return f.connect(ctx)
}

func (f *Fsearch) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.drop()
	return nil
}
