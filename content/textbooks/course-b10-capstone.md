# 一套可加载、可调试、可维护的字符驱动

```zhizhan-anchor
capstone
```



把 13 章串成一条可验收的路径：写模块 → 注册字符设备 → 用互斥保护 → 上半部/下半部处理中断 → 绑定设备树 platform → 暴露 sysfs/ioctl → 加 [DMA](term:dma) 与电源管理 → 用 ftrace/debugfs 调试并跨版本维护。



> ◈ 11 步构建路径 · ⚑ 每步可验收

 

把 13 章串成一条可验收的路径： **写模块 → 注册字符设备 → 用互斥保护 → 上半部/下半部处理中断 → 绑定设备树 platform → 暴露 sysfs/ioctl → 加 DMA 与电源管理 → 用 ftrace/debugfs 调试并跨版本维护。**

 

 
1. **① 模块** （M01）——init/exit \+ 参数 \+ 引用计数；验收：ref\>0 拒绝卸载。
 
2. **② 字符设备** （M02）——设备号 \+ cdev \+ fops；验收：copy\_\*\_user 与 ioctl 校验。
 
3. **③ 并发** （M03）——统一锁顺序；验收：无死锁、自旋锁内不睡眠。
 
4. **④ 中断** （M04）——上半部极短 \+ 下半部；验收：ISR 只登记下半天。
 
5. **⑤ platform** （M05）——compatible 匹配 \+ deferred probe；验收：依赖就绪后 probe。
 
6. **⑥ 子系统资源** （M06）——GPIO/clk/regulator；验收：资源失败可区分 defer/错误。
 
7. **⑦ 总线器件** （M07/M11）——[I²C](term:i2c)/SPI 读写 \+ WHO\_AM\_I；验收：自检通过。
 
8. **⑧ DMA** （M08）——一致性与 mmap；验收：数据方向正确、无脏读。
 
9. **⑨ 子系统** （M09）——注册进合适的子系统；验收：用户态标准接口可用。
 
10. **⑩ 供电** （M12）——runtime PM；验收：get/put 配对、空闲挂起。
 
11. **⑪ 调试与维护** （M10/M13）——debugfs \+ 回归测试；验收：可观测、可跨版本。
 

 

本册所有板上项（真实中断延迟、总线波形、功耗、器件读数、跨内核版本编译）均标注为“需上板”，未接板不声称已测；字符设备分派、并发/锁、上下半部、platform 匹配、sysfs、I2C、DMA、runtime PM 等主机可验证的部分已给出真实运行结果。



driver skeletonC

 

```text
/* 驱动骨架（示意）：module + char device + platform + runtime PM */
#include <linux/module.h>
#include <linux/fs.h>
#include <linux/platform_device.h>
#include <linux/pm_runtime.h>

/* 自定义设备结构体持有 cdev 与 struct device*；用 container_of 从 inode 反查 */
static int my_open(struct inode *i, struct file *f) { struct my_dev *d = container_of(i->i_cdev, struct my_dev, cdev); pm_runtime_get_sync(d->dev); return 0; }
static int my_release(struct inode *i, struct file *f) { struct my_dev *d = container_of(i->i_cdev, struct my_dev, cdev); pm_runtime_put(d->dev); return 0; }
static const struct file_operations my_fops = { .owner = THIS_MODULE, .open = my_open, .release = my_release };

static int my_probe(struct platform_device *pdev) { dev_info(&pdev->dev, "probed\n"); return 0; }
static const struct of_device_id my_of[] = { { .compatible = "demo,mydev" }, {} };
static struct platform_driver my_drv = { .probe = my_probe,
    .driver = { .name = "mydev", .of_match_table = my_of } };
module_platform_driver(my_drv);
MODULE_LICENSE("GPL");
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
