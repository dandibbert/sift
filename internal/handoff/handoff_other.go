//go:build !darwin

package handoff

import (
	"errors"
	"os/exec"
	"path/filepath"
	"runtime"
)

// QSpace is macOS only: elsewhere the QSpace actions open folders in the
// desktop's file manager, so the window stays usable while developing.

func Inspect(string) QSpace { return QSpace{} }

func OpenInQSpace(_ QSpace, path string) (Outcome, error) {
	dir := folderOf(path)
	if err := openWith(dir); err != nil {
		return Outcome{}, err
	}
	return Outcome{Message: "QSpace 仅支持 macOS，已用系统文件管理器打开 " + filepath.Base(dir)}, nil
}

func RevealInQSpace(_ QSpace, path string) (Outcome, error) {
	if err := openWith(filepath.Dir(path)); err != nil {
		return Outcome{}, err
	}
	return Outcome{Message: "QSpace 仅支持 macOS，已用系统文件管理器打开所在文件夹"}, nil
}

func Open(path string) error { return openWith(path) }

func QuickLook(string) error { return errors.New("Quick Look 仅支持 macOS") }

func RevealInFinder(path string) error { return openWith(filepath.Dir(path)) }

func FrontmostApp() string { return "" }

func openWith(path string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", path).Start()
	default:
		return exec.Command("xdg-open", path).Start()
	}
}
