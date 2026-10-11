// Package handoff passes a found file on to QSpace, or to the system.
package handoff

import (
	"os"
	"path/filepath"
)

// Outcome tells the search window what happened, for its toast.
type Outcome struct {
	// Selected is true when the file manager selected the item itself,
	// false when only its folder was opened.
	Selected bool   `json:"selected"`
	Message  string `json:"message"`
}

// QSpace describes the QSpace install, if any.
type QSpace struct {
	App      string `json:"app"`
	BundleID string `json:"bundleId"`
	// DefaultViewer is true when QSpace is set as the default file viewer,
	// which lets it select a revealed item.
	DefaultViewer bool `json:"defaultViewer"`
	Installed     bool `json:"installed"`
}

// candidateApps are the bundles QSpace ships as.
var candidateApps = []string{"QSpace Pro.app", "QSpace.app"}

// FindQSpace returns the QSpace bundle at override, or the first one
// installed in the Applications folders.
func FindQSpace(override string) string {
	if override != "" {
		if _, err := os.Stat(override); err == nil {
			return override
		}
	}
	home, _ := os.UserHomeDir()
	for _, dir := range []string{"/Applications", filepath.Join(home, "Applications"), "/Applications/Setapp"} {
		for _, name := range candidateApps {
			p := filepath.Join(dir, name)
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return ""
}

// folderOf is the folder to open for path: itself for a folder (but not a
// bundle such as an .app), its parent otherwise.
func folderOf(path string) string {
	st, err := os.Stat(path)
	if err == nil && st.IsDir() && filepath.Ext(path) == "" {
		return path
	}
	return filepath.Dir(path)
}
