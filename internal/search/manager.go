package search

import (
	"context"
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
	st := m.engine(ctx).Status(ctx)
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
