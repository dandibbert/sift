import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchPanel } from "@/components/search-panel";
import { PreviewDesktop } from "@/components/preview-desktop";
import { PanelFrame, PANEL_MAX } from "@/components/panel-frame";
import { desktop } from "@/lib/api";

export function App() {
  return (
    <TooltipProvider delayDuration={500}>
      {desktop ? (
        // The window is transparent and sized to the panel: the panel is the
        // only thing drawn, and macOS shapes the window's shadow after it.
        <PanelFrame maxHeight={`${PANEL_MAX}px`} className="rounded-[14px] border border-[var(--panel-edge)] bg-panel">
          <SearchPanel />
        </PanelFrame>
      ) : (
        <PreviewDesktop>
          <SearchPanel />
        </PreviewDesktop>
      )}
    </TooltipProvider>
  );
}
