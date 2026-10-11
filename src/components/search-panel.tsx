import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { api, desktop, errorMessage, type Filters, type Hit, type Settings, type Status } from "@/lib/api";
import { actionDefs, type ActionId } from "@/lib/actions";
import { useSearch } from "@/hooks/use-search";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ResultRow } from "@/components/result-row";
import { FilterBar } from "@/components/filter-bar";
import { ModeSwitch, type SearchMode } from "@/components/mode-switch";
import { ActionsMenu, RowContextMenu } from "@/components/actions-menu";
import { StatusFooter } from "@/components/status-footer";
import { SettingsDialog } from "@/components/settings-dialog";
import { IndexingNotice, NoResults, QueryError } from "@/components/empty-states";
import { contentPattern, queryWords } from "@/lib/highlight";
import { useOverlay } from "@/lib/overlay";
import { isMac } from "@/lib/format";
import { cn } from "@/lib/utils";

const noFilters: Filters = { type: "", kind: "", modified: "", size: "", in: "" };

function grepToken(query: string): string {
  const m = query.match(/(?:^|\s)(?:grep|content|regex|sym|symbol):("[^"]*"|\S+)/);
  return m?.[1]?.replace(/^"|"$/g, "") ?? "";
}

type Toast = { id: number; text: string; tone: "default" | "error" };

// The browser preview takes a starting query from the URL: /?q=report&mode=content
const initial = desktop ? null : new URLSearchParams(location.search);

export function SearchPanel() {
  const [query, setQuery] = useState(initial?.get("q") ?? "");
  const [mode, setMode] = useState<SearchMode>(initial?.get("mode") === "content" ? "content" : "name");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [selected, setSelected] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [recents, setRecents] = useState<Hit[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { result, loading, error } = useSearch(query, mode, filters);
  useOverlay(actionsOpen);
  useOverlay(contextOpen);
  useOverlay(settingsOpen, "modal");
  const hasFilters = Boolean(filters.type || filters.kind || filters.modified || filters.size || filters.in);
  const searching = query.trim() !== "" || (mode === "name" && hasFilters);
  const hits = searching ? (result?.hits ?? []) : mode === "name" ? recents : [];
  const hit = hits[Math.min(selected, hits.length - 1)] ?? null;
  const home = status?.home ?? "";
  const enterOpens = settings?.enterAction === "open";
  const actions = useMemo(() => actionDefs(enterOpens), [enterOpens]);
  const primaryLabel = enterOpens ? "打开" : "在 QSpace 中显示";
  const words = useMemo(() => queryWords(query), [query]);
  const pattern = mode === "content" ? contentPattern(query) : grepToken(query);

  const showToast = useCallback((text: string, tone: Toast["tone"] = "default") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => {
    api.status().then(setStatus).catch(() => {});
    api.recents().then(setRecents).catch(() => {});
  }, []);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
    refresh();
    const off = api.onShown(() => {
      setActionsOpen(false);
      refresh();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    });
    const offSettings = api.onOpenSettings(() => {
      setActionsOpen(false);
      setSettingsOpen(true);
    });
    return () => {
      off();
      offSettings();
    };
  }, [refresh]);

  // Poll quickly while the index builds, slowly once it is up.
  // Also quickly while settings wait for Full Disk Access to be granted.
  const awaitingAccess = settingsOpen && status?.engine === "fsearch" && !status.fullDiskAccess;
  useEffect(() => {
    if (settingsOpen) api.status().then(setStatus).catch(() => {});
  }, [settingsOpen]);
  useEffect(() => {
    const fast = !status || !status.ready || awaitingAccess;
    const t = setInterval(() => api.status().then(setStatus).catch(() => {}), fast ? 1500 : 20000);
    return () => clearInterval(t);
  }, [status?.ready, awaitingAccess]);

  useEffect(() => setSelected(0), [result, searching, mode]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected, hits]);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const run = useCallback(
    async (id: ActionId, target: Hit | null = hit) => {
      setActionsOpen(false);
      focusInput();
      if (!target) return;
      try {
        switch (id) {
          case "copyPath":
            await api.copy(target.path);
            showToast("已复制路径");
            return;
          case "copyName":
            await api.copy(target.name);
            showToast("已复制名称");
            return;
          case "searchHere":
            setFilters((f) => ({ ...f, in: target.kind === "dir" ? target.path : target.dir }));
            setQuery("");
            return;
          default: {
            const out = await api.run(id, target);
            if (out.message) showToast(out.message);
            api.recents().then(setRecents).catch(() => {});
          }
        }
      } catch (e) {
        showToast(errorMessage(e), "error");
      }
    },
    [hit, showToast],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (settingsOpen || e.nativeEvent.isComposing) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (hit) setActionsOpen((o) => !o);
      return;
    }
    // Menus render in portals, but React still bubbles their keys here.
    if (actionsOpen || !e.currentTarget.contains(e.target as Node)) return;
    if (mod && e.key === ",") {
      e.preventDefault();
      setSettingsOpen(true);
      return;
    }
    const move = (d: number) => {
      e.preventDefault();
      if (hits.length) setSelected((s) => Math.max(0, Math.min(hits.length - 1, s + d)));
    };
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) return move(1);
    if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) return move(-1);
    if (e.key === "PageDown") return move(8);
    if (e.key === "PageUp") return move(-8);
    if (e.key === "Tab" && !e.shiftKey && !mod) {
      e.preventDefault();
      setMode((m) => (m === "name" ? "content" : "name"));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else if (hasFilters) setFilters(noFilters);
      else api.hide();
      return;
    }
    const action = actions.find((a) => a.matches(e, enterOpens));
    if (action && hit) {
      e.preventDefault();
      run(action.id);
    }
  };

  const listLabel = !searching && mode === "name" && recents.length > 0 ? "最近使用" : null;
  const showProgress = loading;

  // Nothing to list: the window is just the search field and the filters.
  let body: React.ReactNode = null;
  if (searching && result?.indexing && hits.length === 0) {
    body = <IndexingNotice text={result.notice} />;
  } else if (error && hits.length === 0) {
    body = <QueryError message={error} />;
  } else if (searching && result && hits.length === 0 && !loading) {
    body = (
      <NoResults
        query={query.trim()}
        mode={mode}
        hasFilters={hasFilters}
        onSwitchMode={() => {
          setMode("content");
          focusInput();
        }}
        onClearFilters={() => {
          setFilters(noFilters);
          focusInput();
        }}
      />
    );
  } else if (hits.length > 0 || (searching && error)) {
    body = (
      <>
        {error && <QueryError message={error} />}
        {renderList()}
      </>
    );
  }

  function renderList() {
    return (
      <ContextMenu
        onOpenChange={(o) => {
          setContextOpen(o);
          if (!o) focusInput();
        }}
      >
        <ContextMenuTrigger asChild>
          <div role="listbox" aria-label={listLabel ?? "搜索结果"} className="pb-2">
            {listLabel && (
              <div className="flex items-center justify-between px-5 pt-1 pb-1.5">
                <span className="text-[11px] font-medium tracking-wide text-faint-foreground">{listLabel}</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api.clearRecents().then(() => setRecents([]))}
                  className="text-[11px] text-faint-foreground hover:text-foreground"
                >
                  清除
                </button>
              </div>
            )}
            {hits.map((h, i) => (
              <div key={h.path} onContextMenu={() => setSelected(i)}>
                <ResultRow
                  hit={h}
                  selected={i === selected}
                  words={words}
                  pattern={pattern}
                  home={home}
                  onSelect={() => setSelected(i)}
                  onActivate={() => run(enterOpens ? "open" : "reveal", h)}
                />
              </div>
            ))}
          </div>
        </ContextMenuTrigger>
        <RowContextMenu hit={hit} actions={actions} onRun={(id) => run(id)} />
      </ContextMenu>
    );
  }

  return (
    <div onKeyDown={onKeyDown} className="@container relative flex min-h-0 grow flex-col overflow-hidden">
      <header className="flex h-[58px] shrink-0 items-center gap-3 pr-3 pl-[18px]" style={{ "--app-region": "drag" } as React.CSSProperties}>
        <SearchIcon className="size-[19px] shrink-0 text-muted-foreground" strokeWidth={1.9} />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "name" ? "搜索文件和文件夹" : "搜索文件里的文字"}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-normal tracking-[-0.01em] text-foreground caret-highlight outline-none placeholder:text-faint-foreground"
          style={{ "--app-region": "no-drag" } as React.CSSProperties}
        />
        {query && (
          <button type="button" aria-label="清空" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")} className="grid size-6 shrink-0 place-items-center rounded-full text-faint-foreground hover:bg-accent hover:text-foreground">
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        )}
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            focusInput();
          }}
        />
      </header>

      <FilterBar
        filters={filters}
        home={home}
        onChange={(patch) => {
          setFilters((f) => ({ ...f, ...patch }));
          focusInput();
        }}
        onClose={focusInput}
      />

      <div className={cn("relative h-px shrink-0", body ? "bg-border" : "-mt-px")}>
        {showProgress && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="animate-progress h-full w-1/3 bg-gradient-to-r from-transparent via-foreground/50 to-transparent" />
          </div>
        )}
      </div>

      {body && (
        <div ref={listRef} className={cn("min-h-0 shrink grow overflow-y-auto pt-2 scrollbar-quiet", loading && "opacity-90")}>
          {body}
        </div>
      )}
      {!body && settingsOpen && <div className="grow" />}

      {body && <StatusFooter
        status={status}
        result={searching ? result : null}
        count={hits.length}
        primaryLabel={primaryLabel}
        hasSelection={hit !== null}
        onActions={() => setActionsOpen((o) => !o)}
        onSettings={() => setSettingsOpen(true)}
        actionsAnchor={(node) => (
          <ActionsMenu open={actionsOpen} onOpenChange={(o) => (setActionsOpen(o), !o && focusInput())} hit={hit} actions={actions} onRun={(id) => run(id)}>
            {node}
          </ActionsMenu>
        )}
      />}

      {toast && (
        <div key={toast.id} className={cn("pointer-events-none absolute inset-x-0 flex justify-center px-6", body ? "bottom-[52px]" : "bottom-2")}>
          <div
            role="status"
            className={cn(
              "max-w-full truncate rounded-full border px-3.5 py-1.5 text-[12px] font-medium shadow-[0_8px_24px_-8px_oklch(0_0_0/0.35)] backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
              toast.tone === "error" ? "border-destructive/30 bg-popover/95 text-destructive" : "border-border bg-popover/95 text-foreground",
            )}
          >
            {toast.text}
          </div>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(o) => {
          setSettingsOpen(o);
          if (!o) focusInput();
        }}
        status={status}
        onSaved={setSettings}
      />
    </div>
  );
}
