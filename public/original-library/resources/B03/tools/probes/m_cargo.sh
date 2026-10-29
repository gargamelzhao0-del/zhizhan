#!/usr/bin/env bash
# B03 · Cargo 工程探针：真实 cortex-m-rt 固件的构建与体积
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
DEMO="$HERE/../cargo-demo"
cd "$DEMO"
banner "B03 · Cargo 工程：最小 cortex-m-rt 固件（cargo + rustc 1.99 / Arm GNU 13.3.1）"
printf '%s\n' '$ cargo build --release --locked'
cargo build --release --locked
ELF="target/thumbv7m-none-eabi/release/minirs"
"$SIZE" "$ELF"
printf '\n  ── 关键符号（按体积）──\n'
"$NM" --size-sort --demangle "$ELF" | sed 's/^/      /' || true
printf '\n  ── 复位入口（向量表指向 Reset → 最终进 main）──\n'
"$OBJDUMP" -d --demangle "$ELF" | sed -n '/<Reset>:/,/^$/p' | head -12 | sed 's/^/      /' || true
