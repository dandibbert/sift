// Sift is a search window for QSpace: a hotkey brings it up, fsearch finds
// the file, and Return hands it to QSpace.
package main

import (
	"context"
	"log"
	"runtime"
	"sync"

	"github.com/egoist/mygo"

	"sift/internal/core"
	"sift/internal/handoff"
	"sift/internal/search"
)

const (
	panelWidth     = 760
	panelHeight    = 540
	minPanelHeight = 64
)

// Shown is sent to the page each time the hotkey brings the window up, so
// that it selects the query and refreshes the engine status.
var Shown = mygo.NewEvent[bool]("shown")

// OpenSettings asks the page to open its settings dialog.
var OpenSettings = mygo.NewEvent[bool]("open-settings")

type app struct {
	core *core.Core
	win  *mygo.Window

	mu     sync.Mutex
	hotkey string
}

// Search runs queries for the page.
type Search struct{ a *app }

// Query searches file names, or file contents in content mode.
func (s Search) Query(ctx context.Context, req search.Request) (search.Result, error) {
	return s.a.core.Search(ctx, req)
}

// Status describes the engine: fsearch or the built-in index.
func (s Search) Status(ctx context.Context) search.Status { return s.a.core.Status(ctx) }

// Recents lists the items most recently handed off.
func (s Search) Recents() []search.Hit { return s.a.core.Recents() }

// ClearRecents forgets them.
func (s Search) ClearRecents() error { return s.a.core.ClearRecents() }

// Files hands results to QSpace and the system.
type Files struct{ a *app }

// Run performs action on hit. Actions that leave for another app hide the
// search window first.
func (f Files) Run(action core.Action, hit search.Hit) (handoff.Outcome, error) {
	if action != core.ActionQuickLook {
		f.a.hide()
	}
	return f.a.core.Act(action, hit)
}

// CopyPath puts path on the clipboard.
func (Files) CopyPath(path string) { mygo.Clipboard.WriteText(path) }

// Prefs reads and writes the settings.
type Prefs struct{ a *app }

// Get returns the settings.
func (p Prefs) Get() core.Settings { return p.a.core.Settings() }

// Save stores the settings and registers the new hotkey.
func (p Prefs) Save(s core.Settings) (core.Settings, error) {
	if err := p.a.registerHotkey(s.Hotkey); err != nil {
		return core.Settings{}, err
	}
	return p.a.core.SaveSettings(s)
}

// QSpace reports whether QSpace is installed and how it reveals files.
func (p Prefs) QSpace() handoff.QSpace { return p.a.core.QSpace() }

// OpenFullDiskAccess shows the System Settings pane where Sift is allowed
// to read protected folders. The daemon is Sift's child, so the one grant
// covers it.
func (p Prefs) OpenFullDiskAccess() error {
	p.a.hide()
	return handoff.OpenFullDiskAccess()
}

// Panel controls the search window.
type Panel struct{ a *app }

// Hide puts the window away, giving the focus back to the previous app.
func (p Panel) Hide() { p.a.hide() }

// Resize fits the window to the panel's height, so that an empty search
// is just the search field. The top edge stays where it is.
func (p Panel) Resize(height int) {
	if p.a.win == nil {
		return
	}
	p.a.win.SetSize(panelWidth, max(minPanelHeight, min(panelHeight, height)))
}

func (a *app) hide() {
	if a.win == nil || !a.win.IsVisible() {
		return
	}
	a.win.Hide()
	if runtime.GOOS == "darwin" {
		mygo.App.Hide()
	}
}

func (a *app) show() {
	// Open on the display the pointer is on, a third of the way down, as
	// Spotlight does.
	d := mygo.Screen.DisplayNearestPoint(mygo.Screen.CursorScreenPoint())
	wa := d.WorkArea
	if wa.Width > 0 {
		a.win.SetPosition(wa.X+(wa.Width-panelWidth)/2, wa.Y+wa.Height/5)
	}
	if runtime.GOOS == "darwin" {
		mygo.App.Show()
	}
	a.win.Show()
	a.win.Focus()
	mygo.App.Focus()
	Shown.Emit(a.win, true)
}

func (a *app) toggle() {
	if a.win.IsVisible() && a.win.IsFocused() {
		a.hide()
		return
	}
	a.show()
}

func (a *app) registerHotkey(acc string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if acc == a.hotkey {
		return nil
	}
	if err := mygo.GlobalShortcut.Register(acc, a.toggle); err != nil {
		return err
	}
	if a.hotkey != "" {
		mygo.GlobalShortcut.Unregister(a.hotkey)
	}
	a.hotkey = acc
	return nil
}

func main() {
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	a := &app{}
	mygo.Bind(Search{a}, Files{a}, Prefs{a}, Panel{a})

	mygo.App.WhenReady(func() {
		dir, err := mygo.App.Path(mygo.PathUserData)
		if err != nil {
			log.Fatal(err)
		}
		a.core, err = core.New(dir, search.NewManager(search.DefaultSocket()))
		if err != nil {
			log.Fatal(err)
		}
		if runtime.GOOS == "darwin" {
			mygo.App.SetActivationPolicy(mygo.ActivationPolicyAccessory)
		}

		opts := mygo.WindowOptions{
			Title:           "Sift",
			URL:             "/",
			Width:           panelWidth,
			Height:          panelHeight,
			Frameless:       true,
			Transparent:     true,
			BackgroundColor: "transparent",
			DisableResize:   true,
			DisableMinimize: true,
			DisableMaximize: true,
			AlwaysOnTop:     true,
			SkipTaskbar:     true,
			Hidden:          true,
		}
		a.win = mygo.NewWindow(opts)
		if runtime.GOOS != "darwin" {
			a.win.SetMenu(mygo.NewMenu(nil))
		}
		a.win.SetVisibleOnAllWorkspaces(true)
		a.win.OnClose(func(e *mygo.CloseEvent) {
			e.PreventDefault()
			a.hide()
		})
		a.win.OnBlur(func() {
			if a.core.Settings().HideOnBlur {
				a.hide()
			}
		})
		a.win.OnReadyToShow(a.show)

		if err := a.registerHotkey(a.core.Settings().Hotkey); err != nil {
			log.Printf("sift: hotkey %s: %v", a.core.Settings().Hotkey, err)
		}
		if _, err := mygo.NewTray(mygo.TrayOptions{
			Icon:           trayIcon(),
			IconIsTemplate: true,
			ToolTip:        "Sift",
			Menu: mygo.NewMenu([]*mygo.MenuItem{
				{Label: "打开搜索", Accelerator: a.core.Settings().Hotkey, Click: func(*mygo.MenuItem, *mygo.Window) { a.show() }},
				{Label: "设置…", Click: func(*mygo.MenuItem, *mygo.Window) {
					a.show()
					OpenSettings.Emit(a.win, true)
				}},
				mygo.Separator(),
				{Label: "退出 Sift", Click: func(*mygo.MenuItem, *mygo.Window) { mygo.App.Quit() }},
			}),
		}); err != nil {
			log.Printf("sift: tray: %v", err)
		}
	})
	mygo.App.OnWillQuit(func(*mygo.QuitEvent) {
		if a.core != nil {
			a.core.Engine.Close()
		}
	})
	mygo.App.OnSecondInstance(func([]string, string) { a.show() })
	mygo.App.OnActivate(func(bool) {
		if a.win != nil && !a.win.IsVisible() {
			a.show()
		}
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
