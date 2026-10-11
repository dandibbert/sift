#!/usr/bin/env bash
# Builds a small, realistic home folder to search in the browser preview:
#   scripts/make-sample-home.sh /tmp/sift-sample
#   go run ./cmd/sift-preview -root /tmp/sift-sample -no-fsearch
set -euo pipefail
root="${1:-/tmp/sift-sample}"
rm -rf "$root"
mkdir -p "$root"
cd "$root"

touchf() { # touchf <days ago> <bytes> <path> [content]
  local days="$1" bytes="$2" path="$3" content="${4:-}"
  mkdir -p "$(dirname "$path")"
  if [ -n "$content" ]; then
    printf '%s\n' "$content" > "$path"
  else
    head -c "$bytes" /dev/zero > "$path"
  fi
  touch -d "-${days} days" "$path"
}

touchf 0 0 "Documents/Projects/Atlas/README.md" "# Atlas
Quarterly roadmap for the Atlas sync engine.
TODO: finalize the conflict resolution design before Q3 review."
touchf 1 0 "Documents/Projects/Atlas/design/conflict-resolution.md" "## Conflict resolution
We pick last-writer-wins per field, with vector clocks for ordering.
Open question: how to surface conflicts in the QSpace sidebar."
touchf 3 0 "Documents/Projects/Atlas/src/main.rs" "fn main() {
    let engine = atlas::Engine::start();
    engine.apply_dir(\"~/Sync\");
}"
touchf 3 0 "Documents/Projects/Atlas/src/engine.rs" "pub fn apply_dir(path: &str) -> Result<()> {
    // walk and apply changes
    Ok(())
}"
touchf 5 0 "Documents/Projects/Atlas/Cargo.toml" "[package]
name = \"atlas\"
version = \"0.4.0\""
touchf 2 0 "Documents/Projects/Lumen/package.json" '{ "name": "lumen", "version": "1.2.0" }'
touchf 2 0 "Documents/Projects/Lumen/src/App.tsx" "export function App() { return <SearchPanel quarterly={true} /> }"
touchf 9 0 "Documents/Projects/Lumen/src/search-panel.tsx" "export function SearchPanel() { /* fuzzy search UI */ }"
touchf 0 0 "Documents/Notes/2026-10-周会纪要.md" "# 周会纪要
- 确认 Q4 季度报告的交付时间
- QSpace 搜索伴侣原型评审"
touchf 4 0 "Documents/Notes/读书笔记-设计心理学.md" "日常物品的设计应当让人一眼看懂如何使用。"
touchf 12 0 "Documents/Notes/meeting-notes-quarterly-review.md" "Quarterly review: revenue up 18%, churn flat."
touchf 1 2400000 "Documents/Finance/2026 Q3 季度报告.pdf"
touchf 20 1800000 "Documents/Finance/Invoice-2026-08-Acme.pdf"
touchf 40 920000 "Documents/Finance/年度预算.xlsx"
touchf 6 5400000 "Documents/Contracts/租赁合同-扫描件.pdf"
touchf 15 64000 "Documents/Resume - Lin Chen.docx"
touchf 0 4200000 "Desktop/Screenshot 2026-10-11 at 09.12.44.png"
touchf 2 3100000 "Desktop/Screenshot 2026-10-09 at 18.40.02.png"
touchf 7 880000 "Desktop/whiteboard-sketch.heic"
touchf 30 12000 "Desktop/todo.txt" "buy milk
renew passport
send quarterly report to Mia"
touchf 3 24000000 "Pictures/Travel/Kyoto/IMG_2041.HEIC"
touchf 3 26000000 "Pictures/Travel/Kyoto/IMG_2042.HEIC"
touchf 3 21000000 "Pictures/Travel/Kyoto/IMG_2057.HEIC"
touchf 60 3600000 "Pictures/Wallpapers/aurora-borealis-5k.jpg"
touchf 60 2900000 "Pictures/Wallpapers/dunes-at-dusk.webp"
touchf 10 180000 "Pictures/Brand/sift-logo.svg"
touchf 8 740000000 "Movies/Screen Recording 2026-10-03.mov"
touchf 90 1300000000 "Movies/Kyoto-trip-edit-final.mp4"
touchf 14 8200000 "Music/Lo-fi/rainy-afternoon.flac"
touchf 14 6100000 "Music/Lo-fi/late-night-coding.mp3"
touchf 1 98000000 "Downloads/QSpace-Pro-4.2.dmg"
touchf 2 45000000 "Downloads/fsearch-main.zip"
touchf 5 1200000 "Downloads/Figma-Export-Icons.zip"
touchf 0 340000 "Downloads/boarding-pass-PEK-KIX.pdf"
touchf 25 2100000 "Downloads/设计规范-v3.pdf"
touchf 4 0 "Developer/dotfiles/zshrc" "export PATH=\$HOME/.local/bin:\$PATH
alias fs='fsearch'"
touchf 4 0 "Developer/dotfiles/install.sh" "#!/bin/sh
ln -sf ~/Developer/dotfiles/zshrc ~/.zshrc"
touchf 6 0 "Developer/sift/main.go" "package main
// Sift is a search window for QSpace."
touchf 6 0 "Developer/sift/internal/search/fsearch.go" "func (f *Fsearch) Search(ctx context.Context, req Request) (Result, error)"
mkdir -p "Applications/QSpace Pro.app/Contents" "Applications/Figma.app/Contents"
touch -d "-30 days" "Applications/QSpace Pro.app" "Applications/Figma.app"
echo "Sample home ready at $root"
