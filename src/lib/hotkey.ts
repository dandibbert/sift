import { isMac } from "@/lib/format";

const glyph: Record<string, string> = isMac
  ? { cmdorctrl: "⌘", cmd: "⌘", command: "⌘", ctrl: "⌃", control: "⌃", alt: "⌥", option: "⌥", shift: "⇧", space: "Space" }
  : { cmdorctrl: "Ctrl", cmd: "Win", command: "Win", ctrl: "Ctrl", control: "Ctrl", alt: "Alt", option: "Alt", shift: "Shift", space: "Space" };

/** The keys of a MyGo accelerator, as the platform writes them. */
export function hotkeyKeys(acc: string): string[] {
  return acc
    .split("+")
    .filter(Boolean)
    .map((k) => glyph[k.toLowerCase()] ?? (k.length === 1 ? k.toUpperCase() : k));
}

/** The accelerator a key press spells, or null without a modifier. */
export function acceleratorFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push(isMac ? "Cmd" : "Super");
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  let key: string | null = null;
  if (e.code === "Space") key = "Space";
  else if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-9])$/.test(e.code)) key = e.code;
  else if (e.code === "Slash") key = "/";
  else if (e.code === "Period") key = ".";
  if (!key || mods.length === 0) return null;
  return [...mods, key].join("+");
}
