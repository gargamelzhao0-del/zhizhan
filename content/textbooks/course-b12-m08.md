# 现场问题定位

```zhizhan-anchor
m08
```



现场问题第一要务是 **保留证据** ：设备身份、固件与参数版本、日志/崩溃转储、发生条件。没有证据，定位只能靠猜。

 

> 前置：Module 07 的追溯与证据留存。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按“保留现场→缩小范围→复现→二分→根因”定位现场问题并把纠正措施进回归。

 

本章速览




- 现场先保留证据：版本快照\+日志\+转储\+条件。

- 稳定复现后用二分缩小范围。

- 纠正措施进回归，防止复发。

 

```zhizhan-anchor
m08-model
```



```zhizhan-anchor
m08-model-t
```



## 8.1 现场定位的流程



流程： **保留现场 → 缩小范围 → 稳定复现 → 二分定位 → 根因与纠正措施** 。纠正措施要进回归，防止同样的问题再次发生。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  现场问题定位流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="现场问题定位流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">保留现场</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">缩小范围</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">复现</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">二分/根因</text></svg>
```



保留现场（身份/版本/日志/转储）→ 缩小范围 → 复现 → 二分 → 根因 → 纠正措施进回归。



表 8.1 现场证据要素



| 要素 | 作用 | 手段 |
| --- | --- | --- |
| 版本快照 | 确认现场版本 | 启动打印/查询 |
| 日志 | 时间线 | 本地\+远程 |
| 崩溃转储 | 现场栈 | pstore/core dump |
| 复现 | 稳定重现 | 按条件脚本化 |
| 二分 | 缩小范围 | 版本/参数二分 |



snapshot.c 节选C

 

```text
log_info("fw=%s cfg=%s sn=%s", fw_ver, cfg_ver, serial);  // 现场快照
dump_ringbuffer();                    // 保留日志
/* 崩溃：pstore/core dump 留现场栈 */
```

现场先保留“身份\+版本\+日志\+转储”，再谈定位



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：恢复率与不可恢复项



故障注入统计恢复/未恢复比例，明确哪些必须人工介入：



host\_faultinject.cC

 

```text
/* host_faultinject.c —— 故障注入与恢复统计（主机可运行）。
 * 主动注入故障（总线错误/超时/断网），验证系统能恢复并统计恢复率。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_faultinject.c -o host_faultinject && ./host_faultinject
 */
#include <stdio.h>
typedef enum { F_HW, F_TIMEOUT, F_NET } fault_t;
static int recover(fault_t f) { return (f == F_TIMEOUT) ? 1 : (f == F_NET ? 1 : 0); }  /* 硬件故障模拟不可恢复 */
int main(void) {
    int ok = 1, injected = 0, recovered = 0;
    fault_t faults[] = { F_TIMEOUT, F_NET, F_TIMEOUT, F_HW, F_NET };
    int n = (int)(sizeof(faults) / sizeof(faults[0]));
    for (int i = 0; i < n; i++) { injected++; if (recover(faults[i])) recovered++; }
    printf("注入=%d 恢复=%d 恢复率=%d%%\n", injected, recovered, recovered * 100 / injected);
    if (!(recovered == 4 && injected == 5)) ok = 0;
    int fail_rate = (injected - recovered) * 100 / injected;
    printf("未恢复率=%d%%（需记录并人工介入）\n", fail_rate);
    if (fail_rate != 20) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

故障注入恢复率模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_faultinject.c -o labs/host_faultinject && ./labs/host_faultinject
注入=5 恢复=4 恢复率=80%
未恢复率=20%（需记录并人工介入）
RESULT: PASS
```



恢复率 80%、未恢复 20%——未恢复项不能“自动自愈”，必须记录并人工介入。



表 8.2 现场定位指标



| 指标 | 含义 | 动作 |
| --- | --- | --- |
| 恢复率 | 自愈比例 | 越高越好 |
| 未恢复 | 需人工介入 | 记录根因 |
| 复现率 | 可稳定重现 | 才能二分 |
| 二分 | 版本/参数 | 缩到一次变更 |



```zhizhan-anchor
m08-evidence2
```



```zhizhan-anchor
m08-evidence2-t
```



## 8.3 保留现场的手段



设备要能自报身份与版本、保留日志与崩溃现场（pstore/core dump），并支持远程诊断。



diag.sh 节选Shell

 

```text
cat /etc/fw_version                 # 固件+参数版本
dmesg | tail -50                    # 最近日志
cat /sys/fs/pstore/console-ramoops-0  # 上次崩溃日志
# 带条件脚本化复现；在版本/参数空间二分定位
```

版本自报 \+ 日志/崩溃现场 \+ 脚本复现 \+ 二分



表 8.3 保留现场的手段



| 手段 | 作用 | 前提 |
| --- | --- | --- |
| 版本自报 | 确认现场版本 | 启动打印/查询接口 |
| pstore/core | 留崩溃栈 | 已配置 |
| 远程诊断 | 远程取证据 | 连通/安全通道 |
| 条件复现 | 稳定重现 | 记录触发条件 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与三路线对照



现场自检：能自报版本、能取日志/转储、能复现、能二分。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  从现场到根因的证据链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从现场到根因的证据链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">证据</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">复现</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">二分</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">根因/回归</text></svg>
```



证据（版本/日志/转储）→ 复现 → 二分 → 根因 → 纠正措施 → 回归验证。



表 8.4 三路线现场诊断



| 路线 | 现场诊断 | 说明 |
| --- | --- | --- |
| MCU 工程 | 版本打印 \+ pstore 类保留 | 常见 |
| Linux 工程 | journald/core dump | 成熟 |
| CI/自动化 | 远程采集 \+ 自动归档 | 规模化 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **无版本快照** ：不知道现场跑的是哪版。

- **日志无时间线** ：无法还原顺序。

- **不能稳定复现** ：改来改去靠碰运气。

- **纠正措施不进回归** ：问题复发。



◆ 自测 · Module 08（先答再看）




1. 为什么“二分定位”在嵌入式很有效？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在版本或参数空间做二分，能快速把问题范围缩小到一次变更/一个参数，尤其适合“偶发但可复现”的现场问题。"}
   ```

2. 现场定位第一步做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"保留证据：设备身份、固件/参数版本、日志与崩溃转储、发生条件。没有证据只能靠猜。"}
   ```

3. 纠正措施为什么必须进回归？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不进回归就没有验证，同样的问题可能在后续版本复发。纠正措施应转化为测试用例。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备加“版本自报 \+ 崩溃现场保留”，并把一次现场问题按“证据→复现→二分→根因”走一遍。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/)

 

动手练习



运行 ` labs/host_faultinject.c `：统计故障注入后的恢复/未恢复比例，明确哪些需人工介入。



**检查结果：** 注入=5、恢复=4、恢复率=80%、未恢复率=20%，未恢复项列出并人工介入。

 

迁移练习：把本章的“能按“保留现场→缩小范围→复现→二分→根因”定位现场问题并把纠正措施进回归。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m08","criterion":"注入=5、恢复=4、恢复率=80%、未恢复率=20%，未恢复项列出并人工介入。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
