#!/usr/bin/env bash
# Builds Sift.app for macOS (arm64 + x86_64) and packs it for download:
#   build/release/Sift-<version>.dmg        open, drag Sift to Applications
#   build/release/Sift-<version>-macOS.zip  the same app, zipped
#
# On macOS `bun run build` already signs the app and makes a disk image;
# this script does the same from Linux, ad-hoc signing with rcodesign
# (github.com/indygreg/apple-platform-rs) and writing the image with
# genisoimage. Without a Developer ID, Gatekeeper asks once before the
# first launch (see 首次打开请看.txt).
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(sed -n 's/^  version: "\(.*\)",$/\1/p' mygo.config.ts)
out=build/release
app=build/darwin-universal/Sift.app

scripts/build-fsearch.sh
bunx mygo build -platform darwin/universal

# The fsearch daemon ships next to the Sift binary; Sift starts it on
# launch and stops it on quit. It has to be in place before signing.
install -m 755 build/fsearch/fsearch "$app/Contents/MacOS/fsearch"
mkdir -p "$app/Contents/Resources/licenses"
cp build/fsearch/LICENSE "$app/Contents/Resources/licenses/fsearch-LICENSE.txt"

if [[ "$(uname)" == Darwin ]]; then
  codesign --force --deep --sign "${SIFT_SIGN_IDENTITY:--}" "$app"
else
  command -v rcodesign >/dev/null || { echo "rcodesign is needed to sign on $(uname)" >&2; exit 1; }
  rcodesign sign "$app"
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -a "$app" "$stage/"
ln -s /Applications "$stage/Applications"
cp scripts/first-launch.txt "$stage/首次打开请看.txt"

mkdir -p "$out"
rm -f "$out/Sift-$version.dmg" "$out/Sift-$version-macOS.zip"
if [[ "$(uname)" == Darwin ]]; then
  hdiutil create -volname Sift -srcfolder "$stage" -ov -format UDZO "$out/Sift-$version.dmg"
else
  genisoimage -quiet -V Sift -D -R -no-pad -o "$out/Sift-$version.dmg" "$stage"
fi
(cd "$stage" && zip -qry - Sift.app) > "$out/Sift-$version-macOS.zip"
ls -lh "$out"
