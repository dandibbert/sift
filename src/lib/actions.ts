import { AppWindow, ClipboardCopy, Eye, FolderOpen, FolderSearch, ScanSearch, SquareArrowOutUpRight, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Action } from "@/lib/api";
import { isMac, modKey } from "@/lib/format";

export type ActionId = Action | "copyPath" | "copyName" | "searchHere";

export type ActionDef = {
  id: ActionId;
  label: string;
  icon: LucideIcon;
  keys: string[];
  /** Whether a keydown triggers it, given the Return action setting. */
  matches: (e: KeyboardEvent | React.KeyboardEvent, enterOpens: boolean) => boolean;
  group: "qspace" | "file" | "copy";
};

const mod = (e: KeyboardEvent | React.KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);
const plainEnter = (e: KeyboardEvent | React.KeyboardEvent) => e.key === "Enter" && !e.shiftKey && !e.altKey && !mod(e);
const modEnter = (e: KeyboardEvent | React.KeyboardEvent) => e.key === "Enter" && mod(e) && !e.shiftKey;

export const shift = isMac ? "⇧" : "Shift";
export const alt = isMac ? "⌥" : "Alt";

export function actionDefs(enterOpens: boolean): ActionDef[] {
  return [
    {
      id: "reveal",
      label: "在 QSpace 中显示",
      icon: ScanSearch,
      keys: enterOpens ? [modKey, "↵"] : ["↵"],
      matches: (e, eo) => (eo ? modEnter(e) : plainEnter(e)),
      group: "qspace",
    },
    {
      id: "openInQSpace",
      label: "在 QSpace 中打开文件夹",
      icon: FolderOpen,
      keys: [shift, "↵"],
      matches: (e) => e.key === "Enter" && e.shiftKey && !mod(e),
      group: "qspace",
    },
    {
      id: "open",
      label: "打开",
      icon: SquareArrowOutUpRight,
      keys: enterOpens ? ["↵"] : [modKey, "↵"],
      matches: (e, eo) => (eo ? plainEnter(e) : modEnter(e)),
      group: "file",
    },
    {
      id: "quickLook",
      label: "快速查看",
      icon: Eye,
      keys: [modKey, "Y"],
      matches: (e) => mod(e) && !e.shiftKey && e.key.toLowerCase() === "y",
      group: "file",
    },
    {
      id: "searchHere",
      label: "在此文件夹内搜索",
      icon: FolderSearch,
      keys: [modKey, shift, "F"],
      matches: (e) => mod(e) && e.shiftKey && e.key.toLowerCase() === "f",
      group: "file",
    },
    {
      id: "revealInFinder",
      label: "在访达中显示",
      icon: AppWindow,
      keys: [modKey, alt, "R"],
      matches: (e) => mod(e) && e.altKey && e.code === "KeyR",
      group: "file",
    },
    {
      id: "copyPath",
      label: "复制路径",
      icon: ClipboardCopy,
      keys: [modKey, shift, "C"],
      matches: (e) => mod(e) && e.shiftKey && e.key.toLowerCase() === "c",
      group: "copy",
    },
    {
      id: "copyName",
      label: "复制名称",
      icon: Type,
      keys: [modKey, alt, "C"],
      matches: (e) => mod(e) && e.altKey && e.code === "KeyC",
      group: "copy",
    },
  ];
}
