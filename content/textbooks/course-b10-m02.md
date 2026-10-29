# 字符设备

```zhizhan-anchor
m02
```



字符设备是“以字节流访问”的设备：内核把用户态的 open/read/write/ioctl 分派到驱动的 ` file_operations `。 **主设备号** 标识驱动， **次设备号** 标识实例。安全的关键是：用户指针必须用 ` copy_*_user `。

 

> 前置：Module 01 模块生命周期与引用计数。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写出按 minor 分派 open/read/write/ioctl、用 copy\_\*\_user 的字符设备驱动骨架。

 

本章速览




- 字符设备把 open/read/write/ioctl 分派到 file\_operations；主/次号标识驱动与实例。

- 用户态指针必须 copy\_to/from\_user，不能直接解引用。

- ioctl 要校验命令与参数，否则一个越界写就破坏内核。

 

```zhizhan-anchor
m02-model
```



```zhizhan-anchor
m02-model-t
```



## 2.1 字符设备模型：设备号 \+ cdev \+ fops



字符设备注册分三步： **申请设备号** （主/次）、 **注册 cdev** 、 **实现 file\_operations** 。用户态 ` open("/dev/mydev0") ` 时，内核用设备号找到驱动，把后续 read/write/ioctl 分派到你的 fops。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  设备号：主号标识驱动，次号标识实例



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="设备号：主号标识驱动，次号标识实例" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">主设备号（一个驱动）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">次设备号 0 → mydev0</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">次设备号 1 → mydev1</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">次设备号 9 → 不存在（拒绝）</text></svg>
```



同一个主设备号下可有多个次设备号（实例）。驱动在 open 里根据 minor 选择对应实例，读越界 minor 应拒绝。



表 2.1 字符设备的五件套



| 接口 | 职责 | 要点 |
| --- | --- | --- |
| alloc\_chrdev\_region | 动态申请设备号 | 记录主/次号 |
| cdev\_init/add | 注册字符设备 | add 失败要回滚 |
| read/write | 用户↔内核数据 | copy\_to/from\_user |
| ioctl | 控制命令 | 校验命令与参数 |
| udev/mknod | 创建 /dev 节点 | 主/次号一致 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：分派与返回值



下面这段程序模型化“按 minor 分派 \+ read/write/ioctl 返回值 \+ 非法 minor 拒绝”：



host\_chardev.cC

 

```text
/* host_chardev.c —— 字符设备 file_operations 分派模型（主机可运行）。
 *
 * 用户态 open/read/write/ioctl 会分派到驱动的 fops；minor 决定具体设备实例。
 * 本程序用一张设备表验证：按 minor 找到设备、分派到 fops、非法 minor 被拒绝。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_chardev.c -o host_chardev && ./host_chardev
 */
#include <stdio.h>
#include <string.h>

typedef struct {
    int (*open)(int minor);
    int (*read)(char *buf, int n);
    int (*write)(const char *buf, int n);
    int (*ioctl)(unsigned cmd, void *arg);
} fops_t;

typedef struct { const char *name; int minor; const fops_t *fops; int opened; char data[16]; } cdev_t;

static int dev0_open(int m) { (void)m; return 0; }
static int dev0_read(char *b, int n) { memcpy(b, "hello", n < 5 ? n : 5); return 5; }
static int dev0_write(const char *b, int n) { (void)b; return n; }
static int dev0_ioctl(unsigned cmd, void *arg) { *(int *)arg = (cmd == 0x10) ? 1 : 0; return 0; }

static const fops_t DEV0 = { dev0_open, dev0_read, dev0_write, dev0_ioctl };
static cdev_t g_devs[] = { { "mydev0", 0, &DEV0, 0, {0} } };
#define ND (int)(sizeof(g_devs) / sizeof(g_devs[0]))

static cdev_t *find_minor(int m) { for (int i = 0; i < ND; i++) if (g_devs[i].minor == m) return &g_devs[i]; return 0; }

int main(void) {
    int ok = 1;
    cdev_t *d = find_minor(0);
    printf("按 minor=0 找到设备: %s\n", d ? d->name : "(无)");
    if (!d) ok = 0;
    if (d->fops->open(d->minor) != 0) ok = 0;

    char buf[16] = {0};
    int n = d->fops->read(buf, 5);
    printf("read 返回 %d，内容=\"%s\"\n", n, buf);
    if (!(n == 5 && strcmp(buf, "hello") == 0)) ok = 0;

    int wn = d->fops->write("abc", 3);
    printf("write 返回 %d\n", wn);
    if (wn != 3) ok = 0;

    int v = 0;
    d->fops->ioctl(0x10, &v);
    printf("ioctl(0x10) → %d（期望 1）\n", v);
    if (v != 1) ok = 0;

    cdev_t *bad = find_minor(9);
    printf("minor=9 → %s（期望“不存在”）\n", bad ? "存在" : "不存在");
    if (bad) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

字符设备分派模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_chardev.c -o labs/host_chardev && ./labs/host_chardev
按 minor=0 找到设备: mydev0
read 返回 5，内容="hello"
write 返回 3
ioctl(0x10) → 1（期望 1）
minor=9 → 不存在（期望“不存在”）
RESULT: PASS
```



read 返回字节数、write 返回写入字节数、ioctl 返回命令结果、非法 minor 拒绝——这些都是驱动接口的“契约”。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  一次 read 的分派路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次 read 的分派路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">用户 read</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">VFS</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">fops.read</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">copy_to_user</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">返回字节数</text></svg>
```



用户 read → VFS → 你的 fops.read → 用 copy\_to\_user 把内核数据拷到用户缓冲区 → 返回字节数。用户指针不能直接解引用。



```zhizhan-anchor
m02-copy
```



```zhizhan-anchor
m02-copy-t
```



## 2.3 用户态拷贝与 ioctl 安全



用户态指针 **不能直接解引用** ：它在当前上下文可能无效（换出/非法）。必须用 ` copy_to_user/copy_from_user `，它们能安全处理缺页并返回未拷贝字节数。ioctl 必须 **校验命令与参数** ，否则一个越界写就能破坏内核。



mydev\_read.c 节选C

 

```text
static ssize_t mydev_read(struct file *f, char __user *buf,
                          size_t len, loff_t *off) {
    if (*off >= DATA_LEN) return 0;              // EOF
    size_t n = min(len, (size_t)(DATA_LEN - *off));
    if (copy_to_user(buf, data + *off, n))       // 安全拷贝
        return -EFAULT;
    *off += n;
    return n;                                    // 返回字节数
}
```

copy\_to\_user 失败返回 -EFAULT；成功返回拷贝字节数



表 2.2 用户态接口的安全清单



| 操作 | 安全做法 | 不安全后果 |
| --- | --- | --- |
| 读用户写内核 | copy\_from\_user | 直接解引用 → 页错误 |
| 写内核到用户 | copy\_to\_user | 同上 |
| ioctl 命令 | 校验 type/nr/size | 非法命令破坏内部状态 |
| 长度 | 与缓冲区大小比较 | 越界读写 |
| 返回值 | 失败返回负 errno | 用户误判成功 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm02-routes\n```\n\n\n\n```zhizhan-anchor\nm02-routes-t\n```\n\n\n\n## 2.3 三条内核路线对照：字符设备\n\n\n\n三条路线的字符设备注册 API 一致（cdev \\+ fops），差异在设备节点创建方式（udev 规则/静态节点）。\n\n\n\n表 2.3 三条路线的节点创建\n\n\n\n| 内核路线 | 设备号 | 节点创建 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | 动态申请 | udev 规则自动建节点 | mainline |\n| i.MX6ULL | 动态申请 | udev 或 mdev | BSP mainline |\n| V3s | 动态申请 | mdev/udev | mainline sunxi |"}
````



```zhizhan-anchor
m02-err
```



```zhizhan-anchor
m02-err-t
```



## 2.4 返回值与错误码速查



字符设备的每个回调都有“返回值契约”：成功返回字节数/0，失败返回负 errno。用户态据此判断成败。



表 2.4 字符设备返回值契约



| 返回值 | 含义 | 出现位置 |
| --- | --- | --- |
| 正数 | 已处理字节数 | read/write |
| 0 | EOF / 成功 | read 到末尾、ioctl |
| -EFAULT | 用户缓冲不可访问 | copy\_\*\_user 失败 |
| -EINVAL | 参数/命令非法 | ioctl 校验失败 |
| -ENODEV | 设备不存在 | open 找不到实例 |
| -EAGAIN | 暂时不可用（非阻塞） | O\_NONBLOCK 下无数据 |



user\_selftest.sh 节选Shell

 

```text
cat /proc/devices | grep mydev     # 主设备号是否注册
ls -l /dev/mydev0                  # 节点主/次号
echo hi > /dev/mydev0              # 触发 write
cat /dev/mydev0                    # 触发 read
dmesg | tail                        # 看驱动打印/错误
```

从用户态验证字符设备端到端通路



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **直接解引用用户指针** ：内核页错误/任意地址写。

- **设备号申请失败不回滚** ：资源泄漏。

- **ioctl 不校验命令** ：非法命令破坏内部状态。

- **次设备号越界** ：访问到不存在的实例。



◆ 自测 · Module 02（先答再看）




1. 为什么不能用 memcpy 把数据拷到用户缓冲区？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用户态地址在当前上下文不一定有效（可能换出/非法）。必须用 copy\\_to\\_user，它能安全处理缺页并返回未拷贝字节数。"}
   ```

2. 主设备号和次设备号各标识什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"主设备号标识 **驱动** ，次设备号标识该驱动下的 **实例** 。open 时内核按设备号找到驱动、驱动按 minor 选择实例，越界 minor 应拒绝。"}
   ```

3. ioctl 为什么必须校验命令？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用户可传任意命令值；不校验就可能命中未预期的分支、越界访问或破坏内部状态。应按 type/nr/size 校验并只处理已知命令。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目的字符设备补上完整的 read/write/ioctl 参数校验与 copy\_\*\_user 错误处理。



核对与延伸：[Linux 内核文档 · Devicetree](https://www.kernel.org/doc/html/latest/devicetree/usage-model.html)

 

动手练习



运行 ` labs/host_chardev.c `：按 minor 找到设备并分派到 fops，非法 minor 被拒绝。



**检查结果：** minor=0 命中 mydev0；read 返回 5 内容 "hello"；write 返回 3；ioctl(0x10)=1；minor=9 判“不存在”。

 

迁移练习：把本章的“能写出按 minor 分派 open/read/write/ioctl、用 copy\_\*\_user 的字符设备驱动骨架。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m02","criterion":"minor=0 命中 mydev0；read 返回 5 内容 \"hello\"；write 返回 3；ioctl(0x10)=1；minor=9 判“不存在”。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
