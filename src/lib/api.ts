import { isMyGo } from "mygo-runtime";
import * as go from "@/mygo";
import type { Hit, Outcome, QSpace, Request, Result, Settings, Status } from "@/mygo";

export type { Hit, Outcome, QSpace, Request, Result, Settings, Status, LineMatch, Filters } from "@/mygo";

export type Action = "reveal" | "openInQSpace" | "open" | "quickLook" | "revealInFinder";

/** True inside the desktop app; false in a browser tab of the dev server. */
export const desktop = isMyGo();

async function http<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `请求失败（${res.status}）`);
  return data as T;
}

export const api = {
  search(req: Request): Promise<Result> {
    return desktop ? go.Search.query(req) : http("search", req);
  },
  status(): Promise<Status> {
    return desktop ? go.Search.status() : http("status");
  },
  recents(): Promise<Hit[]> {
    return desktop ? go.Search.recents() : http<Hit[] | null>("recents").then((r) => r ?? []);
  },
  clearRecents(): Promise<void> {
    return desktop ? go.Search.clearRecents() : http("recents/clear", {});
  },
  run(action: Action, hit: Hit): Promise<Outcome> {
    return desktop ? go.Files.run(action, hit) : http("action", { action, hit });
  },
  async copy(text: string): Promise<void> {
    if (desktop) return go.Files.copyPath(text);
    await navigator.clipboard.writeText(text);
  },
  settings(): Promise<Settings> {
    return desktop ? go.Prefs.get() : http("settings");
  },
  saveSettings(s: Settings): Promise<Settings> {
    return desktop ? go.Prefs.save(s) : http("settings", s);
  },
  qspace(): Promise<QSpace> {
    return desktop ? go.Prefs.qSpace() : http("qspace");
  },
  openFullDiskAccess(): Promise<void> {
    return desktop ? go.Prefs.openFullDiskAccess() : Promise.resolve();
  },
  hide(): Promise<void> {
    return desktop ? go.Panel.hide() : Promise.resolve();
  },
  /** Fits the desktop window to the panel; the browser preview has no window. */
  resize(height: number): Promise<void> {
    return desktop ? go.Panel.resize(Math.ceil(height)) : Promise.resolve();
  },
  onShown(fn: () => void): () => void {
    if (!desktop) return () => {};
    return go.events.shown.on(fn);
  },
  onOpenSettings(fn: () => void): () => void {
    if (!desktop) return () => {};
    return go.events.openSettings.on(fn);
  },
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
