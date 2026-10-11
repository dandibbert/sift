import { Settings2 } from "lucide-react";
import type { Result, Status } from "@/lib/api";
import { Keys } from "@/components/keys";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount, formatTook, modKey } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatusFooter({
  status,
  result,
  count,
  primaryLabel,
  hasSelection,
  onActions,
  onSettings,
  actionsAnchor,
}: {
  status: Status | null;
  result: Result | null;
  count: number;
  primaryLabel: string;
  hasSelection: boolean;
  onActions: () => void;
  onSettings: () => void;
  actionsAnchor: (node: React.ReactNode) => React.ReactNode;
}) {
  const fsearch = status?.engine === "fsearch";
  const degraded = !status || !status.ready || !fsearch || Boolean(status.message);
  const engineLabel = !status ? "正在连接…" : fsearch ? "fsearch" : "内置索引";

  return (
    <footer className="flex h-10 shrink-0 items-center gap-3 border-t border-border bg-foreground/[0.018] pr-2 pl-4 text-[11.5px] text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex size-2 shrink-0">
              {status && !status.ready && <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-60" />}
              <span className={cn("relative inline-flex size-2 rounded-full", !status ? "bg-faint-foreground" : degraded ? "bg-warn" : "bg-ok")} />
            </span>
            <span className="font-medium text-foreground/80">{engineLabel}</span>
            {status && status.entries > 0 && <span className="tabular text-faint-foreground">{formatCount(status.entries)} 项</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[320px] text-[12px] leading-5">
          {status?.message || (fsearch ? "已连接 fsearch 守护进程，索引通过 FSEvents 实时更新" : "正在启动搜索引擎")}
        </TooltipContent>
      </Tooltip>

      {result && (
        <span className="tabular text-faint-foreground">
          · {count} 个结果{result.partial ? "（部分）" : ""} · {formatTook(result.tookUs)}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {hasSelection && (
          <span className="mr-2 flex items-center gap-1.5 text-foreground/80">
            {primaryLabel} <Keys keys={["↵"]} />
          </span>
        )}
        {hasSelection && <span className="mr-1 h-3.5 w-px bg-border" />}
        {actionsAnchor(
          <button type="button" disabled={!hasSelection} onMouseDown={(e) => e.preventDefault()} onClick={onActions} className="flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            操作 <Keys keys={[modKey, "K"]} />
          </button>,
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="设置" onMouseDown={(e) => e.preventDefault()} onClick={onSettings} className="grid size-7 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Settings2 className="size-4" strokeWidth={1.7} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-[12px]">
            设置 <Keys keys={[modKey, ","]} />
          </TooltipContent>
        </Tooltip>
      </div>
    </footer>
  );
}
