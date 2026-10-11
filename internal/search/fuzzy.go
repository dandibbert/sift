package search

import (
	"strings"
)

type wordMode int

const (
	wordFuzzy wordMode = iota
	wordExact
	wordPrefix
	wordSuffix
)

type word struct {
	text   string
	mode   wordMode
	negate bool
}

func parseWord(w string) word {
	out := word{mode: wordFuzzy}
	if r, ok := strings.CutPrefix(w, "!"); ok {
		w, out.negate, out.mode = r, true, wordExact
	}
	switch {
	case strings.HasPrefix(w, "'"):
		w, out.mode = w[1:], wordExact
	case strings.HasPrefix(w, "^"):
		w, out.mode = w[1:], wordPrefix
	case strings.HasSuffix(w, "$"):
		w, out.mode = w[:len(w)-1], wordSuffix
	}
	out.text = strings.ToLower(w)
	return out
}

// score rates how well name (lowercased) matches w, 0 for no match.
// Substrings beat subsequences, which beat a match with one typo.
func (w word) score(name string) int {
	t := w.text
	switch w.mode {
	case wordExact:
		if strings.Contains(name, t) {
			return 100
		}
		return 0
	case wordPrefix:
		if strings.HasPrefix(name, t) {
			return 120
		}
		return 0
	case wordSuffix:
		if strings.HasSuffix(name, t) {
			return 120
		}
		return 0
	}
	if i := strings.Index(name, t); i >= 0 {
		s := 100
		if i == 0 {
			s += 40
		} else if isBoundary(name[i-1]) {
			s += 25
		}
		if len(name) == len(t) {
			s += 30
		}
		return s
	}
	if s := subsequence(name, t); s > 0 {
		return s
	}
	if len([]rune(t)) >= 5 && oneTypo(name, t) {
		return 20
	}
	return 0
}

func isBoundary(b byte) bool {
	return b == ' ' || b == '_' || b == '-' || b == '.' || b == '/'
}

// subsequence scores t appearing in order within name; tighter runs score
// higher.
func subsequence(name, t string) int {
	nr, tr := []rune(name), []rune(t)
	j, gaps, first := 0, 0, -1
	for i := 0; i < len(nr) && j < len(tr); i++ {
		if nr[i] == tr[j] {
			if first < 0 {
				first = i
			}
			j++
		} else if first >= 0 {
			gaps++
		}
	}
	// Letters scattered across a long name are noise, not a match.
	if j < len(tr) || gaps > max(2, len(tr)) {
		return 0
	}
	s := 70 - gaps*3
	if first == 0 {
		s += 10
	}
	if s < 30 {
		s = 30
	}
	return s
}

// oneTypo reports whether t, with one letter dropped, swapped with its
// neighbour or replaced, appears in name.
func oneTypo(name, t string) bool {
	r := []rune(t)
	for i := range r {
		dropped := string(r[:i]) + string(r[i+1:])
		if strings.Contains(name, dropped) {
			return true
		}
		if i+1 < len(r) {
			sw := append([]rune{}, r...)
			sw[i], sw[i+1] = sw[i+1], sw[i]
			if strings.Contains(name, string(sw)) {
				return true
			}
		}
	}
	n := []rune(name)
	for start := 0; start+len(r) <= len(n); start++ {
		diff := 0
		for i, c := range r {
			if n[start+i] != c {
				if diff++; diff > 1 {
					break
				}
			}
		}
		if diff <= 1 {
			return true
		}
	}
	return false
}
