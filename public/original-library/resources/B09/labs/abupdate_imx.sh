#!/bin/sh
# i.MX6ULL · 用 swupdate 做 A/B 升级（含签名校验与回滚）
# .swu 里描述把镜像写到哪个分区；失败由 bootloader bootcount 回滚
swupdate -i /tmp/update.swu -e "stable,main" -v

# RAUC 备选：
# rauc install /tmp/update.raucb
# rauc status
