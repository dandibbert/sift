import { cn } from "@/lib/utils";

export type SearchMode = "name" | "content";

const modes: Array<{ id: SearchMode; label: string }> = [
  { id: "name", label: "文件名" },
  { id: "content", label: "内容" },
];

export function ModeSwitch({ mode, onChange }: { mode: SearchMode; onChange: (m: SearchMode) => void }) {
  return (
    <div role="tablist" aria-label="搜索模式" className="relative flex h-7 shrink-0 items-center rounded-[8px] bg-foreground/[0.055] p-[3px] text-[12px]">
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-[6px] bg-background shadow-[0_1px_2px_oklch(0_0_0/0.12),0_0_0_0.5px_oklch(0_0_0/0.06)] transition-transform duration-200 ease-[cubic-bezier(0.3,0.9,0.3,1)] dark:bg-white/[0.12] dark:shadow-[0_1px_2px_oklch(0_0_0/0.4)]"
        style={{ transform: mode === "content" ? "translateX(100%)" : "translateX(0)" }}
      />
      {modes.map((m) => (
        <button
          key={m.id}
          role="tab"
          type="button"
          tabIndex={-1}
          aria-selected={mode === m.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(m.id)}
          className={cn("relative z-10 w-12 rounded-[6px] font-medium transition-colors", mode === m.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
