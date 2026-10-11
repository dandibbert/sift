import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, desktop } from "@/lib/api";
import { useOverlays } from "@/lib/overlay";
import { cn } from "@/lib/utils";

/** Matches panelHeight in main.go. */
export const PANEL_MAX = 540;

/**
 * The panel's outline. It is as tall as what it shows, up to PANEL_MAX, and
 * fills PANEL_MAX while a dialog is open. On the desktop it sizes the
 * window to match, growing it ahead of menus so they are not cut off.
 */
export function PanelFrame({ className, maxHeight, children }: { className?: string; maxHeight: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const { menu, modal } = useOverlays();
  const expanded = menu || modal;
  const wasExpanded = useRef(false);
  const latest = useRef(0);
  latest.current = expanded ? PANEL_MAX : height;

  // A resize sent while the window was hidden may not have stuck.
  useEffect(() => api.onShown(() => latest.current && api.resize(latest.current)), []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry?.borderBoxSize[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!desktop || !height) return;
    if (expanded) {
      wasExpanded.current = true;
      api.resize(PANEL_MAX);
      return;
    }
    // Let a closing menu fade out before the window shrinks under it.
    const delay = wasExpanded.current ? 160 : 0;
    wasExpanded.current = false;
    const t = setTimeout(() => api.resize(height), delay);
    return () => clearTimeout(t);
  }, [height, expanded]);

  return (
    <div ref={ref} className={cn("flex flex-col overflow-hidden", className)} style={modal ? { height: maxHeight, maxHeight } : { maxHeight }}>
      {children}
    </div>
  );
}
