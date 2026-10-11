import { FilterX, Loader2, SearchX, TextSearch, TriangleAlert } from "lucide-react";
import { Keys } from "@/components/keys";

export function IndexingNotice({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-3 pb-5 text-[12.5px] text-muted-foreground">
      <Loader2 className="size-3.5 shrink-0 animate-spin text-faint-foreground" />
      <span className="truncate">{text || "正在建立索引…"}</span>
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
