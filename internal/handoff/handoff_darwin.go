package handoff

import (
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
)

// Inspect reads how QSpace is installed and whether it is the default file
// viewer (`defaults write -g NSFileViewer <bundle id>`, which QSpace's
// "Set as default file manager" does).
func Inspect(override string) QSpace {
	app := FindQSpace(override)
	q := QSpace{App: app, Installed: app != ""}
	if app == "" {
		return q
	}
	if out, err := exec.Command("defaults", "read", filepath.Join(app, "Contents", "Info"), "CFBundleIdentifier").Output(); err == nil {
		q.BundleID = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("defaults", "read", "-g", "NSFileViewer").Output(); err == nil {
		q.DefaultViewer = q.BundleID != "" && strings.EqualFold(strings.TrimSpace(string(out)), q.BundleID)
	}
	return q
}

var errNoQSpace = errors.New("没有找到 QSpace，请在设置中指定 QSpace 的位置")

// OpenInQSpace opens a folder in QSpace, or the folder of a file.
func OpenInQSpace(q QSpace, path string) (Outcome, error) {
	if !q.Installed {
		return Outcome{}, errNoQSpace
	}
	dir := folderOf(path)
	if err := exec.Command("open", "-a", q.App, dir).Run(); err != nil {
		return Outcome{}, err
	}
	return Outcome{Selected: false, Message: "已在 QSpace 中打开 " + filepath.Base(dir)}, nil
}

// RevealInQSpace shows path selected in its folder. Only the default file
// viewer receives NSWorkspace's reveal request (what `open -R` sends), so
// with QSpace set as such, QSpace selects the item; otherwise it opens the
// folder.
func RevealInQSpace(q QSpace, path string) (Outcome, error) {
	if !q.Installed {
		return Outcome{}, errNoQSpace
	}
	if q.DefaultViewer {
		if err := exec.Command("open", "-R", path).Run(); err != nil {
			return Outcome{}, err
		}
		return Outcome{Selected: true, Message: "已在 QSpace 中显示 " + filepath.Base(path)}, nil
	}
	if err := exec.Command("open", "-a", q.App, filepath.Dir(path)).Run(); err != nil {
		return Outcome{}, err
	}
	return Outcome{Message: "已在 QSpace 中打开所在文件夹。将 QSpace 设为默认文件管理器后可自动选中文件"}, nil
}

// Open opens path with its default app.
func Open(path string) error { return exec.Command("open", path).Run() }

// QuickLook previews path with the system's Quick Look panel.
func QuickLook(path string) error {
	cmd := exec.Command("qlmanage", "-p", path)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

// RevealInFinder selects path in Finder, whatever the default viewer is.
func RevealInFinder(path string) error {
	return exec.Command("open", "-b", "com.apple.finder", "-R", path).Run()
}

// FrontmostApp returns the bundle identifier of the active app, without the
// Automation permission osascript would need.
func FrontmostApp() string {
	asn, err := exec.Command("lsappinfo", "front").Output()
	if err != nil {
		return ""
	}
	out, err := exec.Command("lsappinfo", "info", "-only", "bundleid", strings.TrimSpace(string(asn))).Output()
	if err != nil {
		return ""
	}
	_, id, _ := strings.Cut(strings.TrimSpace(string(out)), "=")
	return strings.Trim(id, `"`)
}

// OpenFullDiskAccess opens System Settings at Privacy & Security › Full
// Disk Access, where Sift can be allowed to index protected folders.
func OpenFullDiskAccess() error {
	return exec.Command("open", "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles").Run()
}
