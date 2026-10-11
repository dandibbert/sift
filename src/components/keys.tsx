import { cn } from "@/lib/utils";

export function Keys({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("flex items-center gap-[3px]", className)}>
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-border bg-background/70 px-1 font-sans text-[10.5px] leading-none font-medium text-muted-foreground shadow-[0_1px_0_var(--border)]"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
