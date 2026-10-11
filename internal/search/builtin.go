package search

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"
)

// skipDirs are never walked: caches, VCS internals and dependency trees
// that would drown real results.
var skipDirs = map[string]bool{
	".git": true, "node_modules": true, ".cache": true, ".Trash": true,
	".npm": true, ".bun": true, ".cargo": true, ".rustup": true, "go": true,
	".venv": true, "venv": true, "__pycache__": true, ".gradle": true,
	"Library": true, ".local": true, ".mygo": true, "build": true, "dist": true,
	"DerivedData": true, ".Spotlight-V100": true, ".fseventsd": true,
	"proc": true, "sys": true, "snap": true,
}

const maxEntries = 2_000_000

type entry struct {
	path  string
	lower string // lowercased base name
	dir   bool
	size  int64
	mtime int64
}

// Builtin is a fallback index: one walk of the roots, refreshed in the
// background. It speaks the same query language as fsearch, but it is
// nowhere near as fast on a whole disk.
type Builtin struct {
	roots []string
	home  string

	mu      sync.RWMutex
	entries []entry
	ready   atomic.Bool
	walked  atomic.Int64
	stop    chan struct{}
}

// NewBuiltin starts indexing roots in the background.
func NewBuiltin(roots ...string) *Builtin {
	home, _ := os.UserHomeDir()
	if len(roots) == 0 {
		roots = []string{home}
	}
	b := &Builtin{roots: roots, home: home, stop: make(chan struct{})}
	go b.loop()
	return b
}

func (b *Builtin) loop() {
	b.rebuild()
	t := time.NewTicker(3 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-b.stop:
			return
		case <-t.C:
			b.rebuild()
		}
	}
}

func (b *Builtin) rebuild() {
	var out []entry
	b.walked.Store(0)
	for _, root := range b.roots {
		filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				if d != nil && d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if len(out) >= maxEntries {
				return fs.SkipAll
			}
			name := d.Name()
			if d.IsDir() && p != root && (skipDirs[name] || strings.HasPrefix(name, ".")) {
				return fs.SkipDir
			}
			if p == root {
				return nil
			}
			e := entry{path: p, lower: strings.ToLower(name), dir: d.IsDir()}
			if info, err := d.Info(); err == nil {
				e.size, e.mtime = info.Size(), info.ModTime().Unix()
			}
			if e.dir {
				e.size = 0
			}
			out = append(out, e)
			if n := b.walked.Add(1); n%5000 == 0 && !b.ready.Load() {
				b.mu.Lock()
				b.entries = append([]entry(nil), out...)
				b.mu.Unlock()
			}
			return nil
		})
	}
	b.mu.Lock()
	b.entries = out
	b.mu.Unlock()
	b.ready.Store(true)
}

type compiled struct {
	words   []word
	exts    map[string]bool
	kind    string
	scope   string
	sizeLo  int64
	sizeHi  int64
	ageLo   int64
	ageHi   int64
	nameRe  *regexp.Regexp
	pathRe  *regexp.Regexp
	limit   int
	grep    string
	grepRe  *regexp.Regexp
	content bool
}

func (b *Builtin) compile(req Request) (*compiled, error) {
	c := &compiled{sizeHi: math.MaxInt64, ageHi: math.MaxInt64, limit: req.Limit}
	if c.limit <= 0 {
		c.limit = 60
	}
	q := req.Query
	if req.Mode == ModeContent {
		filters, pattern := splitContent(q)
		q = filters
		c.grep, c.content = pattern, true
		if strings.TrimSpace(pattern) == "" {
			return c, nil
		}
	}
	apply := func(k, v string) error {
		switch k {
		case "ext":
			if c.exts == nil {
				c.exts = map[string]bool{}
			}
			for _, e := range strings.Split(v, ",") {
				c.exts[strings.ToLower(strings.TrimPrefix(e, "."))] = true
			}
		case "type":
			if c.exts == nil {
				c.exts = map[string]bool{}
			}
			for _, t := range strings.Split(v, ",") {
				if t == "app" {
					c.exts["app"] = true
					continue
				}
				exts, ok := typeExts[t]
				if !ok {
					return fmt.Errorf("unknown type %s", t)
				}
				for _, e := range exts {
					c.exts[e] = true
				}
			}
		case "kind":
			switch v {
			case "file", "f":
				c.kind = "file"
			case "dir", "folder", "d":
				c.kind = "dir"
			default:
				return fmt.Errorf("unknown kind %s", v)
			}
		case "in":
			if r, ok := strings.CutPrefix(v, "~"); ok {
				v = b.home + r
			}
			c.scope = strings.TrimSuffix(v, "/")
		case "size":
			lo, hi, err := parseRange(v, parseSize)
			if err != nil {
				return err
			}
			c.sizeLo, c.sizeHi = lo, hi
		case "mtime", "modified":
			lo, hi, err := parseRange(v, parseAge)
			if err != nil {
				return err
			}
			c.ageLo, c.ageHi = lo, hi
		case "re":
			re, err := regexp.Compile("(?i)" + v)
			if err != nil {
				return err
			}
			c.nameRe = re
		case "path":
			re, err := regexp.Compile("(?i)" + v)
			if err != nil {
				return err
			}
			c.pathRe = re
		case "limit":
			n, err := strconv.Atoi(v)
			if err != nil {
				return errors.New("bad limit")
			}
			c.limit = n
		case "grep", "content", "sym", "symbol":
			c.grep, c.content = v, true
		case "regex":
			re, err := regexp.Compile(v)
			if err != nil {
				return err
			}
			c.grepRe, c.content = re, true
		}
		return nil
	}
	for _, t := range tokenize(q) {
		if t.key != "" {
			if err := apply(t.key, t.value); err != nil {
				return nil, err
			}
			continue
		}
		for _, piece := range strings.Split(t.value, "/") {
			if piece != "" {
				c.words = append(c.words, parseWord(piece))
			}
		}
	}
	f := req.Filters
	for k, v := range map[string]string{"type": f.Type, "kind": f.Kind, "mtime": f.Modified, "size": f.Size, "in": f.In} {
		if v != "" {
			if err := apply(k, v); err != nil {
				return nil, err
			}
		}
	}
	return c, nil
}

func (c *compiled) passes(e *entry, now int64) bool {
	if c.kind == "file" && e.dir || c.kind == "dir" && !e.dir {
		return false
	}
	if c.exts != nil {
		ext := strings.TrimPrefix(filepath.Ext(e.lower), ".")
		if !c.exts[ext] {
			return false
		}
	}
	if c.scope != "" && !strings.HasPrefix(e.path, c.scope+"/") {
		return false
	}
	if e.size < c.sizeLo || e.size > c.sizeHi {
		return false
	}
	age := now - e.mtime
	if age < c.ageLo || age > c.ageHi {
		return false
	}
	if c.nameRe != nil && !c.nameRe.MatchString(e.lower) {
		return false
	}
	if c.pathRe != nil && !c.pathRe.MatchString(e.path) {
		return false
	}
	return true
}

func (c *compiled) score(e *entry) int {
	total := 0
	for _, w := range c.words {
		s := w.score(e.lower)
		if w.negate {
			if s > 0 {
				return 0
			}
			continue
		}
		if s == 0 {
			return 0
		}
		total += s
	}
	if len(c.words) > 0 && total == 0 {
		return 0
	}
	total -= strings.Count(e.path, "/")
	if e.dir {
		total += 5
	}
	return max(total, 1)
}

func (b *Builtin) Search(ctx context.Context, req Request) (Result, error) {
	start := time.Now()
	c, err := b.compile(req)
	if err != nil {
		return Result{}, err
	}
	mode := ModeName
	if c.content {
		mode = ModeContent
	}
	res := Result{Engine: "builtin", Mode: mode, Hits: []Hit{}}
	if c.content && c.grep == "" && c.grepRe == nil {
		return res, nil
	}
	if !c.content && len(c.words) == 0 && c.exts == nil && c.kind == "" && c.scope == "" &&
		c.sizeLo == 0 && c.ageHi == math.MaxInt64 && c.nameRe == nil && c.pathRe == nil {
		return res, nil
	}
	b.mu.RLock()
	entries := b.entries
	b.mu.RUnlock()
	now := time.Now().Unix()
	if c.content {
		res.Hits, res.Partial = b.grep(ctx, c, entries, now)
	} else {
		type scored struct {
			i, s int
		}
		var found []scored
		for i := range entries {
			e := &entries[i]
			if !c.passes(e, now) {
				continue
			}
			if s := c.score(e); s > 0 {
				found = append(found, scored{i, s})
			}
		}
		sort.Slice(found, func(a, z int) bool {
			if found[a].s != found[z].s {
				return found[a].s > found[z].s
			}
			return entries[found[a].i].mtime > entries[found[z].i].mtime
		})
		for i, f := range found {
			if i >= c.limit {
				break
			}
			e := entries[f.i]
			kind := "file"
			if e.dir {
				kind = "dir"
			}
			res.Hits = append(res.Hits, newHit(e.path, kind, e.size, e.mtime, f.s))
		}
	}
	res.Partial = res.Partial || !b.ready.Load()
	res.TookUs = time.Since(start).Microseconds()
	return res, nil
}

const grepBudget = 1500 * time.Millisecond

// grep reads candidate files line by line, smart-case like fsearch: a
// pattern with an upper-case letter matches case-sensitively.
func (b *Builtin) grep(ctx context.Context, c *compiled, entries []entry, now int64) ([]Hit, bool) {
	deadline := time.Now().Add(grepBudget)
	pattern := c.grep
	fold := !strings.ContainsFunc(pattern, unicode.IsUpper)
	needle := []byte(pattern)
	if fold {
		needle = bytes.ToLower(needle)
	}
	match := func(line []byte) bool {
		if c.grepRe != nil {
			return c.grepRe.Match(line)
		}
		if fold {
			return bytes.Contains(bytes.ToLower(line), needle)
		}
		return bytes.Contains(line, needle)
	}
	var hits []Hit
	for i := range entries {
		e := &entries[i]
		if e.dir || e.size == 0 || e.size > 4<<20 || !c.passes(e, now) {
			continue
		}
		if len(c.words) > 0 && c.score(e) == 0 {
			continue
		}
		if time.Now().After(deadline) || ctx.Err() != nil {
			return hits, true
		}
		if m := grepFile(e.path, match, 3); len(m) > 0 {
			h := newHit(e.path, "file", e.size, e.mtime, len(m))
			h.Matches = m
			hits = append(hits, h)
			if len(hits) >= c.limit {
				break
			}
		}
	}
	return hits, false
}

func grepFile(path string, match func([]byte) bool, perFile int) []LineMatch {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	head := make([]byte, 512)
	n, _ := f.Read(head)
	if bytes.IndexByte(head[:n], 0) >= 0 {
		return nil
	}
	f.Seek(0, 0)
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64<<10), 1<<20)
	var out []LineMatch
	for line := 1; sc.Scan(); line++ {
		if match(sc.Bytes()) {
			text := strings.TrimSpace(sc.Text())
			if len(text) > 240 {
				text = text[:240]
			}
			out = append(out, LineMatch{Line: line, Text: text})
			if len(out) >= perFile {
				break
			}
		}
	}
	return out
}

func (b *Builtin) Status(context.Context) Status {
	b.mu.RLock()
	n := len(b.entries)
	b.mu.RUnlock()
	st := Status{Engine: "builtin", Ready: b.ready.Load(), Entries: n, FullDiskAccess: true}
	if !st.Ready {
		st.Entries = int(b.walked.Load())
		st.Message = "正在建立内置索引…"
	} else {
		st.Message = "未检测到 fsearch，正在使用内置索引"
	}
	return st
}

func (b *Builtin) Close() error {
	select {
	case <-b.stop:
	default:
		close(b.stop)
	}
	return nil
}

// parseRange reads ">x", "<x", "x..y" or "x" (at least x).
func parseRange(v string, unit func(string) (int64, error)) (lo, hi int64, err error) {
	lo, hi = 0, math.MaxInt64
	switch {
	case strings.HasPrefix(v, ">"):
		lo, err = unit(strings.TrimPrefix(strings.TrimPrefix(v, ">"), "="))
	case strings.HasPrefix(v, "<"):
		hi, err = unit(strings.TrimPrefix(strings.TrimPrefix(v, "<"), "="))
	case strings.Contains(v, ".."):
		a, z, _ := strings.Cut(v, "..")
		if lo, err = unit(a); err == nil {
			hi, err = unit(z)
		}
	default:
		lo, err = unit(v)
	}
	return lo, hi, err
}

func splitUnit(v string) (float64, string, error) {
	v = strings.ToLower(strings.TrimSpace(v))
	i := strings.IndexFunc(v, func(r rune) bool { return !(r >= '0' && r <= '9' || r == '.') })
	if i < 0 {
		i = len(v)
	}
	n, err := strconv.ParseFloat(v[:i], 64)
	if err != nil {
		return 0, "", fmt.Errorf("bad number %q", v)
	}
	return n, v[i:], nil
}

func parseSize(v string) (int64, error) {
	n, u, err := splitUnit(v)
	if err != nil {
		return 0, err
	}
	mult := map[string]float64{"": 1, "b": 1, "k": 1 << 10, "kb": 1 << 10, "m": 1 << 20, "mb": 1 << 20, "g": 1 << 30, "gb": 1 << 30, "t": 1 << 40, "tb": 1 << 40}[u]
	if mult == 0 {
		return 0, fmt.Errorf("bad size unit %q", u)
	}
	return int64(n * mult), nil
}

func parseAge(v string) (int64, error) {
	n, u, err := splitUnit(v)
	if err != nil {
		return 0, err
	}
	mult := map[string]float64{"s": 1, "m": 60, "min": 60, "h": 3600, "d": 86400, "w": 7 * 86400, "mo": 30 * 86400, "y": 365 * 86400}[u]
	if mult == 0 {
		return 0, fmt.Errorf("bad age unit %q", u)
	}
	return int64(n * mult), nil
}
