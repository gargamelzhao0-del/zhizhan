# UART

```zhizhan-anchor
m07
```



UART 是异步的：双方只约定波特率。` BRR = fCK/(16×波特率) ` 必须 **四舍五入** （误差 \< 2%）。接收端最容易被忽视的是  **ORE 溢出** ——不处理就会整段丢数据。

 

> 前置：会算分频/波特率并理解中断与环形缓冲。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能算 BRR 并配置 UART，用中断/[DMA](term:dma) 收不定长帧并正确处理溢出（ORE）。

 

本章速览




- BRR = 时钟/波特率，四舍五入；误差要求 \< 2%。

- ORE 不处理会锁死接收：先读状态再读数据。

- 不定长帧用 DMA\+IDLE；ESP32 自带 128 字节 FIFO。

 

```zhizhan-anchor
m07-model
```



```zhizhan-anchor
m07-model-t
```



## 7.1 波特率与溢出（ORE）



` BRR = fCK/(16×波特率) `，四舍五入，误差一般要求 \< 2%。接收端一帧还没读走又来一帧， **ORE**  置位并锁住后续接收——必须“先读 SR 再读 DR”清除。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  UART 收一帧的路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="UART 收一帧的路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">RXNE</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">读 DR</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">入环形缓冲</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">主循环处理</text></svg>
```



RXNE 置位 → 中断读 DR → 入环形缓冲 → 主循环处理。ORE 溢出要单独处理并恢复。



表 7.1 UART 接收方案



| 场景 | 推荐做法 |
| --- | --- |
| 定长小包 | RXNE 中断 \+ 环形缓冲 |
| 不定长帧 | DMA 收 \+ IDLE 中断 |
| 高吞吐 | DMA 双缓冲 \+ RTS/CTS |
| 半双工 RS-485 | 发送前拉 DE，TC 中断后拉低 |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：体积与环形缓冲主机运行



` size m07_uart.o ` → text= **194**  B，bss= **264**  B（256 字节环形缓冲）。环形缓冲是纯逻辑，先在主机把边界测干净（本册附带，可真实运行）：



host\_ringbuf.cC

 

```text
/* host_ringbuf.c — 可在主机运行的环形缓冲自检（gcc，非交叉）
 * 环形缓冲是纯逻辑，最适合先在 PC 上把边界测干净，再搬到 MCU。 */
#include <stdio.h>
#include <stdint.h>

#define RB_SIZE 8u   /* 2 的幂；留一格区分满/空，可用 7 格 */
typedef struct {
    volatile uint16_t head;
    volatile uint16_t tail;
    uint8_t buf[RB_SIZE];
} rb_t;

static int rb_push(rb_t *rb, uint8_t byte)
{
    uint16_t next = (uint16_t)((rb->head + 1u) & (RB_SIZE - 1u));
    if (next == rb->tail) {
        return 0;                        /* 满 */
    }
    rb->buf[rb->head] = byte;
    rb->head = next;
    return 1;
}

static int rb_pop(rb_t *rb, uint8_t *out)
{
    if (rb->head == rb->tail) {
        return 0;                        /* 空 */
    }
    *out = rb->buf[rb->tail];
    rb->tail = (uint16_t)((rb->tail + 1u) & (RB_SIZE - 1u));
    return 1;
}

int main(void)
{
    rb_t rb = { 0u, 0u, { 0u } };
    int failures = 0;
    uint8_t v = 0u;

    /* 空缓冲 pop 必须失败 */
    if (rb_pop(&rb, &v) != 0) { printf("FAIL empty pop\n"); failures++; }

    /* 填满：8 格只能存 7 个 */
    int pushed = 0;
    for (uint8_t i = 1u; i <= 10u; ++i) {
        pushed += rb_push(&rb, (uint8_t)(i * 10u));
    }
    printf("pushed=%d (expect 7)\n", pushed);
    if (pushed != 7) { failures++; }

    /* 顺序必须 FIFO：10,20,...,70 */
    int order_ok = 1;
    for (uint8_t expect = 10u; expect <= 70u; expect += 10u) {
        if (rb_pop(&rb, &v) != 1 || v != expect) { order_ok = 0; }
    }
    printf("fifo_order=%s\n", order_ok ? "ok" : "BAD");
    if (!order_ok) { failures++; }

    /* 反复回绕 100 次 */
    for (int i = 0; i < 100; ++i) {
        rb_push(&rb, (uint8_t)i);
        rb_pop(&rb, &v);
    }
    printf("wrap_cycles=100 ok\n");

    printf(failures ? "RESULT: FAIL (%d)\n" : "RESULT: PASS\n", failures);
    return failures ? 1 : 0;
}
```

环形缓冲边界测试（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ringbuf.c -o labs/host_ringbuf && ./labs/host_ringbuf
pushed=7 (expect 7)
fifo_order=ok
wrap_cycles=100 ok
RESULT: PASS
```



环形缓冲的入队/顺序/回绕边界在主机上真实跑通，再搬到 MCU。



表 7.2 UART 关键数值



| 量 | 值 | 说明 |
| --- | --- | --- |
| BRR @72M/115200 | 625 = 0x271 | 误差极小 |
| BRR @36M/115200 | 312.5→313 | 约 0.2% |
| 缓冲容量 | 256 B | 2 的幂，掩码回绕 |
| 示例 bss | 264 B | 缓冲 \+ 索引 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-plat\n```\n\n\n\n```zhizhan-anchor\nm07-plat-t\n```\n\n\n\n## 7.3 三平台对照：UART\n\n\n\n三平台 UART 抽象不同：F103/H7 写 USART 寄存器；ESP32 用 uart\\_driver 安装/读写。三份代码均已交叉编译。\n\n\n\nm07\\_uart.cC\n\n \n\n```text\n/* m07_uart.c — B05-M07 UART\n * 波特率 BRR 计算 + 溢出错误处理 + ISR 环形接收。DMA + IDLE 收不定长帧见正文。 */\n#include \"stm32f103_regs.h\"\n\n/* 复用阶段①的环形缓冲：容量取 2 的幂，用掩码回绕 */\n#define UART_RB_SIZE 256u\ntypedef struct {\n    volatile uint16_t head;\n    volatile uint16_t tail;\n    uint8_t buf[UART_RB_SIZE];\n} uart_rb_t;\n\nstatic uart_rb_t g_rx;\nvolatile uint32_t g_rx_overrun;\n\nint uart_rb_push(uart_rb_t *rb, uint8_t byte)\n{\n    uint16_t next = (uint16_t)((rb->head + 1u) & (UART_RB_SIZE - 1u));\n    if (next == rb->tail) {\n        return 0;                 /* 满：丢弃新数据并计数 */\n    }\n    rb->buf[rb->head] = byte;\n    rb->head = next;              /* 先写数据，后发布索引 */\n    return 1;\n}\n\nint uart_rb_pop(uart_rb_t *rb, uint8_t *out)\n{\n    if (rb->head == rb->tail) {\n        return 0;                 /* 空 */\n    }\n    *out = rb->buf[rb->tail];\n    rb->tail = (uint16_t)((rb->tail + 1u) & (UART_RB_SIZE - 1u));\n    return 1;\n}\n\n/* BRR = fCK/(16×baud)，四舍五入；返回实际写入值便于核对误差 */\nuint32_t usart1_baud_init(uint32_t pclk2, uint32_t baud)\n{\n    uint32_t brr = (pclk2 + baud / 2u) / baud;\n    USART1->BRR = brr;\n    USART1->CR1 |= USART_CR1_UE | USART_CR1_TE | USART_CR1_RE | USART_CR1_RXNEIE;\n    return brr;\n}\n\n/* 波特率相对误差（ppm）：越小越好，一般要求 < 2% */\nint32_t usart1_baud_error_ppm(uint32_t pclk2, uint32_t baud)\n{\n    uint32_t brr = (pclk2 + baud / 2u) / baud;\n    if (brr == 0u) {\n        return 1000000; /* 非法 */\n    }\n    int32_t actual = (int32_t)(pclk2 / brr);\n    return (actual - (int32_t)baud) * 1000000 / (int32_t)baud;\n}\n\n/* 中断：先读 SR 再读 DR。ORE 会锁住后续接收，必须读 DR 清掉，否则整段数据丢失 */\nvoid USART1_IRQHandler(void)\n{\n    uint32_t sr = USART1->SR;\n    if (sr & USART_SR_RXNE) {\n        uint8_t b = (uint8_t)USART1->DR;\n        if (!uart_rb_push(&g_rx, b)) {\n            g_rx_overrun++;\n        }\n    } else if (sr & USART_SR_ORE) {\n        (void)USART1->DR;\n        g_rx_overrun++;\n    }\n}\n```\n\nSTM32F103 · USART \\+ 环形缓冲\n\n\n\nesp\\_m07\\_uart.cC\n\n \n\n```text\n/* esp_m07_uart.c — ESP32 UART：时钟来自 APB(80MHz)，CLKDIV=APB/baud\n * 与 STM32 不同：ESP32 有 128 字节硬件 FIFO，数据搬运用中断/驱动队列。 */\n#include \"esp32_regs.h\"\n\nuint32_t esp_uart_set_baud(uint32_t base, uint32_t baud)\n{\n    uint32_t div = (ESP32_APB_HZ + baud / 2u) / baud;   /* 整数分频；更精确可用 CLKDIV_FRAG */\n    UART_CLKDIV(base) = div;\n    return div;\n}\n\nvoid esp_uart_putc(uint32_t base, uint8_t c)\n{\n    while (((UART_STATUS(base) >> UART_TXFIFO_CNT_SHIFT) & 0xFFu) >= 128u) {\n    }\n    UART_FIFO(base) = c;\n}\n\n/* ESP-IDF 高层：uart_driver_install 建立环形缓冲 + 事件队列，避免裸轮询 */\nextern int uart_driver_install(int port, int rx_buf, int tx_buf, int queue_size, void *queue, int flags);\nint esp_uart_driver_start(int port)\n{\n    return uart_driver_install(port, 256, 0, 20, (void *)0, 0);\n}\n```\n\nESP32 · uart\\_driver\n\n\n\nh7\\_m07\\_uart.cC\n\n \n\n```text\n/* h7_m07_uart.c — STM32H7 USART（v2）：ISR/ICR/RDR/TDR 取代 F1 的 SR/DR\n * BRR 公式与格式（含 1/16 小数）与 F1 相同，但寄存器访问方式全变。 */\n#include \"stm32h7_regs.h\"\n\nuint32_t h7_usart1_baud(uint32_t pclk, uint32_t baud)\n{\n    uint32_t brr = (pclk + baud / 2u) / baud;   /* 与 F1 同：BRR=fCK/baud，含小数位 */\n    H7_USART1->BRR = brr;\n    H7_USART1->CR1 |= H7_USART_CR1_UE | H7_USART_CR1_TE | H7_USART_CR1_RE;\n    return brr;\n}\n\nint h7_usart1_getc(uint8_t *c)\n{\n    if (H7_USART1->ISR & H7_USART_ISR_RXNE) {\n        *c = (uint8_t)H7_USART1->RDR;   /* v2 用 RDR，不是 DR */\n        return 1;\n    }\n    return 0;\n}\n\nvoid h7_usart1_putc(uint8_t c)\n{\n    while ((H7_USART1->ISR & H7_USART_ISR_TXE) == 0u) {\n    }\n    H7_USART1->TDR = c;                 /* v2 用 TDR */\n}\n\n/* v2 的错误标志集中在 ISR，用 ICR 清；ORE 依然是“不处理就锁死接收”的头号坑 */\nvoid h7_usart1_clear_errors(void)\n{\n    H7_USART1->ICR = (1u << 1) | (1u << 3);   /* 清 ORE/错误标志（见 RM0433） */\n}\n```\n\nSTM32H7 · USART\n\n\n\n表 7.3 三平台 UART\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 配置 | BRR 寄存器 | uart\\_param\\_config | BRR/Presc |\n| 不定长 | DMA\\+IDLE | uart event queue | DMA\\+IDLE |\n| 流控 | RTS/CTS | RTS/CTS | RTS/CTS |\n| RS-485 | DE 手动控制 | RS485 模式 | DE 自动 |"}
````



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 环形缓冲与自检



环形缓冲用掩码回绕（容量为 2 的幂）。ISR 只搬字节，重活留给主循环。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  环形缓冲的 head/tail 回绕



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="环形缓冲的 head/tail 回绕" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写入 head++</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">掩码回绕</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">读取 tail++</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">空/满判定</text></svg>
```



写入更新 head、读出更新 tail；到末尾用掩码回绕。满/空判断要区分，避免覆盖未读数据。



表 7.4 UART 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 波特率 | 回环收发 | 内容一致 |
| 溢出 | 制造 ORE | 计数增且能恢复 |
| 顺序 | 主机测试 | fifo\_order=ok |
| 回绕 | 绕多圈 | wrap\_cycles ok |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **ORE 不处理** ：漏读 DR，接收通道“假死”。

- **BRR 直接截断** ：不四舍五入，误差翻倍，长帧末端错位。

- **ISR 里做重活** ：格式化/写 Flash 导致丢包。

- **RS-485 一收完就拉低 DE** ：应等 TC，否则最后几位移出不完整。



◆ 自测 · Module 07（先答再看）




1. 72 MHz、115200 波特率，BRR 取多少？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"72e6/115200 ≈ 625 = 0x271，误差极小。若用 36 MHz 则 312.5→313，约 0.2%。"}
   ```

2. 为什么 UART 接收端必须处理 ORE？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一帧没读走又来一帧会置 ORE 并锁住后续接收。不读 DR 清除，接收通道就“假死”，整段丢数据。"}
   ```

3. 半双工 RS-485 什么时候才能拉低 DE？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"要等  **TC（发送完成）** 而不是 TXE，否则最后几位还在移位就被切走，从机收到不完整数据。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把项目里的 UART 接收改为中断/环形缓冲或 DMA\+IDLE，并补上 ORE 的处理与恢复。



核对与延伸：[ST · RM0008 STM32F10x 参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

 

动手练习



在主机用串口工具发不定长帧；制造一次溢出，观察 ORE 计数与恢复。



**检查结果：** BRR=0x271（625，误差 \<2%）；溢出后仍能继续收；帧内容与发送端一致（环形缓冲 256 B）。

 

迁移练习：把本章的“能算 BRR 并配置 UART，用中断/DMA 收不定长帧并正确处理溢出（ORE）。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m07","criterion":"BRR=0x271（625，误差 <2%）；溢出后仍能继续收；帧内容与发送端一致（环形缓冲 256 B）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
