// Package core is what the search window calls: searches, the hand-off to
// QSpace, settings and recent items. The desktop app binds it for its page;
// cmd/sift-preview serves it over HTTP for a browser tab.
package core

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"sift/internal/handoff"
	"sift/internal/search"
)

// Settings are kept in settings.json in the app's data folder.
type Settings struct {
	// Hotkey shows and hides the search window, as a MyGo accelerator.
	Hotkey string `json:"hotkey"`
	// QSpaceApp is the QSpace bundle; empty finds it in /Applications.
	QSpaceApp string `json:"qspaceApp"`
	// HideOnBlur hides the window when another app takes the focus.
	HideOnBlur bool `json:"hideOnBlur"`
	// EnterAction is what Return does: "reveal" (show in QSpace) or "open".
	EnterAction string `json:"enterAction"`
}

// DefaultSettings avoids the shortcuts macOS and Chinese input methods use:
// ⌘Space (Spotlight), ⌃Space (input source) and ⌥⌘Space (Finder search).
func DefaultSettings() Settings {
	return Settings{Hotkey: "CmdOrCtrl+Shift+Space", HideOnBlur: true, EnterAction: "reveal"}
}

// Action names what to do with a result.
type Action string

const (
	ActionReveal       Action = "reveal"
	ActionOpenInQSpace Action = "openInQSpace"
	ActionOpen         Action = "open"
	ActionQuickLook    Action = "quickLook"
	ActionFinder       Action = "revealInFinder"
)

const maxRecents = 8

// Core holds the engine and the user's data.
type Core struct {
	dir    string
	Engine *search.Manager
	// DryRun describes actions instead of running them: the browser
	// preview cannot hand files to QSpace.
	DryRun bool
	// Home is the folder the page abbreviates to ~.
	Home string

	mu       sync.Mutex
	settings Settings
	recents  []search.Hit
	qspace   handoff.QSpace
	inspect  time.Time
}

// New loads the settings in dir and starts the search engine.
func New(dir string, engine *search.Manager) (*Core, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	home, _ := os.UserHomeDir()
	c := &Core{dir: dir, Engine: engine, settings: DefaultSettings(), Home: home}
	c.load("settings.json", &c.settings)
	c.load("recents.json", &c.recents)
	return c, nil
}

func (c *Core) load(name string, v any) {
	b, err := os.ReadFile(filepath.Join(c.dir, name))
	if err == nil {
		json.Unmarshal(b, v)
	}
}

func (c *Core) save(name string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(c.dir, name+".tmp")
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(c.dir, name))
}

// Search runs one query.
func (c *Core) Search(ctx context.Context, req search.Request) (search.Result, error) {
	return c.Engine.Search(ctx, req)
}

// Status describes the engine.
func (c *Core) Status(ctx context.Context) search.Status {
	st := c.Engine.Status(ctx)
	st.Home = c.Home
	return st
}

// Settings returns the current settings.
func (c *Core) Settings() Settings {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.settings
}

// SaveSettings validates and stores s.
func (c *Core) SaveSettings(s Settings) (Settings, error) {
	if s.Hotkey == "" {
		return Settings{}, errors.New("快捷键不能为空")
	}
	if s.EnterAction != "open" {
		s.EnterAction = "reveal"
	}
	c.mu.Lock()
	c.settings = s
	c.inspect = time.Time{}
	c.mu.Unlock()
	return s, c.save("settings.json", s)
}

// QSpace reports the QSpace install, re-read at most every few seconds.
func (c *Core) QSpace() handoff.QSpace {
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.inspect) > 5*time.Second {
		c.qspace, c.inspect = handoff.Inspect(c.settings.QSpaceApp), time.Now()
	}
	return c.qspace
}

// Recents are the items most recently handed off, newest first, without
// those that have since been deleted.
func (c *Core) Recents() []search.Hit {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]search.Hit, 0, len(c.recents))
	for _, h := range c.recents {
		if _, err := os.Stat(h.Path); err == nil {
			out = append(out, h)
		}
	}
	return out
}

// ClearRecents forgets the recent items.
func (c *Core) ClearRecents() error {
	c.mu.Lock()
	c.recents = nil
	c.mu.Unlock()
	return c.save("recents.json", []search.Hit{})
}

func (c *Core) remember(h search.Hit) {
	c.mu.Lock()
	h.Matches, h.Score = nil, 0
	list := []search.Hit{h}
	for _, r := range c.recents {
		if r.Path != h.Path && len(list) < maxRecents {
			list = append(list, r)
		}
	}
	c.recents = list
	c.mu.Unlock()
	c.save("recents.json", list)
}

// Act hands hit to QSpace or the system.
func (c *Core) Act(action Action, hit search.Hit) (handoff.Outcome, error) {
	if hit.Path == "" {
		return handoff.Outcome{}, errors.New("没有选中的文件")
	}
	if c.DryRun {
		c.remember(hit)
		return handoff.Outcome{Selected: action == ActionReveal, Message: dryRunMessage(action, hit)}, nil
	}
	if _, err := os.Stat(hit.Path); err != nil {
		return handoff.Outcome{}, fmt.Errorf("%s 已不存在", hit.Name)
	}
	var (
		out handoff.Outcome
		err error
	)
	switch action {
	case ActionReveal:
		out, err = handoff.RevealInQSpace(c.QSpace(), hit.Path)
	case ActionOpenInQSpace:
		out, err = handoff.OpenInQSpace(c.QSpace(), hit.Path)
	case ActionOpen:
		err = handoff.Open(hit.Path)
		out.Message = "已打开 " + hit.Name
	case ActionQuickLook:
		return handoff.Outcome{}, handoff.QuickLook(hit.Path)
	case ActionFinder:
		err = handoff.RevealInFinder(hit.Path)
		out.Message = "已在访达中显示 " + hit.Name
	default:
		return handoff.Outcome{}, fmt.Errorf("unknown action %q", action)
	}
	if err == nil {
		c.remember(hit)
	}
	return out, err
}

func dryRunMessage(a Action, h search.Hit) string {
	switch a {
	case ActionReveal:
		return "预览模式：桌面版会在 QSpace 中选中 " + h.Name
	case ActionOpenInQSpace:
		return "预览模式：桌面版会在 QSpace 中打开所在文件夹"
	case ActionOpen:
		return "预览模式：桌面版会用默认应用打开 " + h.Name
	case ActionQuickLook:
		return "预览模式：桌面版会用 Quick Look 预览 " + h.Name
	case ActionFinder:
		return "预览模式：桌面版会在访达中显示 " + h.Name
	}
	return "预览模式"
}
