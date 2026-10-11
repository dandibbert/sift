#!/usr/bin/env bash
# Builds the fsearch daemon (github.com/noahdunnagan/fsearch, MIT) as a
# universal macOS binary at build/fsearch/fsearch, for bundling inside
# Sift.app/Contents/MacOS. Skips the build if that file already exists.
#
# On macOS this is plain cargo. On Linux it cross-compiles with zig via
# cargo-zigbuild (pip install ziglang; cargo install cargo-zigbuild).
# The zig target is spelled out per arch so the binaries keep minos 12.0;
# cargo-zigbuild's own linker wrapper produces an invalid target string for
# Apple deployment targets.
set -euo pipefail
cd "$(dirname "$0")/.."

rev=${FSEARCH_REV:-ffcb37d9297e716fcfdcef3169d752fcf18e3b1b}
src=build/fsearch-src
out=build/fsearch/fsearch
[[ -x "$out" && -z "${FSEARCH_REBUILD:-}" ]] && { echo "fsearch: $out (cached)"; exit 0; }

if [[ ! -d "$src/.git" ]]; then
  git clone -q https://github.com/noahdunnagan/fsearch "$src"
fi
git -C "$src" fetch -q origin "$rev" 2>/dev/null || true
git -C "$src" checkout -q "$rev"

export MACOSX_DEPLOYMENT_TARGET=12.0
# The upstream .cargo/config sets target-cpu=native, which means nothing
# when cross-compiling and breaks the x86_64 slice on Apple silicon.
export CARGO_TARGET_AARCH64_APPLE_DARWIN_RUSTFLAGS="-C target-cpu=apple-m1"
export CARGO_TARGET_X86_64_APPLE_DARWIN_RUSTFLAGS="-C target-cpu=x86-64-v2"
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

if [[ "$(uname)" != Darwin ]]; then
  zigbuild=$(command -v cargo-zigbuild) || { echo "cargo-zigbuild is needed on $(uname)" >&2; exit 1; }
  wrappers=$(mktemp -d)
  trap 'rm -rf "$wrappers"' EXIT
  for arch in aarch64 x86_64; do
    cpu=""; [[ $arch == aarch64 ]] && cpu="'-mcpu=apple_m1'"
    cat > "$wrappers/$arch.sh" <<EOF
#!/bin/sh
export CARGO_ZIGBUILD_ZIG_VERSION=\${CARGO_ZIGBUILD_ZIG_VERSION:-0.17.0}
export CARGO_ZIGBUILD_ZIG_COMMAND=\${CARGO_ZIGBUILD_ZIG_COMMAND:-$(command -v python3)}
export CARGO_ZIGBUILD_ZIG_COMMAND_ARGS=\${CARGO_ZIGBUILD_ZIG_COMMAND_ARGS:--m ziglang}
exec "$zigbuild" zig cc -- -g '-fno-sanitize=all' $cpu -target $arch-macos.12.0-none "\$@"
EOF
    chmod +x "$wrappers/$arch.sh"
  done
  export CARGO_TARGET_AARCH64_APPLE_DARWIN_LINKER=$wrappers/aarch64.sh
  export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER=$wrappers/x86_64.sh
fi

(cd "$src" && cargo build -q --release --locked --target aarch64-apple-darwin --target x86_64-apple-darwin)

mkdir -p "$(dirname "$out")"
arm=$src/target/aarch64-apple-darwin/release/fsearch
x64=$src/target/x86_64-apple-darwin/release/fsearch
if command -v lipo >/dev/null; then
  lipo -create -output "$out" "$arm" "$x64"
else
  python3 scripts/lipo.py "$out" "$arm" "$x64"
fi
chmod +x "$out"
cp "$src/LICENSE"* "$(dirname "$out")/" 2>/dev/null || true
echo "fsearch: $out"
