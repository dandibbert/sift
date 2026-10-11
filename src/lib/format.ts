export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1000 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")} ${units[i]}`;
}

const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" });

/** "刚刚", "12 分钟前", "昨天", "3 天前", then a date. */
export function formatAge(unixSeconds: number, now = Date.now()): string {
  if (!unixSeconds) return "";
  const diff = Math.round((now - unixSeconds * 1000) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  const then = new Date(unixSeconds * 1000);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(then).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `今天 ${timeFmt.format(then)}`;
  if (days === 1) return `昨天 ${timeFmt.format(then)}`;
  if (days < 7) return rtf.format(-days, "day");
  return dateFmt.format(then);
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString("zh-CN");
}

export function formatTook(us: number): string {
  if (us < 1000) return `${(us / 1000).toFixed(2)} ms`;
  if (us < 100_000) return `${(us / 1000).toFixed(1)} ms`;
  return `${Math.round(us / 1000)} ms`;
}

/** The segments of dir to show, with home as ~ and the middle elided. */
export function pathSegments(dir: string, home: string, keep = 4): string[] {
  let p = dir;
  let lead: string | null = null;
  if (home && (p === home || p.startsWith(home + "/"))) {
    lead = "~";
    p = p.slice(home.length);
  }
  const parts = p.split("/").filter(Boolean);
  if (lead) parts.unshift(lead);
  else parts.unshift("");
  if (parts.length > keep + 1) {
    return [parts[0]!, parts[1]!, "…", ...parts.slice(-(keep - 2))];
  }
  return parts;
}

export function displayPath(path: string, home: string): string {
  if (home && (path === home || path.startsWith(home + "/"))) return "~" + path.slice(home.length);
  return path;
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The glyph of the platform's command modifier. */
export const modKey = isMac ? "⌘" : "Ctrl";
