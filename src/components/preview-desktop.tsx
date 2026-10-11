import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Keys } from "@/components/keys";

/**
 * The browser preview's stand-in for the Mac desktop: a menu bar and a
 * QSpace window behind the search panel, so the page is judged where it
 * will live.
 */
export function PreviewDesktop({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const clock = `${now.getMonth() + 1}月${now.getDate()}日 ${new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(now)} ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now)}`;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[oklch(0.86_0.02_250)] dark:bg-[oklch(0.16_0.01_260)]">
      {/* Wallpaper: soft light falling across a graphite field. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-90 dark:opacity-100"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 10%, oklch(0.78 0.06 240 / 0.55), transparent 60%), radial-gradient(90% 70% at 90% 85%, oklch(0.75 0.08 60 / 0.35), transparent 60%), radial-gradient(70% 60% at 60% 30%, oklch(0.6 0.05 200 / 0.25), transparent 70%)",
        }}
      />
      <div aria-hidden className="absolute inset-0 hidden dark:block" style={{ background: "radial-gradient(120% 80% at 15% 0%, oklch(0.32 0.04 250 / 0.9), transparent 60%), radial-gradient(80% 70% at 95% 95%, oklch(0.3 0.05 50 / 0.55), transparent 60%)" }} />
      <div aria-hidden className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />

      {/* Menu bar */}
      <div className="relative z-10 flex h-7 items-center gap-5 bg-white/35 px-4 text-[12.5px] text-black/80 backdrop-blur-xl dark:bg-black/30 dark:text-white/85">
        <span className="font-semibold">QSpace Pro</span>
        <span className="hidden sm:inline">文件</span>
        <span className="hidden sm:inline">编辑</span>
        <span className="hidden sm:inline">显示</span>
        <span className="hidden sm:inline">前往</span>
        <span className="hidden sm:inline">窗口</span>
        <div className="ml-auto flex items-center gap-4">
          <Search className="size-3.5" strokeWidth={2.4} />
          <span className="tabular">{clock}</span>
        </div>
      </div>

      {/* A QSpace window, out of focus behind the panel. */}
      <div aria-hidden className="absolute top-[11%] left-1/2 hidden w-[min(1080px,92vw)] -translate-x-1/2 md:block">
        <div className="h-[min(640px,74vh)] overflow-hidden rounded-[12px] border border-black/10 bg-white/80 shadow-[0_30px_80px_-20px_oklch(0_0_0/0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[oklch(0.22_0.005_270/0.85)]">
          <div className="flex h-10 items-center gap-2 border-b border-black/5 px-4 dark:border-white/5">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
            <span className="ml-4 h-2.5 w-40 rounded-full bg-black/8 dark:bg-white/8" />
          </div>
          <div className="flex h-full">
            <div className="w-48 space-y-2.5 border-r border-black/5 p-4 dark:border-white/5">
              {[64, 48, 72, 56, 40, 60, 52].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-[4px] bg-[oklch(0.72_0.11_245/0.6)]" />
                  <span className="h-2 rounded-full bg-black/10 dark:bg-white/10" style={{ width: w }} />
                </div>
              ))}
            </div>
            {[0, 1].map((pane) => (
              <div key={pane} className="flex-1 space-y-3 border-r border-black/5 p-4 dark:border-white/5">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="size-4 rounded-[4px] bg-black/10 dark:bg-white/10" />
                    <span className="h-2 rounded-full bg-black/10 dark:bg-white/10" style={{ width: `${30 + ((i * 37 + pane * 13) % 45)}%` }} />
                    <span className="ml-auto h-2 w-10 rounded-full bg-black/5 dark:bg-white/5" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="absolute inset-0 bg-black/10 dark:bg-black/25" />

      <div className="relative z-10 flex flex-col items-center px-3 pt-[9vh] sm:pt-[14vh]">
        <div className="animate-panel-in h-[min(540px,calc(100dvh-140px))] w-full max-w-[760px] overflow-hidden rounded-[16px] border border-[var(--panel-edge)] bg-panel shadow-[var(--shadow-panel)] backdrop-blur-2xl backdrop-saturate-150">
          {children}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-black/55 dark:text-white/45">
          浏览器预览 · 桌面版里这是按 <Keys keys={["⌘", "⇧", "Space"]} className="opacity-80" /> 唤起的浮动窗口
        </p>
      </div>
    </div>
  );
}
