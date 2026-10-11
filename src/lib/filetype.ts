import type { Hit } from "@/lib/api";

export type FileType = "folder" | "app" | "image" | "video" | "audio" | "pdf" | "doc" | "sheet" | "slides" | "code" | "archive" | "text" | "other";

const byExt: Record<string, FileType> = {};
const groups: Record<Exclude<FileType, "folder" | "app" | "other">, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tiff", "tif", "bmp", "svg", "raw", "cr2", "cr3", "nef", "arw", "dng", "psd", "ico", "icns", "avif", "jxl"],
  video: ["mp4", "mov", "m4v", "mkv", "avi", "webm", "wmv", "flv", "mpg", "mpeg", "3gp", "hevc"],
  audio: ["mp3", "m4a", "aac", "wav", "flac", "aiff", "aif", "ogg", "opus", "alac", "caf", "mid", "midi", "m4r"],
  pdf: ["pdf"],
  doc: ["doc", "docx", "pages", "rtf", "odt", "epub", "tex"],
  sheet: ["xls", "xlsx", "numbers", "csv"],
  slides: ["key", "ppt", "pptx"],
  code: ["rs", "c", "h", "cc", "cpp", "hpp", "m", "mm", "swift", "go", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "java", "kt", "rb", "php", "cs", "sh", "zsh", "bash", "fish", "lua", "sql", "html", "css", "scss", "json", "yaml", "yml", "toml", "xml", "vue", "svelte", "zig", "dart", "proto", "graphql", "nix"],
  archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "dmg", "pkg", "iso", "zst"],
  text: ["txt", "md", "markdown", "log", "conf", "ini", "env"],
};
for (const [type, exts] of Object.entries(groups)) for (const e of exts) byExt[e] = type as FileType;

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function fileType(hit: Pick<Hit, "name" | "kind">): FileType {
  const ext = extOf(hit.name);
  if (ext === "app") return "app";
  if (hit.kind === "dir") return "folder";
  return byExt[ext] ?? "other";
}

export const typeLabel: Record<FileType, string> = {
  folder: "文件夹",
  app: "应用",
  image: "图片",
  video: "视频",
  audio: "音频",
  pdf: "PDF 文稿",
  doc: "文稿",
  sheet: "表格",
  slides: "演示文稿",
  code: "代码",
  archive: "压缩包",
  text: "文本",
  other: "文件",
};
