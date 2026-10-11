const FILTER = /^(ext|type|kind|in|size|mtime|modified|re|path|limit|grep|content|regex|sym|symbol):/i;

/** The words of a name query that should light up in result names. */
export function queryWords(query: string): string[] {
  return query
    .split(/\s+/)
    .filter((w) => w && !FILTER.test(w) && !w.startsWith("!"))
    .flatMap((w) => w.split("/"))
    .map((w) => w.replace(/^['^]/, "").replace(/\$$/, "").toLowerCase())
    .filter(Boolean);
}

/** The filter tokens typed into the query, e.g. "ext:pdf". */
export function queryFilters(query: string): string[] {
  return query.split(/\s+/).filter((w) => FILTER.test(w));
}

/**
 * Character ranges of text matched by words: a substring when there is
 * one, else the letters of a subsequence, as the engine scores them.
 */
export function matchRanges(text: string, words: string[]): Array<[number, number]> {
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    const at = lower.indexOf(w);
    if (at >= 0) {
      for (let i = at; i < at + w.length; i++) marked[i] = true;
      continue;
    }
    const picks: number[] = [];
    let j = 0;
    for (let i = 0; i < lower.length && j < w.length; i++) {
      if (lower[i] === w[j]) {
        picks.push(i);
        j++;
      }
    }
    if (j === w.length) for (const i of picks) marked[i] = true;
  }
  const out: Array<[number, number]> = [];
  for (let i = 0; i < marked.length; i++) {
    if (!marked[i]) continue;
    let k = i;
    while (k < marked.length && marked[k]) k++;
    out.push([i, k]);
    i = k;
  }
  return out;
}

/** Ranges of every occurrence of pattern in a line, smart-case. */
export function patternRanges(text: string, pattern: string): Array<[number, number]> {
  if (!pattern) return [];
  const fold = pattern === pattern.toLowerCase();
  const hay = fold ? text.toLowerCase() : text;
  const needle = fold ? pattern.toLowerCase() : pattern;
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    out.push([at, at + needle.length]);
    from = at + needle.length;
  }
  return out;
}

/** The text a content search looks for: the query without its filters. */
export function contentPattern(query: string): string {
  return query
    .split(/\s+/)
    .filter((w) => w && !FILTER.test(w))
    .join(" ");
}
