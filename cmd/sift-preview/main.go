// Command sift-preview serves the search window's API over HTTP, so the
// page can be worked on in a browser tab with `bun run dev:web`. It
// searches with the same engine as the app, and describes hand-offs to
// QSpace instead of performing them.
//
//	go run ./cmd/sift-preview -root ~/Documents
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"sift/internal/core"
	"sift/internal/search"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:"+envOr("SIFT_PREVIEW_PORT", "47219"), "listen address")
	root := flag.String("root", "", "folder for the built-in index (default: the home folder)")
	noFsearch := flag.Bool("no-fsearch", false, "always use the built-in index")
	flag.Parse()

	var roots []string
	if *root != "" {
		abs, err := filepath.Abs(expand(*root))
		if err != nil {
			log.Fatal(err)
		}
		roots = append(roots, abs)
	}
	socket := search.DefaultSocket()
	if *noFsearch {
		socket = ""
	}
	dir, err := os.MkdirTemp("", "sift-preview-")
	if err != nil {
		log.Fatal(err)
	}
	c, err := core.New(dir, search.NewManager(socket, roots...))
	if err != nil {
		log.Fatal(err)
	}
	c.DryRun = true
	if len(roots) == 1 {
		c.Home = roots[0]
	}

	mux := http.NewServeMux()
	handle(mux, "/api/search", func(r *http.Request) (any, error) {
		var req search.Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return nil, err
		}
		return c.Search(r.Context(), req)
	})
	handle(mux, "/api/status", func(r *http.Request) (any, error) { return c.Status(r.Context()), nil })
	handle(mux, "/api/recents", func(*http.Request) (any, error) { return c.Recents(), nil })
	handle(mux, "/api/recents/clear", func(*http.Request) (any, error) { return nil, c.ClearRecents() })
	handle(mux, "/api/action", func(r *http.Request) (any, error) {
		var body struct {
			Action core.Action `json:"action"`
			Hit    search.Hit  `json:"hit"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			return nil, err
		}
		return c.Act(body.Action, body.Hit)
	})
	handle(mux, "/api/settings", func(r *http.Request) (any, error) {
		if r.Method == http.MethodPost {
			var s core.Settings
			if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
				return nil, err
			}
			return c.SaveSettings(s)
		}
		return c.Settings(), nil
	})
	handle(mux, "/api/qspace", func(*http.Request) (any, error) { return c.QSpace(), nil })

	log.Printf("sift-preview: http://%s (roots: %v)", *addr, roots)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func handle(mux *http.ServeMux, path string, fn func(*http.Request) (any, error)) {
	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		v, err := fn(r)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(v)
	})
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func expand(p string) string {
	if rest, ok := strings.CutPrefix(p, "~"); ok {
		home, _ := os.UserHomeDir()
		return home + rest
	}
	return p
}
