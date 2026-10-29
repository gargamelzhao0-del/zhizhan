# 应用开发易错点速查

```zhizhan-anchor
cheatsheet
```



把“需求漂移/按键抖动/PID 饱和/功耗超标/掉电丢配置”的点集中在一张表里。

 

把“换一个平台就写错”的点集中在一张表里。遇到问题先在这里对照。



| 主题 | STM32F103 (M3) | ESP32 (Xtensa) | STM32H7 (M7) | 易错点 |
| --- | --- | --- | --- | --- |
| 架构 | 前后台/任务 | 双核任务\+亲和 | 任务\+队列 | 共享资源未加锁 |
| 持久化 | Flash 页擦写 | [NVS](term:nvs) blob | 大扇区/双副本 | 掉电半条记录 |
| 看门狗 | IWDG | 任务 WDT | IWDG/WWDG | 在别处统一喂狗 |
| PWM | 通用定时器 | LEDC | 高级/通用定时器 | 限幅与保护 |
| 低功耗 | STOP/STANDBY | light/deep sleep | D1/D2/D3 | 唤醒源未配置 |
| 界面 | OLED/段码 | LVGL | TFT\+帧缓冲 | 刷新与业务耦合 |
| 参数 | Flash 双副本 | NVS | 备份域\+Flash | 版本迁移缺失 |
| 调试 | SWD\+GDB | idf monitor | SWD\+GDB | 没有复位原因记录 |
| 验收 | RAM/Flash/复位 | 堆/任务栈 | cache/RAM/Flash | 只看功能不看预算 |


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
