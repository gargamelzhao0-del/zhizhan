# 故障注入、长跑与性能回归

```zhizhan-anchor
m11
```



可靠性靠 **主动注入故障** 与 **长跑** 验证：断网、掉电、资源耗尽、总线异常，看系统能否恢复且不退化。

 

> 前置：Module 10 的风险驱动测试与 Module 04 HIL。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能断网/掉电/资源耗尽/总线异常注入并统计恢复率，用性能基线做回归门禁。

 

本章速览




- 主动注入断网/掉电/资源耗尽，验证恢复与不退化。

- 长跑暴露泄漏与漂移。

- 性能回归要有基线与阈值。

 

```zhizhan-anchor
m11-model
```



```zhizhan-anchor
m11-model-t
```



## 11.1 注入什么、看什么



主动注入断网/掉电/资源耗尽/总线异常，观察系统能否恢复且不退化。长跑暴露泄漏与漂移；性能要有基线与阈值。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  故障注入的闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="故障注入的闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">设计注入</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">执行</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">观察恢复</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">统计/回归</text></svg>
```



设计注入 → 执行 → 观察恢复 → 统计恢复率 → 不可恢复项进根因/回归。



表 11.1 注入类型与标准



| 注入 | 观察 | 通过标准 |
| --- | --- | --- |
| 断网 | 重连/补传 | 不丢数据 |
| 掉电 | 重启一致性 | 可启动、不丢关键状态 |
| 资源耗尽 | 降级/拒绝 | 不崩 |
| 总线异常 | 超时/恢复 | 可恢复 |
| 长跑 | 泄漏/漂移 | 指标稳定 |



inject.c 节选C

 

```text
inject(NET_DOWN);    check_recover(&restored);
inject(POWER_CUT);   check_recover(&restored);
inject(RES_EXHAUST); check_recover(&restored);
report(recovered, total);   // 恢复率 = 恢复/注入
```

注入多类故障，统计恢复率并标记不可恢复项



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：恢复率



下面这段主机程序统计多类故障的恢复率并标记不可恢复项：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_faultinject.cC\n\n \n\n```text\n/* host_faultinject.c —— 故障注入与恢复统计（主机可运行）。\n * 主动注入故障（总线错误/超时/断网），验证系统能恢复并统计恢复率。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_faultinject.c -o host_faultinject && ./host_faultinject\n */\n#include <stdio.h>\ntypedef enum { F_HW, F_TIMEOUT, F_NET } fault_t;\nstatic int recover(fault_t f) { return (f == F_TIMEOUT) ? 1 : (f == F_NET ? 1 : 0); }  /* 硬件故障模拟不可恢复 */\nint main(void) {\n    int ok = 1, injected = 0, recovered = 0;\n    fault_t faults[] = { F_TIMEOUT, F_NET, F_TIMEOUT, F_HW, F_NET };\n    int n = (int)(sizeof(faults) / sizeof(faults[0]));\n    for (int i = 0; i < n; i++) { injected++; if (recover(faults[i])) recovered++; }\n    printf(\"注入=%d 恢复=%d 恢复率=%d%%\\n\", injected, recovered, recovered * 100 / injected);\n    if (!(recovered == 4 && injected == 5)) ok = 0;\n    int fail_rate = (injected - recovered) * 100 / injected;\n    printf(\"未恢复率=%d%%（需记录并人工介入）\\n\", fail_rate);\n    if (fail_rate != 20) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n故障注入恢复率模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_faultinject.c -o labs/host_faultinject && ./labs/host_faultinject
注入=5 恢复=4 恢复率=80%
未恢复率=20%（需记录并人工介入）
RESULT: PASS
```



恢复率 80%；未恢复 20% 不能自愈，必须记录根因并纳入回归。



表 11.2 可靠性指标



| 指标 | 当前 | 目标 |
| --- | --- | --- |
| 恢复率 | 80% | 越高越好 |
| 未恢复 | 20% | 逐个根因 |
| 长跑漂移 | — | 稳定 |
| 性能回归 | — | ±阈值内 |



```zhizhan-anchor
m11-regress
```



```zhizhan-anchor
m11-regress-t
```



## 11.3 性能基线与回归门禁



每次提交跑基准，与基线比较；偏离超过阈值就告警/阻断。测试环境必须一致，否则比较无意义。



regress.sh 节选Shell

 

```text
run_bench > cur.txt
diff_pct=$(compare baseline.txt cur.txt)   # 与基线比较
if (( $(echo "$diff_pct > 10" | bc -l) )); then
  echo "regression ${diff_pct}%"; exit 1     # 超阈值即门禁失败
fi
```

性能回归：与基线对比，超阈值即门禁失败



表 11.3 性能回归要求



| 要求 | 做法 | 理由 |
| --- | --- | --- |
| 基线 | 记录黄金环境数据 | 可比 |
| 阈值 | ±X% 告警/阻断 | 防退化 |
| 环境一致 | 固定频率/负载 | 数据可信 |
| 长跑 | 小时/天级 | 暴露泄漏/漂移 |



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 自检与三路线对照



可靠性自检：有注入、有长跑、有基线、有回归门禁。



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  恢复率与不可恢复项（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="恢复率与不可恢复项（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">可自愈</text><rect x="150" y="26" width="480" height="18" rx="4" class="sv-grn-s"></rect><text x="638" y="43" class="sv-lbl-hi">80%</text><text x="12" y="67" class="sv-lbl">需人工</text><rect x="150" y="50" width="120" height="18" rx="4" class="sv-red-s"></rect><text x="278" y="67" class="sv-lbl-hi">20%</text></svg>
```



绝大多数故障应能自愈；不可恢复的要逐一给出根因与错误处理改进。



表 11.4 三路线可靠性验证



| 路线 | 可靠性验证 | 说明 |
| --- | --- | --- |
| MCU 工程 | 注入 \+ 看门狗 \+ pstore | 常见 |
| Linux 工程 | chaos \+ 长跑 \+ perf | 成熟 |
| CI/自动化 | 定时长跑 \+ 回归告警 | 规模 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **不注入故障** ：异常路径从没测过。

- **长跑时间太短** ：泄漏/漂移发现不了。

- **无性能基线** ：退化无人知。

- **环境不一致** ：数据不可比。



◆ 自测 · Module 11（先答再看）




1. 为什么“故障注入”比只测正常路径更有价值？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"现场故障大多在异常路径（断网/掉电/超时）。主动注入能在实验室暴露这些问题，并验证恢复策略是否真的有效。"}
   ```

2. 性能回归为什么必须有“基线”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有基线就无法判断“是否退化”。基线提供了可比参照，超阈值即可告警/阻断。"}
   ```

3. 长跑测试主要暴露什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内存/句柄泄漏、长时间漂移、资源缓慢增长等短测看不出来的问题。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统做一次断网/掉电/资源耗尽注入与一次长跑，记录恢复率与性能基线。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/)

 

动手练习



运行 ` labs/host_faultinject.c `：注入多类故障并统计恢复率，识别不可恢复项。



**检查结果：** 注入=5、恢复=4、恢复率=80%、未恢复率=20%；有性能基线与回归阈值。

 

迁移练习：把本章的“能断网/掉电/资源耗尽/总线异常注入并统计恢复率，用性能基线做回归门禁。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m11","criterion":"注入=5、恢复=4、恢复率=80%、未恢复率=20%；有性能基线与回归阈值。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
