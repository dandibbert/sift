import { useId } from "react";
import { extOf, fileType, type FileType } from "@/lib/filetype";
import type { Hit } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Muted inks per type: distinguishable at a glance, quiet in a list. */
const tint: Record<FileType, string> = {
  folder: "oklch(0.72 0.11 245)",
  app: "oklch(0.68 0.12 255)",
  image: "oklch(0.7 0.11 175)",
  video: "oklch(0.68 0.14 15)",
  audio: "oklch(0.74 0.12 55)",
  pdf: "oklch(0.64 0.17 28)",
  doc: "oklch(0.64 0.12 255)",
  sheet: "oklch(0.66 0.13 150)",
  slides: "oklch(0.72 0.13 65)",
  code: "oklch(0.7 0.09 130)",
  archive: "oklch(0.66 0.04 70)",
  text: "oklch(0.66 0.02 270)",
  other: "oklch(0.64 0.015 270)",
};

export function FileGlyph({ hit, className }: { hit: Pick<Hit, "name" | "kind">; className?: string }) {
  const type = fileType(hit);
  const id = useId();
  const color = tint[type];

  if (type === "folder") {
    return (
      <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.95" />
            <stop offset="1" stopColor={color} stopOpacity="0.78" />
          </linearGradient>
        </defs>
        <path d="M4 9.5A2.5 2.5 0 0 1 6.5 7h6.2c.7 0 1.3.3 1.8.8l1.4 1.5c.4.4 1 .7 1.6.7H25.5A2.5 2.5 0 0 1 28 12.5V23a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 23z" fill={color} opacity="0.55" />
        <path d="M4 13a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v10a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 23z" fill={`url(#${id}f)`} />
        <path d="M4.5 13.2h23" stroke="white" strokeOpacity="0.35" strokeWidth="0.75" />
      </svg>
    );
  }

  if (type === "app") {
    return (
      <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor="oklch(0.5 0.13 265)" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="22" height="22" rx="6" fill={`url(#${id}a)`} />
        <rect x="5.4" y="5.4" width="21.2" height="21.2" rx="5.6" fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="0.8" />
        <path d="M11 12.5h10M11 16h10M11 19.5h6" stroke="white" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  const ext = extOf(hit.name).slice(0, 4).toUpperCase();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <path
        d="M9 4h9.6c.5 0 1 .2 1.4.6l5.4 5.4c.4.4.6.9.6 1.4V26a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        className="fill-white stroke-black/12 dark:fill-[oklch(0.3_0.005_270)] dark:stroke-white/10"
        strokeWidth="0.8"
      />
      <path d="M19 4.3V9a2 2 0 0 0 2 2h4.7" className="fill-black/[0.04] stroke-black/12 dark:fill-white/[0.06] dark:stroke-white/12" strokeWidth="0.8" />
      {ext ? (
        <>
          <rect x="7.4" y="18.5" width="17.2" height="6.4" rx="1.2" fill={color} />
          <text x="16" y="23.15" textAnchor="middle" fontSize={ext.length > 3 ? 4.1 : 4.6} fontWeight="700" fill="white" letterSpacing="0.2" style={{ fontFamily: "var(--font-sans)" }}>
            {ext}
          </text>
        </>
      ) : (
        <path d="M11 15h10M11 18h10M11 21h6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      )}
    </svg>
  );
}
