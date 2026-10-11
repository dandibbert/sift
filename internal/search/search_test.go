package search

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWordScore(t *testing.T) {
	cases := []struct {
		word, name string
		match      bool
	}{
		{"main", "main.rs", true},
		{"mian.rs", "main.rs", true}, // one swapped pair
		{"quartely", "meeting-notes-quarterly-review.md", true},
		{"^screen", "screenshot.png", true},
		{"^shot", "screenshot.png", false},
		{"png$", "screenshot.png", true},
		{"'exact", "inexactly", true},
		{"pdf", "kyoto-trip-edit-final.mp4", false},
		{"季度", "2026 q3 季度报告.pdf", true},
	}
	for _, c := range cases {
		got := parseWord(c.word).score(c.name) > 0
		if got != c.match {
			t.Errorf("%q in %q: got %v, want %v", c.word, c.name, got, c.match)
		}
	}
}

func TestSplitContent(t *testing.T) {
	f, p := splitContent(`ext:md in:"~/My Notes" quarterly report`)
	if f != `ext:md in:"~/My Notes"` || p != "quarterly report" {
		t.Fatalf("got filters %q, pattern %q", f, p)
	}
}

func TestParseRange(t *testing.T) {
	lo, hi, err := parseRange(">5mb", parseSize)
	if err != nil || lo != 5<<20 || hi < 1<<62 {
		t.Fatalf(">5mb: %d %d %v", lo, hi, err)
	}
	_, hi, err = parseRange("<7d", parseAge)
	if err != nil || hi != 7*86400 {
		t.Fatalf("<7d: %d %v", hi, err)
	}
}

func TestBuiltin(t *testing.T) {
	root := t.TempDir()
	write := func(rel, body string, age time.Duration) {
		p := filepath.Join(root, rel)
		os.MkdirAll(filepath.Dir(p), 0o755)
		os.WriteFile(p, []byte(body), 0o644)
		at := time.Now().Add(-age)
		os.Chtimes(p, at, at)
	}
	write("Documents/report-2026.pdf", "%PDF", time.Hour)
	write("Documents/notes.md", "TODO: send the quarterly report\n", 48*time.Hour)
	write("Pictures/beach.jpg", "jpg", 30*24*time.Hour)
	write("node_modules/report.js", "skipped", time.Hour)

	b := NewBuiltin(root)
	defer b.Close()
	for !b.ready.Load() {
		time.Sleep(5 * time.Millisecond)
	}
	ctx := context.Background()

	res, err := b.Search(ctx, Request{Query: "report"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Hits) != 1 || res.Hits[0].Name != "report-2026.pdf" {
		t.Fatalf("report: %+v", res.Hits)
	}

	res, _ = b.Search(ctx, Request{Filters: Filters{Type: "image"}})
	if len(res.Hits) != 1 || res.Hits[0].Name != "beach.jpg" {
		t.Fatalf("type:image: %+v", res.Hits)
	}

	res, _ = b.Search(ctx, Request{Query: "kind:file mtime:<1d"})
	if len(res.Hits) != 1 {
		t.Fatalf("mtime:<1d: %+v", res.Hits)
	}

	res, _ = b.Search(ctx, Request{Query: "ext:md quarterly", Mode: ModeContent})
	if len(res.Hits) != 1 || len(res.Hits[0].Matches) != 1 || res.Hits[0].Matches[0].Line != 1 {
		t.Fatalf("content: %+v", res.Hits)
	}

	res, _ = b.Search(ctx, Request{Query: "Quarterly", Mode: ModeContent})
	if len(res.Hits) != 0 {
		t.Fatalf("smart case should not match: %+v", res.Hits)
	}
}
