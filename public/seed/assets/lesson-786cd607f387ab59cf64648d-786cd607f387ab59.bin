// SPDX-License-Identifier: GPL-2.0
/* btn_platform.c —— 按键 platform driver：设备树中断 + threaded irq（接口按目标内核核对）。
 *
 * 与主机模型 host_irqhalf.c 一一对应：硬中断 handler 只做"登记"，重活交给内核线程。
 * 差别在于它是真实内核模块：需要针对目标板的内核源码树交叉编译，
 * IRQ 号来自设备树的 interrupts 属性，而不是 host 模拟。
 *
 * 目标板设备树（示例片段）：
 *   button@0 {
 *       compatible = "demo,btn";
 *       interrupts-extended = <&gpioa 0 IRQ_TYPE_EDGE_FALLING>;
 *       label = "user-btn";
 *   };
 *
 * 交叉编译（在目标板配套内核树内）：
 *   make -C <内核目录> M=$PWD modules
 *   insmod btn_platform.ko && grep btn /proc/interrupts
 */

#include <linux/module.h>
#include <linux/platform_device.h>
#include <linux/interrupt.h>
#include <linux/of.h>
#include <linux/slab.h>

struct btn_priv {
    unsigned int presses;
};

static irqreturn_t btn_hard_isr(int irq, void *dev_id)
{
    /* 上半部：只登记，立刻返回。IRQ_WAKE_THREAD 唤醒对应的内核线程。 */
    return IRQ_WAKE_THREAD;
}

static irqreturn_t btn_thread_fn(int irq, void *dev_id)
{
    /* 下半部（专用内核线程）：可睡眠、可做 I2C 读数等重活。 */
    struct btn_priv *p = dev_id;

    p->presses++;
    pr_info("btn: presses=%u\n", p->presses);
    return IRQ_HANDLED;
}

static int btn_probe(struct platform_device *pdev)
{
    struct btn_priv *p;
    int irq, ret;

    p = devm_kzalloc(&pdev->dev, sizeof(*p), GFP_KERNEL);
    if (!p)
        return -ENOMEM;

    irq = platform_get_irq(pdev, 0);   /* 失败返回负值，含 -EPROBE_DEFER */
    if (irq < 0)
        return irq;

    ret = devm_request_threaded_irq(&pdev->dev, irq,
                                    btn_hard_isr, btn_thread_fn,
                                    IRQF_ONESHOT, "btn", p);
    if (ret)
        return ret;

    platform_set_drvdata(pdev, p);
    dev_info(&pdev->dev, "probed, irq=%d\n", irq);
    return 0;
}

static const struct of_device_id btn_of_match[] = {
    { .compatible = "demo,btn" },
    { }
};
MODULE_DEVICE_TABLE(of, btn_of_match);

static struct platform_driver btn_driver = {
    .probe  = btn_probe,
    .driver = {
        .name           = "btn",
        .of_match_table = btn_of_match,
    },
};
module_platform_driver(btn_driver);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("Button platform driver with threaded IRQ");
