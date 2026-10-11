import { FileSearch, FilterX, SearchX, TextSearch, TriangleAlert } from "lucide-react";
import { Keys } from "@/components/keys";
import { modKey } from "@/lib/format";

const tips: Array<{ q: string; text: string; mode?: "content" }> = [
  { q: "mian.rs", text: "打错一个字也能找到 main.rs" },
  { q: "type:image mtime:<7d", text: "最近一周的图片" },
  { q: "ext:pdf 合同", text: "名字里有“合同”的 PDF" },
  { q: "size:>1gb", text: "占空间的大文件" },
  { q: "^IMG_ !heic", text: "IMG_ 开头，排除 HEIC" },
  { q: "grep:TODO ext:md", text: "在 Markdown 里找 TODO" },
];

export function SyntaxTips({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section className="px-4 pt-1 pb-3">
      <h3 className="px-1 pb-2 text-[11px] font-medium tracking-wide text-faint-foreground">试试这些写法</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {tips.map((t) => (
          <button
            key={t.q}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(t.q)}
            className="group flex min-w-0 flex-col items-start gap-1 rounded-[10px] border border-border/80 px-3 py-2.5 text-left transition-colors hover:border-foreground/12 hover:bg-accent"
          >
            <code className="truncate font-mono text-[12px] text-foreground/90">{t.q}</code>
            <span className="truncate text-[11.5px] text-muted-foreground">{t.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Welcome({ hotkey }: { hotkey: string }) {
  return (
    <div className="flex flex-col items-center px-8 pt-7 pb-5 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-[12px] border border-border bg-foreground/[0.035]">
        <FileSearch className="size-5 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <p className="text-[13.5px] font-medium text-foreground">输入文件名开始搜索</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        随时按 <Keys keys={hotkey.split("+")} /> 唤起，找到后按 <Keys keys={["↵"]} /> 交给 QSpace
      </p>
    </div>
  );
}

export function ContentIntro() {
  return (
    <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-[12px] border border-border bg-foreground/[0.035]">
        <TextSearch className="size-5 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <p className="text-[13.5px] font-medium text-foreground">在文件内容里查找</p>
      <p className="mt-1 max-w-[380px] text-[12px] leading-5 text-muted-foreground">
        输入要找的文字，可配合过滤器缩小范围，例如 <code className="font-mono text-foreground/80">ext:md 季度报告</code>。大写字母会区分大小写。
      </p>
    </div>
  );
}

export function NoResults({ query, mode, hasFilters, onSwitchMode, onClearFilters }: { query: string; mode: "name" | "content"; hasFilters: boolean; onSwitchMode: () => void; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center px-8 pt-12 pb-8 text-center">
      <SearchX className="mb-3 size-7 text-faint-foreground" strokeWidth={1.5} />
      <p className="max-w-[440px] truncate text-[13.5px] font-medium text-foreground">
        没有找到{query ? `“${query}”` : "符合条件的文件"}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{mode === "name" ? "换个关键词，或者在文件内容里找找看" : "试试更短的关键词，或放宽过滤条件"}</p>
      <div className="mt-4 flex gap-2">
        {mode === "name" && query && (
          <button type="button" onClick={onSwitchMode} className="flex h-7 items-center gap-2 rounded-[8px] border border-border px-2.5 text-[12px] text-foreground/90 hover:bg-accent">
            <TextSearch className="size-3.5" /> 搜索文件内容 <Keys keys={["Tab"]} />
          </button>
        )}
        {hasFilters && (
          <button type="button" onClick={onClearFilters} className="flex h-7 items-center gap-2 rounded-[8px] border border-border px-2.5 text-[12px] text-foreground/90 hover:bg-accent">
            <FilterX className="size-3.5" /> 清除过滤器
          </button>
        )}
      </div>
    </div>
  );
}

export function QueryError({ message }: { message: string }) {
  return (
    <div className="mx-4 mt-1 mb-2 flex items-start gap-2 rounded-[10px] border border-destructive/25 bg-destructive/[0.07] px-3 py-2 text-[12px] text-destructive">
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

export function SettingsHint() {
  return (
    <span className="flex items-center gap-1">
      设置 <Keys keys={[modKey, ","]} />
    </span>
  );
}
