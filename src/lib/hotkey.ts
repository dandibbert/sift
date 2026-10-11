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

const punctuation: Record<string, string> = {
  Slash: "/",
  Period: ".",
  Comma: ",",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
};

/** The modifiers held during a key event, as the platform writes them. */
export function heldModifiers(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (isMac) {
    if (e.ctrlKey) keys.push("⌃");
    if (e.altKey) keys.push("⌥");
    if (e.shiftKey) keys.push("⇧");
    if (e.metaKey) keys.push("⌘");
  } else {
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");
    if (e.metaKey) keys.push("Win");
  }
  return keys;
}

/**
 * The accelerator a key press spells, or null if it is not a usable global
 * hotkey: a key needs ⌘, ⌃ or ⌥ (Shift alone would take a capital letter
 * from every app), except the function keys.
 */
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
  else if (punctuation[e.code]) key = punctuation[e.code]!;
  if (!key) return null;
  const fn = /^F\d+$/.test(key);
  if (!fn && !(e.metaKey || e.ctrlKey || e.altKey)) return null;
  return [...mods, key].join("+");
}
