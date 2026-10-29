# 通信协议易错点速查

```zhizhan-anchor
cheatsheet
```



把“粘包/CRC/CAN 误码/[OTA](term:ota) 变砖/断网丢数据”的点集中在一张表里。

 

把“换一个平台就写错”的点集中在一张表里。遇到问题先在这里对照。



| 主题 | STM32F103 (M3) | ESP32 (Xtensa) | STM32H7 (M7) | 易错点 |
| --- | --- | --- | --- | --- |
| CAN 控制器 | bxCAN | 内置 TWAI | FDCAN | 位定时/终端电阻 |
| 无线 | 外挂模组 AT | 内置 WiFi/BLE | 外挂模组 | 功耗/距离/占空比 |
| 以太网 | 外挂 W5500(SPI) | 内置 EMAC\+PHY | 内置 MAC\+RMII | 分层排障 |
| 应用层 | MQTT over socket | MQTT over socket | MQTT over socket | QoS 语义 |
| OTA | Boot\+App\+备份 | A/B 分区 | 双 Bank | 掉电/回滚 |
| Boot 跳转 | VTOR \+ MSP | 分区表 \+ set\_boot | VTOR \+ 关 cache | 跳转前清理 |
| CRC | 硬件 [CRC32](term:crc) \+ 软 CRC16 | 软件 CRC | 软件/硬件 CRC | 参数模型一致 |
| 调试 | 逻辑分析仪/CAN 盒 | idf.py monitor/抓包 | 逻辑分析仪/Wireshark | 先看物理层 |
| 断网恢复 | 退避 \+ 环形缓存 | 退避重连 | 退避 \+ 缓存上界 | [幂等](term:idempotency) \+ 上界 |


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
