#!/usr/bin/env bash
# B02 · 全部实测探针一键复跑
# ============================================================================
# 站内每个 .term 块的内容都出自这里。复跑方法：
#
#     bash tools/probes/run-all.sh
#
# 输出会同时：
#   ① 打到屏幕，供人核对；
#   ② 落到 tools/probes/.out/transcripts/<模块>.txt，作为入库留档
#      （I-02「数值可复现规范」要求脚本与输出一并保留）。
#
# 想只复跑某一个模块：bash tools/probes/m04.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
TR="$HERE/.out/transcripts"
mkdir -p "$TR"

# m01 / m03 / m06 的证据由站内已有的 term 块承载，其探针脚本在 b02/tools/ 下另有留存；
# 这里跑的是本轮补齐的 7 个模块。
MODULES="m01 m02 m03 m04 m05 m06 m07 m08 m09 m10"

fail=0
for m in $MODULES; do
  printf '\n════════════════════════ %s ════════════════════════\n' "$m"
  bash "$HERE/$m.sh" > "$TR/$m.txt" 2>&1
  rc=$?
  cat "$TR/$m.txt"
  if [ "$rc" = 0 ]; then
    printf '  → 转录已存 %s\n' "$TR/$m.txt"
  else
    printf '  !! %s 探针失败（退出码 %d），详见上面的输出\n' "$m" "$rc"
    fail=1
  fi
done

printf '\n════════════════════════════════════════════════════\n'
if [ "$fail" = 0 ]; then
  echo "全部探针完成。转录目录：$TR"
else
  echo "有探针失败，请检查上面的输出。"
fi
exit $fail
