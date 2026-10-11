import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Keyboard, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Keys } from "@/components/keys";
import { api, desktop, errorMessage, type QSpace, type Settings, type Status } from "@/lib/api";
import { acceleratorFromEvent, hotkeyKeys } from "@/lib/hotkey";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        {hint && <div className="mt-0.5 text-[11.5px] leading-[18px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function HotkeyRecorder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") return setRecording(false);
        const acc = acceleratorFromEvent(e);
        if (acc) {
          onChange(acc);
          setRecording(false);
        }
      }}
      className={cn(
        "flex h-8 min-w-[148px] items-center justify-center gap-2 rounded-[8px] border px-3 text-[12px] transition-colors outline-none",
        recording ? "border-foreground/25 bg-foreground/[0.06] text-foreground ring-3 ring-ring/40" : "border-border hover:bg-accent",
      )}
    >
      {recording ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Keyboard className="size-3.5" /> 按下新的组合键…
        </span>
      ) : (
        <Keys keys={hotkeyKeys(value)} />
      )}
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex h-8 rounded-[8px] bg-foreground/[0.055] p-[3px] text-[12px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn("rounded-[6px] px-2.5 font-medium transition-colors", value === o.id ? "bg-background text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.12)] dark:bg-white/[0.12]" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange, status, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; status: Status | null; onSaved: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [qspace, setQSpace] = useState<QSpace | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.settings().then(setDraft).catch((e) => setError(errorMessage(e)));
    api.qspace().then(setQSpace).catch(() => setQSpace(null));
  }, [open]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const s = await api.saveSettings(draft);
      onSaved(s);
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const fsearch = status?.engine === "fsearch";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100%-32px)] gap-0 overflow-y-auto p-0 sm:max-w-[520px] scrollbar-quiet" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle className="text-[15px]">设置</DialogTitle>
          <DialogDescription className="text-[12px]">Sift 在后台常驻，按快捷键唤起，找到文件后交给 QSpace。</DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="grid h-48 place-items-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-border px-5">
            <Row title="唤起快捷键" hint="在任何应用里（包括 QSpace）按下即可打开搜索窗口">
              <HotkeyRecorder value={draft.hotkey} onChange={(hotkey) => setDraft({ ...draft, hotkey })} />
            </Row>
            <Row title="回车键" hint="另一个操作改用 ⌘↵">
              <Segmented
                value={draft.enterAction === "open" ? "open" : "reveal"}
                options={[
                  { id: "reveal", label: "在 QSpace 中显示" },
                  { id: "open", label: "直接打开" },
                ]}
                onChange={(enterAction) => setDraft({ ...draft, enterAction })}
              />
            </Row>
            <Row title="失去焦点时隐藏" hint="切换到其他窗口时自动收起，像 Spotlight 一样">
              <Switch checked={draft.hideOnBlur} onCheckedChange={(hideOnBlur) => setDraft({ ...draft, hideOnBlur })} />
            </Row>
            <div className="py-3">
              <div className="text-[13px] font-medium text-foreground">QSpace</div>
              <div className="mt-2 rounded-[10px] border border-border bg-foreground/[0.02] p-3 text-[12px] leading-5">
                {qspace?.installed ? (
                  <>
                    <div className="flex items-center gap-2 text-foreground">
                      <CircleCheck className="size-3.5 text-ok" /> 已找到 <span className="truncate font-mono text-[11.5px] text-muted-foreground">{qspace.app}</span>
                    </div>
                    <div className="mt-1 flex items-start gap-2 text-muted-foreground">
                      {qspace.defaultViewer ? (
                        <>
                          <CircleCheck className="mt-[3px] size-3.5 shrink-0 text-ok" /> QSpace 是默认文件管理器，“在 QSpace 中显示”会直接选中文件
                        </>
                      ) : (
                        <>
                          <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-warn" />
                          <span>
                            QSpace 还不是默认文件管理器，“显示”时只会打开所在文件夹。在 QSpace 设置中开启“设为默认文件管理器”后即可自动选中。
                          </span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-warn" />
                    {desktop ? "没有在“应用程序”中找到 QSpace，可以在下面填写它的位置。" : "浏览器预览无法访问 QSpace，桌面版会自动检测。"}
                  </div>
                )}
                <Input
                  value={draft.qspaceApp}
                  onChange={(e) => setDraft({ ...draft, qspaceApp: e.target.value })}
                  placeholder="/Applications/QSpace Pro.app（留空自动检测）"
                  className="mt-2.5 h-8 font-mono text-[11.5px]"
                />
              </div>
            </div>
            <div className="py-3">
              <div className="text-[13px] font-medium text-foreground">搜索引擎</div>
              <div className="mt-2 rounded-[10px] border border-border bg-foreground/[0.02] p-3 text-[12px] leading-5 text-muted-foreground">
                {fsearch ? (
                  <div className="flex items-start gap-2">
                    <CircleCheck className="mt-[3px] size-3.5 shrink-0 text-ok" />
                    <span>
                      已连接 fsearch，索引了 <span className="tabular text-foreground">{formatCount(status?.entries ?? 0)}</span> 个项目
                      {status?.message ? `。${status.message}` : "，通过 FSEvents 实时更新。"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-warn" />
                    <span>
                      {status?.message || "未连接 fsearch"}。安装后会自动切换：
                      <code className="mt-1.5 block rounded-md bg-foreground/[0.05] px-2 py-1.5 font-mono text-[11px] text-foreground/85">
                        git clone https://github.com/noahdunnagan/fsearch
                        <br />
                        cd fsearch && cargo build --release
                        <br />
                        ./target/release/fsearch install --login
                      </code>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {error && <span className="mr-auto truncate text-[12px] text-destructive">{error}</span>}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={save} disabled={!draft || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
