import { useEffect, useRef, useState } from "react";
import { api, errorMessage, type Filters, type Result } from "@/lib/api";

export type SearchState = {
  result: Result | null;
  /** True once a query has been waiting long enough to show progress. */
  loading: boolean;
  error: string | null;
};

const LIMIT = 80;

function hasFilters(f: Filters) {
  return Boolean(f.type || f.kind || f.modified || f.size || f.in);
}

/**
 * Runs the query as it is typed. Name searches go out on every keystroke
 * (fsearch answers in well under a millisecond); content searches wait for
 * a pause. Answers to superseded queries are dropped.
 */
export function useSearch(query: string, mode: "name" | "content", filters: Filters): SearchState {
  const [state, setState] = useState<SearchState>({ result: null, loading: false, error: null });
  const [retry, setRetry] = useState(0);
  const seq = useRef(0);

  // While the first index builds every answer is empty: ask again until it
  // is ready, so the results appear without retyping.
  const indexing = state.result?.indexing ?? false;
  useEffect(() => {
    if (!indexing) return;
    const again = () => setRetry((n) => n + 1);
    const t = setTimeout(() => document.hasFocus() && again(), 1500);
    window.addEventListener("focus", again);
    return () => {
      clearTimeout(t);
      window.removeEventListener("focus", again);
    };
  }, [indexing, state.result]);

  useEffect(() => {
    const id = ++seq.current;
    const q = query.trim();
    if (!q && (mode === "content" || !hasFilters(filters))) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    const delay = mode === "content" ? 220 : 0;
    let slow: ReturnType<typeof setTimeout> | undefined;
    const run = setTimeout(() => {
      slow = setTimeout(() => {
        if (seq.current === id) setState((s) => ({ ...s, loading: true }));
      }, 140);
      api
        .search({ query: q, mode, filters, limit: LIMIT })
        .then((result) => {
          if (seq.current === id) setState({ result, loading: false, error: null });
        })
        .catch((e) => {
          if (seq.current === id) setState((s) => ({ result: s.result, loading: false, error: errorMessage(e) }));
        })
        .finally(() => clearTimeout(slow));
    }, delay);
    return () => {
      clearTimeout(run);
      clearTimeout(slow);
    };
  }, [query, mode, filters, retry]);

  return state;
}
