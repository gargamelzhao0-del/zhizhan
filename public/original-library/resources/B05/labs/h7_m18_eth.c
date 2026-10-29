/* h7_m18_eth.c — B05-M18 以太网（STM32H7 内置 MAC，RMII 接 PHY）+ lwIP
 * H7 自带 10/100 MAC；PHY 经 RMII，数据经 DMA 描述符环。上层用 lwIP 的 netif/socket。
 * PHY 寄存器经 MDIO（Clause 22）访问，位域较繁琐，这里用 HAL 封装（寄存器见 RM0433）。 */
#include "stm32h7_regs.h"

#define H7_ETH_MACCR R32(0x40028000u)
#define H7_MACCR_TE (1u << 3)
#define H7_MACCR_RE (1u << 2)

extern int HAL_ETH_ReadPHYRegister(void *heth, uint32_t phy, uint32_t reg, uint32_t *val);

/* 读 PHY ID（寄存器 2/3）。若读到全 0 或全 1，通常是 PHY 未复位、
 * 或 RMII 的 50MHz REF_CLK 没给——这是“网线插上却不通”的头号原因。 */
int h7_eth_phy_id(void *heth, uint32_t phy, uint32_t *id)
{
    uint32_t hi = 0u, lo = 0u;
    if (HAL_ETH_ReadPHYRegister(heth, phy, 2u, &hi) != 0) { return -1; }
    if (HAL_ETH_ReadPHYRegister(heth, phy, 3u, &lo) != 0) { return -2; }
    *id = (hi << 16) | lo;
    return (*id == 0u || *id == 0xFFFFFFFFu) ? -3 : 0;
}

void h7_eth_mac_start(void)
{
    H7_ETH_MACCR |= H7_MACCR_TE | H7_MACCR_RE;   /* 使能收发 */
}

/* lwIP：把 MAC 绑成 netif，再跑标准 socket 应用（与 F1 的 W5500 socket 用法一致） */
extern void *netif_add(void *netif, void *ip, void *mask, void *gw, void *state,
                       void *init_fn, void *input_fn);
extern int  lwip_socket(int domain, int type, int protocol);
extern int  lwip_connect(int s, const void *name, int namelen);
extern int  lwip_send(int s, const void *data, unsigned len, int flags);

int h7_eth_bringup(void *netif, const void *server_addr, int addrlen)
{
    netif_add(netif, (void *)0, (void *)0, (void *)0, (void *)0, (void *)0, (void *)0);    int s = lwip_socket(2 /*AF_INET*/, 1 /*SOCK_STREAM*/, 0);
    if (s < 0) { return s; }
    return lwip_connect(s, server_addr, addrlen);
}
