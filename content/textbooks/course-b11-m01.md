# 系统编程

```zhizhan-anchor
m01
```



Linux 应用的底座是 **系统调用** 。几乎每个调用都可能失败：必须检查返回值、读取 ` errno `，并处理 **短读/短写** 与  **EINTR/EAGAIN** ——“主机上好好的、进板子就崩”常源于此。

 

> 前置：C 语言与 Linux 系统调用基础（open/read/write）。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写出对每个系统调用检查返回值、处理 errno/EINTR/EAGAIN 并循环读满的 I/O 代码。

 

本章速览




- 每个系统调用都检查返回值与 errno；EINTR/EAGAIN 要重试。

- 短读/短写要循环到期望长度。

- 无超时的阻塞会让程序永久卡住。

 

```zhizhan-anchor
m01-model
```



```zhizhan-anchor
m01-model-t
```



## 1.1 系统调用与 errno：检查返回值是硬规则



系统调用由内核执行，任何一步都可能失败。硬规则： **每个调用都检查返回值** ，失败时读 ` errno ` 判断原因。把“不检查返回值”当 bug 处理，是应用稳定的第一步。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  系统调用的处理路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="系统调用的处理路径" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">调用</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">返回值检查</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">读 errno</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">重试/报错</text></svg>
```



调用 → 返回值 ≥0？成功：继续；失败：读 errno → 分类处理（重试/报错/降级）。



表 1.1 系统编程的五个坑



| 问题 | 现象 | 处理 |
| --- | --- | --- |
| 忽略返回值 | 错误被当成功 | 检查并处理 errno |
| 短读/短写 | 数据不完整 | 循环直到达到期望长度 |
| EINTR | read 被信号打断 | 重试循环 |
| EAGAIN | 非阻塞暂无数据 | poll/等待后重试 |
| 超时 | 永久阻塞 | 设置超时或非阻塞\+轮询 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：循环读满



下面这段主机程序演示有限次 EAGAIN/EINTR 与短读；不代表真实描述符的就绪等待：



host\_syscall.cC

 

```text
/* Bounded I/O control-flow model, not an OS poll/epoll implementation.
 * Distinguishes partial progress, would-block, interrupted call and EOF.
 * The outer event-loop wait below is counted, not implemented as busy polling. */
#include <stdio.h>
#include <string.h>
#include <errno.h>
typedef struct {const char *data;int size,offset,calls;} ModelFd;
static int model_read(ModelFd *f,char *out,int capacity) {
    ++f->calls;
    if(f->calls==1){errno=EAGAIN;return -1;}
    if(f->calls==2){errno=EINTR;return -1;}
    int n=f->size-f->offset;
    if(n>capacity)n=capacity;
    if(n>2)n=2;
    memcpy(out,f->data+f->offset,(size_t)n);f->offset+=n;return n;
}
static int receive(ModelFd *f,char *out,int wanted,int *waits) {
    int total=0;
    for(int attempts=0;attempts<20 && total<wanted;++attempts) {
        int n=model_read(f,out+total,wanted-total);
        if(n<0) {
            if(errno==EINTR)continue;
            if(errno==EAGAIN){++*waits;continue;} /* model: yield and wait for readiness */
            return -1;
        }
        if(n==0)break; /* EOF must not spin */
        total+=n;
    }
    return total;
}
int main(void) {
    ModelFd f={"abcdef",6,0,0};char out[8]={0};int waits=0;
    int n=receive(&f,out,6,&waits);
    int ok=n==6 && !memcmp(out,"abcdef",6) && waits==1;
    ModelFd short_file={"abc",3,0,0};waits=0;
    ok &= receive(&short_file,out,6,&waits)==3;
    printf("short reads / EINTR / EAGAIN wait / early EOF: %s\n",ok?"PASS":"FAIL");
    return !ok;
}
```

系统调用返回值/重试模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_syscall.c -o labs/host_syscall && ./labs/host_syscall
short reads / EINTR / EAGAIN wait / early EOF: PASS
```



一次 read 只给一部分（短读），遇 EAGAIN 需重试，循环到读满 6 字节才结束。



表 1.2 常见 errno 与动作



| errno | 含义 | 动作 |
| --- | --- | --- |
| EINTR | 被信号打断 | 重试 |
| EAGAIN/EWOULDBLOCK | 非阻塞暂无数据 | 等待/重试 |
| EIO | I/O 错误 | 报错/降级 |
| EBADF | 无效 fd | 程序错误 |
| EPIPE | 对端关闭 | 结束并向上层报告 |



```zhizhan-anchor
m01-loop
```



```zhizhan-anchor
m01-loop-t
```



## 1.3 短读/短写与超时



` read/write ` 可能只完成一部分。` write ` 对非阻塞 fd 也可能短写。正确做法是 **循环** 直到达到期望长度，并给阻塞操作设超时。



read\_full.c 节选C

 

```text
ssize_t r = 0;
while (r < want) {
    ssize_t n = read(fd, buf + r, want - r);
    if (n < 0) {
        if (errno == EINTR) continue;
        if (errno == EAGAIN || errno == EWOULDBLOCK) return r; // 返回已读长度，由事件循环等待后继续
        return -1;                                        // 真错误
    }
    if (n == 0) break;      // EOF：对端关闭
    r += n;
}
```

片段：EINTR 重试；EAGAIN 返回已收长度由 poll/epoll 驱动继续。生产接口需区分 WOULD\_BLOCK、EOF 与完整结果，并设置截止时间



表 1.3 短读/短写的正确处理



| 场景 | 错误做法 | 正确做法 |
| --- | --- | --- |
| 短读 | 读一次当完整 | 循环到 want |
| 短写 | send 一次当发完 | 循环发完 |
| 阻塞 | 无超时永久等 | SO\_RCVTIMEO/poll |
| EOF | 当错误处理 | r==0 结束循环 |



```zhizhan-anchor
m01-route
```



```zhizhan-anchor
m01-route-t
```



## 1.4 三路线对照与自检



应用层系统编程与构建路线无关，但三条路线的库/工具链不同，影响可用 API 与调试手段。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  三路线对应用层的差异（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="三路线对应用层的差异（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">Buildroot</text><rect x="150" y="26" width="491" height="18" rx="4" class="sv-cyn-s"></rect><text x="649" y="43" class="sv-lbl-hi">90(相对)</text><text x="12" y="67" class="sv-lbl">Yocto</text><rect x="150" y="50" width="436" height="18" rx="4" class="sv-grn-s"></rect><text x="594" y="67" class="sv-lbl-hi">80(相对)</text><text x="12" y="91" class="sv-lbl">Debian</text><rect x="150" y="74" width="545" height="18" rx="4" class="sv-amb-s"></rect><text x="703" y="91" class="sv-lbl-hi">100(相对)</text></svg>
```



Buildroot(glibc) 与 Debian(glibc) 应用 API 基本一致；Yocto SDK 提供配套 sysroot。差异在部署与工具，不在 syscall。



errno\_classify.c 节选C

 

```text
switch (errno) {
  case EINTR: case EAGAIN:  return RETRY;      // 暂时性，重试
  case EPIPE: case ECONNRESET: return CLOSED;  // 对端关闭
  default:                  return FATAL;      // 真错误，上报
}
```

把 errno 分类为“重试/关闭/致命”，决定上层动作



表 1.4 三路线对照



| 路线 | libc | 工具链 | 对应用的影响 |
| --- | --- | --- | --- |
| Buildroot | glibc/musl | 内置工具链 | syscall 一致 |
| Yocto | glibc | SDK | API 一致，需 SDK |
| Debian | glibc | apt 工具链 | 包最全 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **不检查返回值** ：错误被当成成功。

- **不处理短读** ：数据截断，协议解析失败。

- **被 EINTR 打断就失败** ：信号一来就读不到数据。

- **无超时的阻塞** ：链路异常时永久卡住。



◆ 自测 · Module 01（先答再看）




1. read() 返回 0 表示什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"通常表示对端已关闭连接（EOF），不是错误。要据此结束读取循环，而不是继续读。"}
   ```

2. 为什么 write 也要循环（短写）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"非阻塞 fd 或缓冲区满时 write 可能只发一部分。必须循环直到发完，否则数据被截断。"}
   ```

3. EINTR/EAGAIN 分别该怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"两者都表示“暂时没完成”：EINTR 是信号打断、EAGAIN 是非阻塞无数据，都应重试（或等待后重试），而不是当致命错误。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：审计你项目里所有 read/write：补上返回值检查、短读短写循环与超时。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_syscall.c `：验证 EAGAIN 重试与循环读满。



**检查结果：** 读满 6 字节且内容 "abcdef"；EAGAIN/EINTR 被重试；循环到达到期望长度才结束。

 

迁移练习：把本章的“能写出对每个系统调用检查返回值、处理 errno/EINTR/EAGAIN 并循环读满的 I/O 代码。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m01","criterion":"读满 6 字节且内容 \"abcdef\"；EAGAIN/EINTR 被重试；循环到达到期望长度才结束。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
