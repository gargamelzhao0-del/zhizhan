#!/bin/sh
# Allwinner V3s · 发行版 rootfs 的 /etc/rc.local（SysV 风格收尾脚本）
# 挂载 fstab，起日志，最后以后台方式拉起应用
mount -a
/usr/sbin/rsyslogd
su - app -c "/usr/bin/edge-app >/var/log/edge.log 2>&1 &"
exit 0
