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

const syntax: Array<[string, string]> = [
  ["mian.rs", "容错匹配，打错一个字母也能找到 main.rs"],
  ["ext:pdf 合同", "按扩展名"],
  ["type:image mtime:<7d", "类型：image video audio doc code archive app"],
  ["size:>1gb", "按大小，单位 kb mb gb"],
  ["in:~/Developer", "只在某个文件夹里找"],
  ["^IMG_ !heic", "^ 开头，$ 结尾，! 排除"],
  ["grep:TODO ext:md", "在文件内容里找，Tab 切换到内容模式也可以"],
];

function EngineStatus({ status }: { status: Status | null }) {
  const box = "mt-2 flex items-start gap-2 rounded-[10px] border border-border bg-foreground/[0.02] p-3 text-[12px] leading-5 text-muted-foreground";
  if (!status) {
    return (
      <div className={box}>
        <Loader2 className="mt-[3px] size-3.5 shrink-0 animate-spin" /> 正在连接…
      </div>
    );
  }
  if (status.engine !== "fsearch") {
    return (
      <div className={box}>
        <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-warn" />
        <span>
          {desktop
            ? `${status.message.startsWith("fsearch 不可用") ? status.message : "fsearch 没能启动，正在使用内置索引"}，只覆盖个人文件夹。Sift 会在后台自动重试。`
            : "浏览器预览使用内置索引搜索示例文件夹；桌面版自带 fsearch，索引整块磁盘。"}
        </span>
      </div>
    );
  }
  if (!status.ready) {
    return (
      <div className={box}>
        <Loader2 className="mt-[3px] size-3.5 shrink-0 animate-spin" />
        <span>{status.message || "正在建立索引…"}</span>
      </div>
    );
  }
  return (
    <div className={cn(box, "flex-col gap-2")}>
      <div className="flex items-start gap-2">
        <CircleCheck className="mt-[3px] size-3.5 shrink-0 text-ok" />
        <span>
          fsearch 已索引 <span className="tabular text-foreground">{formatCount(status.entries)}</span> 个项目，通过 FSEvents 实时更新
          {status.fullDiskAccess && status.message ? `。${status.message}` : ""}
        </span>
      </div>
      {!status.fullDiskAccess && (
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <span>没有完全磁盘访问权限，“邮件”“信息”等受保护的文件夹不会被搜索。在列表中打开 Sift 后，按提示重新打开它即可。</span>
            {desktop && (
              <Button variant="outline" size="sm" className="mt-2 h-7 text-[12px]" onClick={() => api.openFullDiskAccess()}>
                打开“完全磁盘访问权限”
              </Button>
            )}
          </div>
        </div>
      )}
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
              <EngineStatus status={status} />
            </div>
            <div className="py-3">
              <div className="text-[13px] font-medium text-foreground">搜索写法</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] leading-5">
                {syntax.map(([q, text]) => (
                  <div key={q} className="contents">
                    <dt>
                      <code className="font-mono text-[11.5px] text-foreground/90">{q}</code>
                    </dt>
                    <dd className="text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
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
