完整 SDK 工程入口：只选 Zephyr 或 ESP-IDF 一路。
本轮验证：共享 sample.h 已用 GCC 真编译、真运行；两种 SDK 适配未在本环境构建或上板。
输入是合成递增 ADC 码，不能据此声称真实采集、实时性、功耗或通信协议已验收。

从 sdk_pipeline 目录执行主机测试：
gcc -std=c11 -Wall -Wextra -Werror -O2 host_test.c -o host_test
./host_test
Windows PowerShell 运行 .\host_test.exe。

Zephyr：先按官方 Getting Started 安装依赖并初始化已锁定的工作区。
本例教学基线为 v4.4.0；应用到产品前检查维护状态及适用补丁，记录实际 commit。
在 Linux/WSL 的 Zephyr 环境中执行（native_sim 需要相应宿主依赖）：
west build -p always -b native_sim /absolute/path/sdk_pipeline/zephyr
west build -t run
固定 manifest 修订；保存 west manifest --freeze 的结果、编译器版本、build/zephyr/.config。
native_sim 能观察任务/队列和日志，不能验收 MCU 的真实中断延迟。

ESP-IDF：在已配置的 v6.0 工具环境中进入 esp_idf；保存实际 commit 与工具版本。
idf.py set-target esp32
idf.py build
idf.py -p PORT flash monitor
PORT 换成实际串口；板型不同需 set-target 对应芯片，不可沿用 esp32 的二进制。
ESP-IDF 的任务栈大小单位为字节；与原生 FreeRTOS 的 StackType_t 元素数不同。
真实版本支持期由官方维护政策决定，教学基线不等于最新安全补丁。

先预测：生产 50ms，消费 200ms，队列容量 4；满时丢最新项且增加 dropped。
检查 SAMPLE 序号单调（回绕另有政策）、队列不无界增长、DROP 与断号对应。
调慢消费者不应把采样线程永久阻塞；日志本身会扰动时序，实时验收需独立测量。
把消费改为 20ms 后再次观察，不能把偶然一次不丢包当长期保证。
最后将合成源换为一颗真实传感器：增加读取失败质量位、总线超时和恢复政策。
Kconfig 配软件选项，devicetree/overlay 描述硬件；检查生成的 .config 与 zephyr.dts，不能只看输入文件。
毕业条件：保存硬件型号/接线/版本、构建日志、正常与故障轨迹、独立时间测量；未完成项留空。
