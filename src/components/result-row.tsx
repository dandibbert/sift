import { memo } from "react";
import type { Hit } from "@/lib/api";
import { FileGlyph } from "@/components/file-glyph";
import { Highlighted } from "@/components/highlighted";
import { formatAge, formatSize, pathSegments } from "@/lib/format";
import { matchRanges, patternRanges } from "@/lib/highlight";
import { cn } from "@/lib/utils";

type Props = {
  hit: Hit;
  selected: boolean;
  words: string[];
  pattern: string;
  home: string;
  onSelect: () => void;
  onActivate: () => void;
};

export const ResultRow = memo(function ResultRow({ hit, selected, words, pattern, home, onSelect, onActivate }: Props) {
  const segments = pathSegments(hit.dir, home);
  const matches = hit.matches ?? [];
  return (
    <div
      role="option"
      aria-selected={selected}
      data-path={hit.path}
      onMouseMove={selected ? undefined : onSelect}
      onMouseDown={onSelect}
      onDoubleClick={onActivate}
      className={cn(
        "group relative mx-2 flex gap-3 rounded-[10px] px-3 py-2 transition-colors duration-75",
        matches.length ? "items-start" : "items-center",
        selected ? "bg-selected shadow-[inset_0_0_0_0.5px_var(--selected-edge)]" : "hover:bg-accent/50",
      )}
    >
      <FileGlyph hit={hit} className={matches.length ? "mt-0.5" : undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] leading-5 font-medium tracking-[-0.005em] text-foreground">
            <Highlighted text={hit.name} ranges={matchRanges(hit.name, words)} />
          </span>
        </div>
        <div className="flex min-w-0 items-center text-[11.5px] leading-4 text-muted-foreground">
          {segments.map((s, i) => (
            <span key={i} className={cn("flex min-w-0 items-center", i === segments.length - 1 ? "truncate" : "shrink-0")}>
              {i > 0 && <span className="px-[3px] text-faint-foreground/70">/</span>}
              <span className={cn(i === segments.length - 1 && "truncate", s === "…" && "text-faint-foreground")}>{s}</span>
            </span>
          ))}
        </div>
        {matches.length > 0 && (
          <div className="mt-1.5 space-y-px overflow-hidden rounded-md border border-border/70 bg-black/[0.025] py-1 font-mono text-[11.5px] leading-[18px] dark:bg-white/[0.025]">
            {matches.map((m) => (
              <div key={m.line} className="flex min-w-0 gap-2.5 px-2">
                <span className="w-7 shrink-0 text-right tabular text-faint-foreground">{m.line}</span>
                <span className="truncate text-muted-foreground">
                  <Highlighted text={m.text} ranges={patternRanges(m.text, pattern)} markClassName="text-highlight bg-highlight-bg! rounded-[3px] px-px" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={cn("flex w-[150px] shrink-0 items-center justify-end gap-3 text-[11.5px] tabular text-faint-foreground @max-[560px]:hidden", matches.length && "pt-0.5", selected && "text-muted-foreground")}>
        {hit.kind !== "dir" && hit.size > 0 && <span>{formatSize(hit.size)}</span>}
        <span className="w-[78px] text-right">{formatAge(hit.mtime)}</span>
      </div>
    </div>
  );
});
