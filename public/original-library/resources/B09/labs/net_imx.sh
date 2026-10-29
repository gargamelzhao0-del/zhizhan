#!/bin/sh
# i.MX6ULL · 网络与系统服务
ip addr add 192.168.1.10/24 dev eth0
ip link set eth0 up
ip route add default via 192.168.1.1

# 用 systemd 托管应用：开机自启、崩溃自动重启（受限速）
systemctl enable --now edge-app.service
systemctl status edge-app.service --no-pager
