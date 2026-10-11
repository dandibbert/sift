package search

import (
	"context"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Manager prefers fsearch and falls back to the built-in index, trying
// fsearch again from time to time so that installing it takes effect
// without a restart.
type Manager struct {
	socket string
	roots  []string

	mu        sync.Mutex
	fs        *Fsearch
	builtin   *Builtin
	lastTry   time.Time
	lastError string
	// fdaRestarted is set once the daemon was restarted to pick up Full
	// Disk Access.
	fdaRestarted bool
}

// NewManager connects to fsearch at socket, or indexes roots itself.
func NewManager(socket string, roots ...string) *Manager {
	m := &Manager{socket: socket, roots: roots}
	m.engine(context.Background())
	return m
}

func (m *Manager) engine(ctx context.Context) Engine {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fs != nil {
		return m.fs
	}
	if m.socket != "" && time.Since(m.lastTry) > 30*time.Second {
		m.lastTry = time.Now()
		ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
		defer cancel()
		if f, err := NewFsearch(ctx, m.socket); err == nil {
			m.fs = f
			if m.builtin != nil {
				m.builtin.Close()
				m.builtin = nil
			}
			return f
		} else {
			m.lastError = err.Error()
		}
	}
	if m.builtin == nil {
		m.builtin = NewBuiltin(m.roots...)
	}
	return m.builtin
}

func (m *Manager) Search(ctx context.Context, req Request) (Result, error) {
	e := m.engine(ctx)
	res, err := e.Search(ctx, req)
	if f, ok := e.(*Fsearch); ok && err != nil && isConnError(err) {
		m.mu.Lock()
		if m.fs == f {
			f.Close()
			m.fs, m.lastTry = nil, time.Time{}
		}
		m.mu.Unlock()
		return m.engine(ctx).Search(ctx, req)
	}
	return res, err
}

func isConnError(err error) bool {
	s := err.Error()
	return strings.Contains(s, "connection") || strings.Contains(s, "broken pipe") || strings.Contains(s, "no such file") || err == ErrNoFsearch
}

func (m *Manager) Status(ctx context.Context) Status {
	e := m.engine(ctx)
	st := e.Status(ctx)
	if f, ok := e.(*Fsearch); ok && st.Ready && !st.FullDiskAccess && runtime.GOOS == "darwin" && HasFullDiskAccess() {
		// Sift was granted Full Disk Access after the daemon started. A
		// daemon Sift starts now inherits the grant, so start it over, once:
		// a daemon run by launchd needs a grant of its own.
		m.mu.Lock()
		try := !m.fdaRestarted
		m.fdaRestarted = true
		m.mu.Unlock()
		if try {
			if err := f.Restart(ctx); err == nil {
				st = f.Status(ctx)
			}
		}
		if st.Ready && !st.FullDiskAccess {
			st.Message = "Sift 已获得完全磁盘访问权限，但正在运行的 fsearch 不是 Sift 启动的（比如设成了随登录启动），需要在同一页里单独给它授权"
		}
	}
	if st.Engine == "builtin" && m.lastError != "" && m.lastError != ErrNoFsearch.Error() {
		st.Message = "fsearch 不可用（" + m.lastError + "），正在使用内置索引"
	}
	return st
}

func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fs != nil {
		m.fs.Close()
	}
	if m.builtin != nil {
		m.builtin.Close()
	}
	StopDaemons()
	return nil
}
