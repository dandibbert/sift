package search

import (
	"strings"
)

// filterKeys are the fsearch query keys, written as key:value.
var filterKeys = map[string]bool{
	"ext": true, "type": true, "kind": true, "in": true, "size": true,
	"mtime": true, "modified": true, "re": true, "path": true, "limit": true,
	"grep": true, "content": true, "regex": true, "sym": true, "symbol": true,
}

var contentKeys = []string{"grep:", "content:", "regex:", "sym:", "symbol:"}

// typeExts mirrors fsearch's type: groups.
var typeExts = map[string][]string{
	"image":   {"png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tiff", "tif", "bmp", "svg", "raw", "cr2", "cr3", "nef", "arw", "dng", "psd", "ico", "icns", "avif", "jxl"},
	"video":   {"mp4", "mov", "m4v", "mkv", "avi", "webm", "wmv", "flv", "mpg", "mpeg", "3gp", "hevc"},
	"audio":   {"mp3", "m4a", "aac", "wav", "flac", "aiff", "aif", "ogg", "opus", "alac", "caf", "mid", "midi", "m4r"},
	"doc":     {"pdf", "doc", "docx", "pages", "txt", "md", "rtf", "odt", "key", "ppt", "pptx", "numbers", "xls", "xlsx", "csv", "epub", "tex"},
	"code":    {"rs", "c", "h", "cc", "cpp", "hpp", "m", "mm", "swift", "go", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "java", "kt", "rb", "php", "cs", "sh", "zsh", "bash", "fish", "lua", "sql", "html", "css", "scss", "json", "yaml", "yml", "toml", "xml", "vue", "svelte", "zig", "nim", "hs", "ml", "ex", "exs", "erl", "clj", "dart", "r", "jl", "metal", "glsl", "wgsl", "proto", "graphql", "nix"},
	"archive": {"zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "dmg", "pkg", "iso", "zst", "lz4", "xip"},
}

// token is one word of a query: a filter (key set) or a search word.
type token struct {
	key, value string
}

// tokenize splits a query on spaces, keeping double-quoted runs together.
func tokenize(q string) []token {
	var out []token
	var b strings.Builder
	quoted := false
	flush := func() {
		if b.Len() == 0 {
			return
		}
		w := b.String()
		b.Reset()
		if i := strings.IndexByte(w, ':'); i > 0 && filterKeys[strings.ToLower(w[:i])] {
			out = append(out, token{key: strings.ToLower(w[:i]), value: strings.Trim(w[i+1:], `"`)})
			return
		}
		out = append(out, token{value: w})
	}
	for _, r := range q {
		switch {
		case r == '"':
			quoted = !quoted
		case r == ' ' && !quoted:
			flush()
		default:
			b.WriteRune(r)
		}
	}
	flush()
	return out
}

// isContentQuery reports whether a name-mode query asks for content anyway,
// through grep:, regex: or sym:.
func isContentQuery(q string) bool {
	for _, k := range contentKeys {
		if strings.Contains(q, k) {
			return true
		}
	}
	return false
}

// splitContent separates the filters of a content-mode query from its
// pattern: "ext:md quarterly report" searches inside .md files for
// "quarterly report".
func splitContent(q string) (filters, pattern string) {
	var f, p []string
	for _, t := range tokenize(q) {
		if t.key != "" {
			f = append(f, t.key+":"+quoteIfSpaced(t.value))
		} else {
			p = append(p, t.value)
		}
	}
	return strings.Join(f, " "), strings.Join(p, " ")
}

func quoteIfSpaced(s string) string {
	if strings.ContainsRune(s, ' ') {
		return `"` + s + `"`
	}
	return s
}
