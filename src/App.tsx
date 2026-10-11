import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchPanel } from "@/components/search-panel";
import { PreviewDesktop } from "@/components/preview-desktop";
import { desktop } from "@/lib/api";

export function App() {
  return (
    <TooltipProvider delayDuration={500}>
      {desktop ? (
        // The window is transparent: the panel is the only thing drawn, and
        // macOS shapes the window's shadow after it.
        <div className="h-full overflow-hidden rounded-[14px] border border-[var(--panel-edge)] bg-panel">
          <SearchPanel />
        </div>
      ) : (
        <PreviewDesktop>
          <SearchPanel />
        </PreviewDesktop>
      )}
    </TooltipProvider>
  );
}
