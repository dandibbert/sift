import { useEffect, useSyncExternalStore } from "react";

/**
 * Tracks open menus and dialogs. The desktop window is only as tall as the
 * panel, so it has to grow while something pops out of it.
 */
type Kind = "menu" | "modal";

const open = { menu: 0, modal: 0 };
let snapshot = { menu: false, modal: false };
const listeners = new Set<() => void>();

function update(kind: Kind, delta: number) {
  open[kind] += delta;
  snapshot = { menu: open.menu > 0, modal: open.modal > 0 };
  listeners.forEach((l) => l());
}

/** Registers an overlay of the given kind while `isOpen` is true. */
export function useOverlay(isOpen: boolean, kind: Kind = "menu") {
  useEffect(() => {
    if (!isOpen) return;
    update(kind, 1);
    return () => update(kind, -1);
  }, [isOpen, kind]);
}

export function useOverlays() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}
