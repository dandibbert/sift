import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from "@/components/ui/context-menu";
import { Keys } from "@/components/keys";
import { FileGlyph } from "@/components/file-glyph";
import type { ActionDef, ActionId } from "@/lib/actions";
import type { Hit } from "@/lib/api";

const groupOrder: Array<ActionDef["group"]> = ["qspace", "file", "copy"];
const groupLabel: Record<ActionDef["group"], string> = { qspace: "QSpace", file: "文件", copy: "复制" };

export function ActionsMenu({
  open,
  onOpenChange,
  hit,
  actions,
  onRun,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hit: Hit | null;
  actions: ActionDef[];
  onRun: (id: ActionId) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open && hit !== null} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-[300px] overflow-hidden p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
        {hit && (
          <Command loop className="bg-transparent">
            <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
              <FileGlyph hit={hit} className="size-6" />
              <span className="truncate text-[12.5px] font-medium">{hit.name}</span>
            </div>
            <CommandList className="max-h-[340px] p-1">
              <CommandEmpty className="py-6 text-center text-[12px] text-muted-foreground">没有匹配的操作</CommandEmpty>
              {groupOrder.map((g, gi) => (
                <div key={g}>
                  {gi > 0 && <CommandSeparator className="my-1" />}
                  <CommandGroup heading={groupLabel[g]} className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-faint-foreground">
                    {actions
                      .filter((a) => a.group === g)
                      .map((a) => (
                        <CommandItem key={a.id} value={a.label} onSelect={() => onRun(a.id)} className="h-8 gap-2.5 rounded-[7px] text-[13px]">
                          <a.icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
                          <span className="flex-1">{a.label}</span>
                          <Keys keys={a.keys} />
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </div>
              ))}
            </CommandList>
            <div className="border-t border-border">
              <CommandInput placeholder="搜索操作…" className="h-9 text-[12.5px]" />
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function RowContextMenu({ hit, actions, onRun }: { hit: Hit | null; actions: ActionDef[]; onRun: (id: ActionId) => void }) {
  if (!hit) return null;
  return (
    <ContextMenuContent className="w-[288px]" onCloseAutoFocus={(e) => e.preventDefault()}>
      <ContextMenuLabel className="truncate text-[11.5px] font-medium text-faint-foreground">{hit.name}</ContextMenuLabel>
      {groupOrder.map((g, gi) => (
        <div key={g}>
          {gi > 0 && <ContextMenuSeparator />}
          {actions
            .filter((a) => a.group === g)
            .map((a) => (
              <ContextMenuItem key={a.id} onSelect={() => onRun(a.id)} className="gap-2.5 text-[13px] whitespace-nowrap">
                <a.icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
                <span className="flex-1">{a.label}</span>
                <Keys keys={a.keys} />
              </ContextMenuItem>
            ))}
        </div>
      ))}
    </ContextMenuContent>
  );
}
