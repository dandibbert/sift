import { Calendar, Check, ChevronDown, FolderTree, Layers, Ruler, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useOverlay } from "@/lib/overlay";
import type { Filters } from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { displayPath } from "@/lib/format";
import { cn } from "@/lib/utils";

type Option = { label: string; patch: Partial<Filters>; active: (f: Filters) => boolean };

const typeOptions: Option[] = [
  { label: "文件夹", patch: { kind: "dir", type: "" }, active: (f) => f.kind === "dir" },
  { label: "文稿", patch: { type: "doc", kind: "" }, active: (f) => f.type === "doc" },
  { label: "图片", patch: { type: "image", kind: "" }, active: (f) => f.type === "image" },
  { label: "视频", patch: { type: "video", kind: "" }, active: (f) => f.type === "video" },
  { label: "音频", patch: { type: "audio", kind: "" }, active: (f) => f.type === "audio" },
  { label: "代码", patch: { type: "code", kind: "" }, active: (f) => f.type === "code" },
  { label: "压缩包", patch: { type: "archive", kind: "" }, active: (f) => f.type === "archive" },
  { label: "应用", patch: { type: "app", kind: "" }, active: (f) => f.type === "app" },
];

const timeOptions: Option[] = [
  { label: "今天", patch: { modified: "<1d" }, active: (f) => f.modified === "<1d" },
  { label: "最近 7 天", patch: { modified: "<7d" }, active: (f) => f.modified === "<7d" },
  { label: "最近 30 天", patch: { modified: "<30d" }, active: (f) => f.modified === "<30d" },
  { label: "最近一年", patch: { modified: "<365d" }, active: (f) => f.modified === "<365d" },
  { label: "一年以前", patch: { modified: ">365d" }, active: (f) => f.modified === ">365d" },
];

const sizeOptions: Option[] = [
  { label: "小于 100 KB", patch: { size: "<100kb" }, active: (f) => f.size === "<100kb" },
  { label: "大于 1 MB", patch: { size: ">1mb" }, active: (f) => f.size === ">1mb" },
  { label: "大于 100 MB", patch: { size: ">100mb" }, active: (f) => f.size === ">100mb" },
  { label: "大于 1 GB", patch: { size: ">1gb" }, active: (f) => f.size === ">1gb" },
];

function placeOptions(home: string): Option[] {
  const places: Array<[string, string]> = [
    ["文稿", "Documents"],
    ["下载", "Downloads"],
    ["桌面", "Desktop"],
    ["图片", "Pictures"],
    ["开发", "Developer"],
  ];
  return places.map(([label, dir]) => {
    const path = `${home}/${dir}`;
    return { label, patch: { in: path }, active: (f) => f.in === path };
  });
}

function Chip({
  icon: Icon,
  label,
  value,
  options,
  filters,
  clear,
  onChange,
  heading,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  options: Option[];
  filters: Filters;
  clear: Partial<Filters>;
  onChange: (patch: Partial<Filters>) => void;
  heading: string;
}) {
  const active = value !== null;
  const [open, setOpen] = useState(false);
  useOverlay(open);
  return (
    <div className={cn("flex h-[26px] items-center rounded-full border text-[12px] transition-colors", active ? "border-foreground/12 bg-foreground/[0.07] text-foreground" : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground")}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className={cn("flex h-full items-center gap-1.5 rounded-full pl-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "pr-1" : "pr-2")}>
          <Icon className="size-3.5 opacity-70" strokeWidth={1.8} />
          <span className="max-w-[140px] truncate">{value ?? label}</span>
          {!active && <ChevronDown className="size-3 opacity-50" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="min-w-[168px]" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel className="text-[11px] font-medium text-faint-foreground">{heading}</DropdownMenuLabel>
          {options.map((o) => {
            const on = o.active(filters);
            return (
              <DropdownMenuItem key={o.label} onSelect={() => onChange(on ? clear : o.patch)} className="text-[13px]">
                <span className="flex-1">{o.label}</span>
                {on && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>
            );
          })}
          {active && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange(clear)} className="text-[13px] text-muted-foreground">
                清除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button type="button" aria-label={`清除${label}`} onClick={() => onChange(clear)} className="mr-1 grid size-[18px] place-items-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <X className="size-3" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export function FilterBar({ filters, home, onChange }: { filters: Filters; home: string; onChange: (patch: Partial<Filters>) => void }) {
  const places = placeOptions(home);
  const pick = (opts: Option[]) => opts.find((o) => o.active(filters))?.label ?? null;
  const placeValue = filters.in ? (pick(places) ?? displayPath(filters.in, home)) : null;
  const any = Boolean(filters.type || filters.kind || filters.modified || filters.size || filters.in);

  return (
    <div className="flex items-center gap-1.5 px-4 pb-2.5">
      <Chip icon={Layers} label="类型" heading="只看" value={pick(typeOptions)} options={typeOptions} filters={filters} clear={{ type: "", kind: "" }} onChange={onChange} />
      <Chip icon={Calendar} label="修改时间" heading="修改于" value={pick(timeOptions)} options={timeOptions} filters={filters} clear={{ modified: "" }} onChange={onChange} />
      <Chip icon={Ruler} label="大小" heading="文件大小" value={pick(sizeOptions)} options={sizeOptions} filters={filters} clear={{ size: "" }} onChange={onChange} />
      <Chip icon={FolderTree} label="位置" heading="搜索范围" value={placeValue} options={places} filters={filters} clear={{ in: "" }} onChange={onChange} />
      {any && (
        <button type="button" onClick={() => onChange({ type: "", kind: "", modified: "", size: "", in: "" })} className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-faint-foreground hover:text-foreground">
          全部清除
        </button>
      )}
    </div>
  );
}
