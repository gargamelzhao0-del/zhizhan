# CAN 与 CAN-FD

```zhizhan-anchor
m04
```



报文格式与仲裁、位定时计算、验收滤波器、错误计数与总线关闭恢复、总线负载估算、CANopen 对象字典入门。

 

> 前置：了解 CAN 总线收发、位时序与终端电阻的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按外设时钟与波特率算出位定时预分频与采样点，配置验收滤波器并估算总线负载。

 

本章速览




- CAN 多主仲裁：ID 越小优先级越高，冲突方自动重发，不丢帧只延迟。

- 位时间 = 1 \+ TS1 \+ TS2；预分频必须为整数，采样点约 75%~87.5%。

- 总线两端 120Ω 终端；错误计数累积到总线关闭要能自动恢复。

 

```zhizhan-anchor
m04-can
```



```zhizhan-anchor
m04-can-t
```



## 4.1 仲裁与位定时



CAN 是多主、广播、带仲裁的总线：同时发送时按 ID 逐位仲裁，ID 越小优先级越高，输的一方转接收稍后重发——不丢帧，只增加延迟。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  CAN 逐位仲裁



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="CAN 逐位仲裁" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M315,26 V94"></path><text x="315" y="18" text-anchor="middle" class="sv-lbl-dim">8</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M605,26 V94"></path><text x="605" y="18" text-anchor="middle" class="sv-lbl-dim">22</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">30</text><text x="12" y="48" class="sv-lbl">节点0x100</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="620" height="22" rx="4" class="sv-grn-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">发送(赢)</text><text x="12" y="82" class="sv-lbl">节点0x200</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="413" height="22" rx="4" class="sv-red-s"></rect><text x="356.7" y="81" text-anchor="middle" class="sv-lbl-hi">仲裁失败→重发</text></svg>
```



两节点同时发；ID 数值更小者（显性位多）赢；输者退为接收，待总线空闲重发。



表 4.1 CAN 要素



| 要素 | 规则 | 坑 |
| --- | --- | --- |
| 位定时 | 位时间 = 1 \+ TS1 \+ TS2 个 tq | 预分频必须整除 |
| 采样点 | 约 75%~87.5% | 太长/太短在长线下误码 |
| 终端 | 两端各 120Ω | 缺终端→反射、错误计数升 |
| 错误处理 | TEC/REC→总线关闭 | 要能自动恢复 |
| CAN-FD | 数据段更快、载荷更长 | 收发器/布线要支持 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：位定时/仲裁/负载



下面这段主机程序计算位定时预分频与采样点、判仲裁胜者并估算总线负载：



host\_can.cC

 

```text
/* host_can.c —— CAN 位定时、仲裁与总线负载的小模型（主机可运行）。
 *
 *   ① 位定时：位时间 = 1(同步段) + BS1 + BS2 个时间份额(tq)，tq = 1/时钟；
 *      预分频 = 外设时钟 / (波特率 × 总 tq 数)，必须为整数。采样点 = (1+BS1)/总 tq。
 *   ② 仲裁：多个节点同时发送时，标识符数值越小优先级越高，逐位仲裁，输者自动重发。
 *   ③ 总线负载：负载‰ = 每秒帧数 × 每帧位数 / 波特率 × 1000。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_can.c -o host_can && ./host_can
 */
#include <stdio.h>
#include <stdint.h>

static int prescaler_for(uint32_t clock, uint32_t bitrate, int tq_total, int *out_presc, int *out_sp_permille, int bs1) {
    uint32_t denom = bitrate * (uint32_t)tq_total;
    if (denom == 0 || clock % denom != 0) return 0;
    *out_presc = (int)(clock / denom);
    *out_sp_permille = (1 + bs1) * 1000 / tq_total;
    return 1;
}
static int bus_load_permille(uint32_t fps, int bits_per_frame, uint32_t bitrate) {
    return (int)(((uint64_t)fps * (uint64_t)bits_per_frame * 1000u) / bitrate);
}

int main(void) {
    int ok = 1, presc = 0, sp = 0;

    /* ① 36MHz 外设时钟、500kbps、18 tq（BS1=15, BS2=2） */
    int found = prescaler_for(36000000u, 500000u, 18, &presc, &sp, 15);
    printf("位定时：36MHz / 500kbps / 18tq → 预分频=%d（期望 4），采样点=%d‰（期望 ~889‰）\n", presc, sp);
    if (!(found && presc == 4 && sp == 888)) ok = 0;

    /* 非整数预分频必须被拒绝：72MHz / 500kbps / 18tq = 8（整数）；改成 17tq 则不是整数 */
    if (prescaler_for(72000000u, 500000u, 17, &presc, &sp, 15)) { printf("本应拒绝非整数预分频\n"); ok = 0; }

    /* ② 仲裁：ID 越小越优先 */
    uint32_t ids[3] = {0x200u, 0x100u, 0x180u};
    uint32_t winner = ids[0];
    for (int i = 1; i < 3; i++) if (ids[i] < winner) winner = ids[i];
    printf("仲裁：{0x200,0x100,0x180} 的胜者=0x%03X（期望 0x100）\n", winner);
    if (winner != 0x100u) ok = 0;

    /* ③ 总线负载：1000 帧/s × 111 位 / 500kbps */
    int load = bus_load_permille(1000u, 111, 500000u);
    printf("总线负载：1000fps × 111bit / 500kbps = %d‰（期望 222‰）\n", load);
    if (load != 222) ok = 0;

    if (bus_load_permille(3000u, 130, 500000u) < 500) { printf("高负载估算偏低\n"); ok = 0; }

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

CAN 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_can.c -o labs/host_can && ./labs/host_can
位定时：36MHz / 500kbps / 18tq → 预分频=4（期望 4），采样点=888‰
仲裁：{0x200,0x100,0x180} 的胜者=0x100（期望 0x100）
总线负载：1000fps × 111bit / 500kbps = 222‰（期望 222‰）
RESULT: PASS
```



预分频 36M/(500k×18)=4 整除；采样点 (1\+15)/18=888‰；最小编号 0x100 胜；负载 222‰。



表 4.2 位定时与负载



| 量 | 值 | 说明 |
| --- | --- | --- |
| 预分频 | 4 | 整除 |
| 采样点 | 888‰ | 合理区间 |
| 仲裁胜者 | 0x100 | 最小 ID |
| 总线负载 | 222‰ | \<50% 安全 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-plat\n```\n\n\n\n```zhizhan-anchor\nm04-plat-t\n```\n\n\n\n## 4.3 三平台对照：CAN 外设\n\n\n\nSTM32F103 用 bxCAN、H7 用 FDCAN、ESP32 用 TWAI；位定时与仲裁语义一致。\n\n\n\nm04\\_can.cC\n\n \n\n```text\n/* m04_can.c —— bxCAN 初始化与发送（Cortex-M3）。\n * 位定时 500kbps（见 stm32_comm.h）；标准帧写入邮箱后置 TXRQ 触发发送。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n#include \"stm32_comm.h\"\n\nvoid can500_init(void) {\n    bxcan_set_500k();\n    (void)can_accept_filter(0x100u, 0x700u);   /* 只收 0x100..0x1FF */\n}\n\nint can_tx_std(uint16_t id, const uint8_t *d, uint8_t dlc) {\n    uint32_t lo = 0u, hi = 0u;\n    for (int i = 0; i < 4; i++) {\n        lo |= (uint32_t)((i < dlc) ? d[i] : 0u) << (8 * i);\n        hi |= (uint32_t)((i + 4 < dlc) ? d[i + 4] : 0u) << (8 * i);\n    }\n    CAN1_TI0R  = ((uint32_t)id << 21);         /* 标准帧，ID 在 [31:21] */\n    CAN1_TDT0R = dlc;\n    CAN1_TDL0R = lo;\n    CAN1_TDH0R = hi;\n    CAN1_TI0R |= 0x1u;                         /* TXRQ：请求发送 */\n    return 0;\n}\n```\n\nSTM32F103 · bxCAN\n\n\n\nesp\\_m04\\_twai.cC\n\n \n\n```text\n/* esp_m04_twai.c —— 内置 TWAI(CAN 2.0B)（ESP32 / Xtensa）。\n * 安装 → 启动 → 发送；接收用 twai_receive（中断/轮询由驱动负责）。 */\n#include <stdint.h>\n#include \"esp_comm.h\"\n#include \"comm_api.h\"\n\nvoid esp_can_init(void) {\n    twai_general_config_t g = {0};\n    twai_timing_config_t  t = {0};\n    twai_filter_config_t  f = {0};\n    (void)twai_driver_install(&g, &t, &f);\n    (void)twai_start();\n}\n\nint esp_can_tx(uint32_t id, const uint8_t *d, uint8_t dlc) {\n    twai_message_t m;\n    m.identifier = id;\n    m.data_length_code = dlc;\n    m.flags = 0;\n    for (uint8_t i = 0; i < dlc && i < 8u; i++) m.data[i] = d[i];\n    return (int)twai_transmit(&m, pdMS_TO_TICKS(10));\n}\n```\n\nESP32 · TWAI\n\n\n\nh7\\_m04\\_fdcan.cC\n\n \n\n```text\n/* h7_m04_fdcan.c —— FDCAN 初始化骨架（STM32H7 / Cortex-M7）。\n * CAN-FD 支持更大载荷；位定时在 NBTP，收发描述符放在消息 RAM。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n#include \"stm32_comm.h\"\n\nvoid h7_fdcan_init(void) {\n    FDCAN_CCCR |= (1u << 0);            /* INIT：进入初始化 */\n    FDCAN_CCCR |= (1u << 1);            /* CCE：允许写配置寄存器 */\n    FDCAN_NBTP  = (4u << 16) | (14u << 8) | (1u << 0);   /* 示例：标称位定时字段 */\n    FDCAN_CCCR &= ~(1u << 1);           /* 关闭配置使能 */\n    FDCAN_CCCR &= ~(1u << 0);           /* 退出初始化 */\n    while (FDCAN_CCCR & 1u) { }\n}\n\nuint32_t h7_fdcan_error_counters(void) {\n    return FDCAN_PSR;                   /* 读取 REC/TEC 等错误计数用于总线诊断 */\n}\n```\n\nSTM32H7 · FDCAN\n\n\n\n表 4.3 三平台 CAN\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 外设 | bxCAN | TWAI | FDCAN(FD) |\n| 位定时 | prescaler\\+BS1/BS2 | 同 | NBTP |\n| 滤波 | 验收滤波器组 | acceptance | 标准/扩展 |\n| FD | 不支持 | 不支持 | 支持 |"}
````



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



CAN 自检：预分频整除、采样点合理、有终端、总线关闭可恢复、负载不超限。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  总线负载与安全线（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="总线负载与安全线（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">当前 222‰</text><rect x="150" y="26" width="256" height="18" rx="4" class="sv-grn-s"></rect><text x="414" y="43" class="sv-lbl-hi">222‰</text><text x="12" y="67" class="sv-lbl">建议上限 500‰</text><rect x="150" y="50" width="577" height="18" rx="4" class="sv-red-s"></rect><text x="735" y="67" class="sv-lbl-hi">500‰</text></svg>
```



负载 222‰ 远低于 50% 建议线；加节点/加帧率时要重新核算。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 位定时 | 整除\+采样点 | 不整除 |
| 终端 | 两端 120Ω | 缺终端 |
| 错误 | bus-off 自动恢复 | 永久停住 |
| 负载 | 峰值\<50% | 过高仍加节点 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **没有终端电阻** ：反射导致错误计数飙升，高负载更明显。

- **预分频不整除** ：实际波特率偏离，采样点漂移，偶发位错误。

- **总线关闭不恢复** ：错误累积到 bus-off 后停住。

- **负载过高仍加节点** ：实时性变差，高优先级帧也开始延迟。



◆ 自测 · Module 04（先答再看）




1. 两个节点同时发 ID=0x100 与 0x200，谁赢？输的一方怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"ID 越小优先级越高，0x100 赢。输的 0x200 仲裁失败后自动转为接收，待总线空闲再重发——帧不丢，只是延迟。"}
   ```

2. 位定时怎么算？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"预分频 = 外设时钟 /(波特率 × 总 tq 数)，必须整除；采样点 =(1\\+TS1)/总 tq。例如 36M/(500k×18)=4，采样点 16/18=888‰。"}
   ```

3. 总线负载怎么估？超过多少要警惕？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"负载 = 每秒帧数 × 每帧位数 / 波特率。一般建议峰值不超过约 50%，过高会让高优先级帧也开始明显延迟。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按你的外设时钟与目标波特率算出 CAN 位定时（整除、采样点在 75%~87.5%），并估算当前总线负载。



核对与延伸：[CAN 与 CAN-FD 基础（Linux kernel / SocketCAN）](https://www.kernel.org/doc/html/latest/networking/can.html)

 

动手练习



运行 ` labs/host_can.c `：验证 36MHz/500kbps/18tq 的预分频=4、采样点 888‰，仲裁与负载。



**检查结果：** 预分频=4 且采样点=888‰ 在合理区间；仲裁胜者=最小 ID 0x100；负载 222‰ 计算正确。

 

迁移练习：把本章的“能按外设时钟与波特率算出位定时预分频与采样点，配置验收滤波器并估算总线负载。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m04","criterion":"预分频=4 且采样点=888‰ 在合理区间；仲裁胜者=最小 ID 0x100；负载 222‰ 计算正确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
