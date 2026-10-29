# 进程间通信

```zhizhan-anchor
m02
```



多进程协作要选对 IPC：管道简单但单向、共享内存最快但要自己同步、消息队列/UDS 保留边界、信号只适合通知。有界队列是常见形态：满则拒、空则等。

 

> 前置：Module 01 系统编程的返回值与错误处理。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现有界队列/管道式 IPC，做到满则拒、空则等待且按序取出。

 

本章速览




- IPC 选型看边界与同步：管道是字节流，共享内存要自己同步。

- 有界队列要明确满/空语义。

- 信号处理函数里只能做异步安全操作。

 

```zhizhan-anchor
m02-model
```



```zhizhan-anchor
m02-model-t
```



## 2.1 选对 IPC：边界与同步



不同 IPC 的差别在“ **是否保留消息边界** ”和“ **要不要自己同步** ”：管道是字节流（无边界）、共享内存最快但要配信号量、消息队列/UDS 保留边界、信号只适合异步通知。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  IPC 选型决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="IPC 选型决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">要边界?</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">求速度?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">选 IPC</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">定同步</text></svg>
```



要边界吗？→ 要则 UDS/消息队列；不要但求快→共享内存\+信号量；只是通知→信号。



表 2.1 常见 IPC 对比



| IPC | 特点 | 注意 |
| --- | --- | --- |
| pipe/FIFO | 字节流 | 无消息边界 |
| 共享内存 | 零拷贝最快 | 需配信号量同步 |
| 消息队列 | 保留边界 | 容量有限 |
| UDS socket | 双向、可传 fd | 推荐用于本地服务 |
| 信号 | 异步通知 | 处理函数里只能异步安全操作 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：有界队列的满/空



有界队列是 IPC 的常见形态。下面这段主机程序验证满/空边界与按序取出：



host\_ipc.cC

 

```text
/* host_ipc.c —— 进程间通信：管道/环形缓冲的生产者-消费者模型（主机可运行）。
 * 管道是字节流；共享内存在多进程下要自己同步。本程序模拟有界 FIFO 的 push/pop 与阻塞语义。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ipc.c -o host_ipc && ./host_ipc
 */
#include <stdio.h>
#define CAP 4
typedef struct { int buf[CAP]; int head, tail, count; } fifo_t;
static int push(fifo_t *q, int v) { if (q->count == CAP) return -1; q->buf[q->tail] = v; q->tail = (q->tail + 1) % CAP; q->count++; return 0; }
static int pop(fifo_t *q, int *v) { if (q->count == 0) return -1; *v = q->buf[q->head]; q->head = (q->head + 1) % CAP; q->count--; return 0; }
int main(void) {
    int ok = 1; fifo_t q = {{0}, 0, 0, 0};
    for (int i = 1; i <= 4; i++) if (push(&q, i) != 0) ok = 0;
    printf("填满后 count=%d，再 push: %d（期望 -1 满）\n", q.count, push(&q, 9));
    if (push(&q, 9) != -1) ok = 0;
    int v = 0, good = 1;
    for (int i = 1; i <= 4; i++) { if (pop(&q, &v) != 0 || v != i) good = 0; }
    printf("按序取出=%s  count=%d（期望 1..4、0）\n", good ? "是" : "否", q.count);
    if (!good || q.count != 0) ok = 0;
    printf("空时 pop: %d（期望 -1 空）\n", pop(&q, &v));
    if (pop(&q, &v) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

有界 FIFO 边界模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ipc.c -o labs/host_ipc && ./labs/host_ipc
填满后 count=4，再 push: -1（期望 -1 满）
按序取出=是  count=0（期望 1..4、0）
空时 pop: -1（期望 -1 空）
RESULT: PASS
```



满则拒绝、空则拒绝、按序取出——这是所有 IPC 缓冲的共同契约。



表 2.2 有界队列的状态机



| 状态 | push | pop |
| --- | --- | --- |
| 空 | 成功 | 失败(-1) |
| 非空非满 | 成功 | 成功 |
| 满 | 失败(-1) | 成功 |
| 计数 | count\+\+ | count-- |



```zhizhan-anchor
m02-detail
```



```zhizhan-anchor
m02-detail-t
```



## 2.3 UDS 与共享内存的落地



本地服务优先用  **Unix domain socket** ：双向、保留边界、还能传 fd。共享内存最快但要自己配信号量同步，否则读写交错。



uds\_seqpkt.c 节选C

 

```text
int s = socket(AF_UNIX, SOCK_SEQPACKET, 0);   // 保留消息边界
struct sockaddr_un a = { .sun_family = AF_UNIX };
strncpy(a.sun_path, "/tmp/svc.sock", sizeof a.sun_path - 1);
bind(s, (struct sockaddr *)&a, sizeof a);
/* SOCK_SEQPACKET：每次 recv 拿到一条完整消息，天然分帧 */
```

UDS SOCK\_SEQPACKET 保留边界，本地服务首选



表 2.3 IPC 落地选择



| 选择 | 何时用 | 代价 |
| --- | --- | --- |
| pipe/FIFO | 简单单向流 | 无边界 |
| UDS SOCK\_SEQPACKET | 本地结构化消息 | 需管理 socket 文件 |
| 共享内存\+信号量 | 高频大数据 | 同步复杂 |
| 消息队列 | 有边界、可阻塞 | 容量受限 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与三路线对照



IPC 自检聚焦“边界正确、不丢不重、异常可清理”：



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  有界队列的 head/tail/count



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="有界队列的 head/tail/count" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">head（入队位置）</text><rect x="60" y="64" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">缓冲区（容量=4）</text><rect x="60" y="108" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="127.0" class="sv-lbl-hi">tail（出队位置）</text><rect x="60" y="142" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="161.0" class="sv-lbl-hi">count（判满/空）</text></svg>
```



head 入、tail 出，count 判满/空；回绕用掩码。边界判断错会出现“偶尔丢消息”。



ipc\_pick.c 节选C

 

```text
/* 要边界：优先 UDS 或消息队列 */
int s = socket(AF_UNIX, SOCK_SEQPACKET, 0);
/* 求速度：共享内存 + 信号量 */
sem_wait(&mutex); memcpy(shm, data, n); sem_post(&mutex);
```

按“要不要边界、要不要同步”选 IPC



表 2.4 三路线 IPC 支持



| 路线 | 本地 IPC 支持 | 说明 |
| --- | --- | --- |
| Buildroot | 完整 UDS/共享内存 | 与标准 Linux 一致 |
| Yocto | 完整 | 一致 |
| Debian | 完整 \+ 工具 | 调试工具最全 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **共享内存不加同步** ：读写交错，数据错乱。

- **管道当消息用** ：无边界，粘包。

- **消息队列容量拍脑袋** ：突发时丢消息。

- **信号处理函数里做重活** ：只允许异步安全操作。



◆ 自测 · Module 02（先答再看）




1. 本地两个进程要传结构体且保留边界，优先选什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Unix domain socket（SOCK\\_SEQPACKET，或带长度前缀的 SOCK\\_STREAM）或消息队列。管道是字节流不保留边界，共享内存要自己同步。"}
   ```

2. 共享内存最快的代价是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"需要自己配合同步（信号量/互斥），否则读写交错导致数据错乱；且没有消息边界。"}
   ```

3. 为什么信号处理函数里不能做重活？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"信号是异步打断，处理函数里只能调用“异步信号安全”的函数（如 write），否则可能死锁/崩溃。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目的本地多进程通信选一种带边界的 IPC，并补上满/空与异常清理的处理。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_ipc.c `：验证有界 FIFO 的满/空边界与按序取出。



**检查结果：** 填满 count=4 且再 push=-1；按序取出 1..4、count=0；空时 pop=-1。

 

迁移练习：把本章的“能实现有界队列/管道式 IPC，做到满则拒、空则等待且按序取出。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m02","criterion":"填满 count=4 且再 push=-1；按序取出 1..4、count=0；空时 pop=-1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
