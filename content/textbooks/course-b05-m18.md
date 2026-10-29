# 以太网与 TCP/IP（lwIP）

```zhizhan-anchor
m18
```



“插网线”有两条路：外挂硬件 TCP/IP 芯片（如 W5500，MCU 走 SPI\+socket）或芯片自带 MAC 用  **lwIP** （配 RMII PHY）。排障按 **链路→网络→应用** 分层。

 

> 前置：了解分层网络模型与 SPI/网络接口基础。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能在硬件 TCP/IP 芯片与内置 MAC\+lwIP 两条路线间选型，并按链路/网络/应用分层排障。

 

本章速览




- MCU 联网两条路：外挂 W5500（SPI\+socket）或内置 MAC\+lwIP。

- 排障按分层：链路(PHY/link) → 网络(DHCP/IP) → 应用(socket)。

- PHY 读回全 0/全 1 先查复位与 RMII 参考时钟。

 

````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm18-routes\n```\n\n\n\n```zhizhan-anchor\nm18-routes-t\n```\n\n\n\n## 18.1 两条联网路线\n\n\n\n① 外挂硬件 TCP/IP 芯片（W5500）：MCU 只走 SPI\\+socket，省 RAM 不用协议栈；② 芯片自带 MAC：用 lwIP 跑 TCP/IP，配 RMII 接口的 PHY。\n\n\n\n```zhizhan-anchor\nfig-图-18-1\n```\n\n\n\n**图 18.1**  两条联网路线的协议栈位置\n\n\n\n```zhizhan-figure\n<svg viewBox=\"0 0 800 160\" width=\"100%\" height=\"160\" role=\"img\" aria-label=\"两条联网路线的协议栈位置\" preserveAspectRatio=\"xMidYMid meet\"><rect x=\"60\" y=\"30\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-grn-s\"></rect><text x=\"75\" y=\"49.0\" class=\"sv-lbl-hi\">MCU（应用/socket）</text><rect x=\"60\" y=\"64\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-amb-s\"></rect><text x=\"75\" y=\"83.0\" class=\"sv-lbl-hi\">① W5500（硬件 TCP/IP，SPI）</text><rect x=\"60\" y=\"98\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-cyn-s\"></rect><text x=\"75\" y=\"117.0\" class=\"sv-lbl-hi\">② 内置 MAC + lwIP + PHY(RMII)</text><rect x=\"60\" y=\"132\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-box\"></rect><text x=\"75\" y=\"151.0\" class=\"sv-lbl-hi\">网线/物理层</text></svg>\n```\n\n\n\n硬件 TCP/IP 芯片：协议栈在芯片里，MCU 只做 SPI\\+socket；内置 MAC：协议栈在 MCU（lwIP）。\n\n\n\n表 18.1 联网方案对比\n\n\n\n| 方案 | 代表 | MCU 侧接口 | 协议栈位置 |\n| --- | --- | --- | --- |\n| 硬件 TCP/IP 芯片 | W5500 | SPI | 芯片内部 |\n| 内置 MAC \\+ PHY | STM32H7 | RMII/MII | lwIP（MCU） |\n| 内置 EMAC | ESP32 | RMII | lwIP（MCU） |"}
````



```zhizhan-anchor
m18-evidence
```



```zhizhan-anchor
m18-evidence-t
```



## 18.2 真实证据：体积与寄存器



` size m18_eth_w5500.o ` → text= **386**  B（SPI 读写 W5500 寄存器 \+ socket 收发）。H7 有内置 MAC（0x4002\_8000），ESP32 用 esp\_eth。



m18\_eth\_w5500.c 节选C

 

```text
/* W5500 VERSIONR 自检：读不到就是 SPI/片选/模式问题 */
uint8_t ver = w5500_read(VERSIONR);
if (ver != 0x04) return -1;      // 版本寄存器应为 0x04
/* 内置 MAC（H7）：MDIO 读 PHY ID，全 0/全 1 说明复位或 REF_CLK 缺失 */
```

真实反汇编对应 SPI 时序；VERSIONR/PHY ID 是最小自检



表 18.2 链路层自检点



| 自检点 | 期望 | 异常含义 |
| --- | --- | --- |
| W5500 VERSIONR | 0x04 | SPI/片选/模式错 |
| PHY ID (MDIO) | 非全 0/1 | 复位/RMII 时钟缺失 |
| link 状态 | up | 链路未通 |
| DHCP | 拿到 IP | 网络层问题 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm18-plat\n```\n\n\n\n```zhizhan-anchor\nm18-plat-t\n```\n\n\n\n## 18.3 三平台对照：以太网\n\n\n\n三平台以太网方案不同：F103 外挂 W5500（SPI）；ESP32/H7 用内置 MAC\\+lwIP。三份代码均已交叉编译。\n\n\n\nm18\\_eth\\_w5500.cC\n\n \n\n```text\n/* m18_eth_w5500.c — B05-M18 以太网（STM32F103 无 MAC，外挂 W5500 硬件 TCP/IP 芯片，SPI 接口）\n * 网线相关通信：PHY 在 W5500 内部，MCU 只需 SPI 读写其寄存器 + socket 收发。 */\n#include \"stm32f103_regs.h\"\n\n#define W5500_BSB_COMMON 0x00u\n#define W5500_BSB_S0     0x01u\n#define W5500_BSB_TX0    0x10u\n#define W5500_BSB_RX0    0x18u\n#define W5500_RWB_READ   0x00u\n#define W5500_RWB_WRITE  0x04u\n\nstatic uint8_t w_spi(uint8_t out)\n{\n    while ((SPI1->SR & SPI_SR_TXE) == 0u) { }\n    *((volatile uint8_t *)&SPI1->DR) = out;\n    while ((SPI1->SR & SPI_SR_RXNE) == 0u) { }\n    return *((volatile uint8_t *)&SPI1->DR);\n}\n\nstatic void w_cs(int low)\n{\n    GPIOA->BSRR = low ? (1u << (4 + 16)) : (1u << 4);   /* PA4 = W5500 片选 */\n}\n\nvoid w5500_write(uint8_t bsb, uint16_t off, const uint8_t *buf, uint16_t n)\n{\n    w_cs(1);\n    w_spi((uint8_t)(off >> 8)); w_spi((uint8_t)off); w_spi((uint8_t)((bsb << 3) | W5500_RWB_WRITE));\n    for (uint16_t i = 0; i < n; ++i) { w_spi(buf[i]); }\n    w_cs(0);\n}\n\nvoid w5500_read(uint8_t bsb, uint16_t off, uint8_t *buf, uint16_t n)\n{\n    w_cs(1);\n    w_spi((uint8_t)(off >> 8)); w_spi((uint8_t)off); w_spi((uint8_t)((bsb << 3) | W5500_RWB_READ));\n    for (uint16_t i = 0; i < n; ++i) { buf[i] = w_spi(0x00); }\n    w_cs(0);\n}\n\n/* 配好 MAC/IP，开 Socket0 为 TCP 客户端并连接服务器（示意端口 5000） */\nint w5500_tcp_connect(const uint8_t mac[6], const uint8_t ip[4], const uint8_t srv[4])\n{\n    uint8_t cr;\n    w5500_write(W5500_BSB_COMMON, 0x0009u, mac, 6);      /* SHAR */\n    w5500_write(W5500_BSB_COMMON, 0x000Fu, ip, 4);       /* SIPR */\n    cr = 0x01u; w5500_write(W5500_BSB_S0, 0x0000u, &cr, 1);   /* Sn_MR = TCP */\n    w5500_write(W5500_BSB_S0, 0x000Cu, srv, 4);          /* Sn_DIPR */\n    uint8_t port[2] = { 0x13u, 0x88u };                  /* 5000 */\n    w5500_write(W5500_BSB_S0, 0x0010u, port, 2);         /* Sn_DPORT */\n    cr = 0x01u; w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);   /* OPEN */\n    cr = 0x04u; w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);   /* CONNECT */\n    return 0;\n}\n\nint w5500_send(const uint8_t *buf, uint16_t n)\n{\n    uint8_t wr[2], cr = 0x20u;\n    w5500_read(W5500_BSB_S0, 0x0024u, wr, 2);            /* Sn_TX_WR */\n    uint16_t p = (uint16_t)(((uint16_t)wr[0] << 8) | wr[1]);\n    w5500_write(W5500_BSB_TX0, p, buf, n);               /* 写入 TX 缓冲 */\n    uint16_t np = (uint16_t)(p + n);\n    uint8_t wr2[2] = { (uint8_t)(np >> 8), (uint8_t)np };\n    w5500_write(W5500_BSB_S0, 0x0024u, wr2, 2);          /* 更新 Sn_TX_WR */\n    w5500_write(W5500_BSB_S0, 0x0001u, &cr, 1);          /* SEND */\n    return 0;\n}\n```\n\nSTM32F103 · W5500(SPI)\n\n\n\nesp\\_m18\\_eth.cC\n\n \n\n```text\n/* esp_m18_eth.c — B05-M18 以太网（ESP32 内置 EMAC + 外接 PHY，如 LAN8720）\n * 用 ESP-IDF 的 esp_eth + esp_netif：装驱动、起 netif、拿 IP。 */\n#include <stdint.h>\n\ntypedef int esp_err_t;\ntypedef void *esp_eth_handle_t;\ntypedef void *esp_netif_t;\n\nextern esp_err_t esp_netif_init(void);\nextern esp_err_t esp_event_loop_create_default(void);\nextern esp_netif_t esp_netif_create_default_eth(const void *eth_config);\nextern esp_err_t esp_eth_driver_install(const void *config, esp_eth_handle_t *out);\nextern esp_err_t esp_eth_start(esp_eth_handle_t h);\nextern void *esp_eth_phy_new_lan87xx(const void *phy_config);   /* RMII PHY */\n\nextern esp_netif_t g_esp_netif;\n\n/* 返回 0 表示驱动已装并启动；IP 由 DHCP 事件回调拿到 */\nint esp_eth_bringup(const void *mac_config, const void *phy_config)\n{\n    esp_netif_init();\n    esp_event_loop_create_default();\n    g_esp_netif = esp_netif_create_default_eth((const void *)0);\n    (void)esp_eth_phy_new_lan87xx(phy_config);\n    esp_eth_handle_t h = (void *)0;\n    if (esp_eth_driver_install(mac_config, &h) != 0) { return -1; }\n    return esp_eth_start(h);\n}\n\n/* 与 lwIP/socket 的应用层用法和 STM32 一致：网口之上就是标准 TCP/IP */\nextern int lwip_socket(int domain, int type, int protocol);\nint esp_tcp_socket(void) { return lwip_socket(2, 1, 0); }\n```\n\nESP32 · esp\\_eth \\+ lwIP\n\n\n\nh7\\_m18\\_eth.cC\n\n \n\n```text\n/* h7_m18_eth.c — B05-M18 以太网（STM32H7 内置 MAC，RMII 接 PHY）+ lwIP\n * H7 自带 10/100 MAC；PHY 经 RMII，数据经 DMA 描述符环。上层用 lwIP 的 netif/socket。\n * PHY 寄存器经 MDIO（Clause 22）访问，位域较繁琐，这里用 HAL 封装（寄存器见 RM0433）。 */\n#include \"stm32h7_regs.h\"\n\n#define H7_ETH_MACCR R32(0x40028000u)\n#define H7_MACCR_TE (1u << 3)\n#define H7_MACCR_RE (1u << 2)\n\nextern int HAL_ETH_ReadPHYRegister(void *heth, uint32_t phy, uint32_t reg, uint32_t *val);\n\n/* 读 PHY ID（寄存器 2/3）。若读到全 0 或全 1，通常是 PHY 未复位、\n * 或 RMII 的 50MHz REF_CLK 没给——这是“网线插上却不通”的头号原因。 */\nint h7_eth_phy_id(void *heth, uint32_t phy, uint32_t *id)\n{\n    uint32_t hi = 0u, lo = 0u;\n    if (HAL_ETH_ReadPHYRegister(heth, phy, 2u, &hi) != 0) { return -1; }\n    if (HAL_ETH_ReadPHYRegister(heth, phy, 3u, &lo) != 0) { return -2; }\n    *id = (hi << 16) | lo;\n    return (*id == 0u || *id == 0xFFFFFFFFu) ? -3 : 0;\n}\n\nvoid h7_eth_mac_start(void)\n{\n    H7_ETH_MACCR |= H7_MACCR_TE | H7_MACCR_RE;   /* 使能收发 */\n}\n\n/* lwIP：把 MAC 绑成 netif，再跑标准 socket 应用（与 F1 的 W5500 socket 用法一致） */\nextern void *netif_add(void *netif, void *ip, void *mask, void *gw, void *state,\n                       void *init_fn, void *input_fn);\nextern int  lwip_socket(int domain, int type, int protocol);\nextern int  lwip_connect(int s, const void *name, int namelen);\nextern int  lwip_send(int s, const void *data, unsigned len, int flags);\n\nint h7_eth_bringup(void *netif, const void *server_addr, int addrlen)\n{\n    netif_add(netif, (void *)0, (void *)0, (void *)0, (void *)0, (void *)0, (void *)0);    int s = lwip_socket(2 /*AF_INET*/, 1 /*SOCK_STREAM*/, 0);\n    if (s < 0) { return s; }\n    return lwip_connect(s, server_addr, addrlen);\n}\n```\n\nSTM32H7 · MAC \\+ lwIP\n\n\n\n表 18.3 三平台以太网\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 方案 | W5500(SPI) | 内置 EMAC | 内置 MAC\\+PHY(RMII) |\n| 协议栈 | 芯片内 | lwIP | lwIP |\n| 接口 | SPI | RMII | RMII/MII |\n| 时钟 | SPI 时钟 | —— | 50MHz REF\\_CLK |"}
````



```zhizhan-anchor
m18-check
```



```zhizhan-anchor
m18-check-t
```



## 18.4 分层排障



联网排障按分层来：先链路层（PHY link/MDIO ID），再网络层（DHCP IP），最后应用层（socket）。



```zhizhan-anchor
fig-图-18-2
```



**图 18.2**  TCP/IP 分层排障



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="TCP/IP 分层排障" preserveAspectRatio="xMidYMid meet"><rect x="95" y="44" width="190" height="50" rx="7" class="sv-cyn-s"></rect><text x="190.0" y="66" text-anchor="middle" class="sv-lbl-hi">链路层</text><path d="M287,69 H303" class="sv-arrow"></path><rect x="305" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">网络层</text><path d="M497,69 H513" class="sv-arrow"></path><rect x="515" y="44" width="190" height="50" rx="7" class="sv-box"></rect><text x="610.0" y="66" text-anchor="middle" class="sv-lbl-hi">应用层</text></svg>
```



链路层（PHY up/MDIO ID）→ 网络层（DHCP/静态 IP）→ 传输/应用层（socket/端口）。



表 18.4 分层排障清单



| 层次 | 检查 | 通过标志 |
| --- | --- | --- |
| 链路 | PHY link / MDIO ID | ID 非全 0/1、link up |
| 网络 | DHCP / ping | 拿到 IP、能 ping |
| 传输 | TCP 连接 | 三次握手成功 |
| 应用 | 端口/协议 | 收发正常 |



```zhizhan-anchor
m18-pitfalls
```



```zhizhan-anchor
m18-pitfalls-t
```



## 18.5 常见误区与排障



失败路径与排障




- **PHY 读回全 0/全 1** ：复位未释放、RMII 参考时钟缺失。

- **W5500 片选/模式不对** ：SPI 读不到 VERSIONR。

- **只看 socket 不查链路** ：链路没 up，怎么连都失败。

- **lwIP 缓冲太小** ：高吞吐下丢包；需调 pbuf/MEM\_SIZE。



◆ 自测 · Module 18（先答再看）




1. 网线插上但 ping 不通，第一步查什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先看链路层——PHY 是否 link up、自协商速率、MDIO 能否读到 PHY ID；链路通了再查 DHCP/IP，最后才是应用层。"}
   ```

2. W5500 路线和内置 MAC\+lwIP 路线本质区别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"W5500 把 TCP/IP 协议栈放在芯片里，MCU 只做 SPI\\+socket、省 RAM；内置 MAC 由 MCU 跑 lwIP，需要更多 RAM 但更灵活、吞吐更高。"}
   ```

3. PHY 读回全 0 或全 1 通常说明什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"PHY 未被正确复位或 RMII 的 50 MHz REF\\_CLK 没给（SMI/MDIO 时钟依赖它），通信失败。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：整理你板子的网络自检：PHY ID、link 状态、IP 获取、一次 TCP 回环，形成分层检查脚本。



核对与延伸：[lwIP 官方项目](https://savannah.nongnu.org/projects/lwip/) · [ST · AN4031 DMA 控制器使用](https://www.st.com/resource/en/application_note/an4031-using-the-stm32f2-stm32f4-and-stm32f7-series-dma-controller-stmicroelectronics.pdf)

 

动手练习



用 W5500/内置 MAC 建立一次 TCP 连接并收发；用 ping 与 socket 分层定位一次“连不上”。



**检查结果：** PHY 能被 MDIO 正确识别（非全 0/全 1，RMII 50 MHz REF\_CLK 正常）；拿到 IP；TCP 连接与收发成功。

 

迁移练习：把本章的“能在硬件 TCP/IP 芯片与内置 MAC\+lwIP 两条路线间选型，并按链路/网络/应用分层排障。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 18 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m18","criterion":"PHY 能被 MDIO 正确识别（非全 0/全 1，RMII 50 MHz REF_CLK 正常）；拿到 IP；TCP 连接与收发成功。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
