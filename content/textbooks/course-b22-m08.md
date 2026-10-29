# 接口健壮性与安全测试

```zhizhan-anchor
m08
```



接口是攻击者最先碰的地方： **严格输入校验、模糊测试、内存安全检查** ，任何“未校验的输入”都可能是漏洞。

 

> 前置：会写 C 解析函数并理解缓冲区边界与不可信输入。 · ◷ 约 44 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对不可信输入做长度/范围/格式校验，使非法输入安全返回而不越界或崩溃。

 

本章速览




- 所有外部输入按不可信处理，严格校验。

- 模糊测试暴露崩溃/越界。

- 解析失败要安全返回。

 

```zhizhan-anchor
m08-input
```



```zhizhan-anchor
m08-input-t
```



## 8.1 不可信输入与边界校验



接口是攻击者最先碰的地方：严格输入校验、模糊测试、内存安全检查。所有外部输入都要按“不可信”处理，校验长度/范围/格式。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  输入校验流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="输入校验流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">输入</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验格式</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验范围</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">接受/拒绝</text></svg>
```



收到输入 → 校验分隔/格式 → 校验范围 → 通过则处理，失败安全返回（不越界/不崩溃）。



表 8.1 接口安全五问题



| 问题 | 手段 | 目标 |
| --- | --- | --- |
| 越界输入 | 边界校验 | 拒绝非法 |
| 模糊测试 | 畸形输入 | 崩溃/异常 |
| 内存安全 | ASAN/静态分析 | 越界/UAF |
| 拒绝服务 | 限流/超时 | 不被打死 |
| 权限绕过 | 鉴权每接口 | 默认拒绝 |



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：解析器拒绝非法输入



下面这段程序验证解析器验证指定前缀、长度、范围与字节边界；这不是穷尽证明：



host\_fuzz.cC

 

```text
/* Length-bounded parser exercise, not a claim to have fuzzed every input.
 * Grammar: SET:[0-9]{1,3}, numeric value 0..100; leading zeroes allowed.
 * Caller owns a readable n-byte input and writable out. Failure preserves out. */
#include <stdio.h>
#include <string.h>
#include <stddef.h>
static int parse(const char *s,size_t n,int *out) {
    if(!s || !out || n<5 || n>7 || memcmp(s,"SET:",4)!=0) return -1;
    int v=0;
    for(size_t i=4;i<n;++i) {
        if(s[i]<'0' || s[i]>'9') return -1;
        v=v*10+(s[i]-'0');
    }
    if(v>100) return -1;
    *out=v;return 0;
}
int main(void) {
    int ok=1,v;char text[16];
    for(int expected=0;expected<=100;++expected) {
        int n=snprintf(text,sizeof text,"SET:%d",expected);
        v=-7;ok &= parse(text,(size_t)n,&v)==0 && v==expected;
    }
    const char *bad[]={"BAD:50","SET:","SET:abc","SET:101","SET:-1","SET:1x","SET:99999999",":50","SET:1:2"};
    for(size_t i=0;i<sizeof bad/sizeof bad[0];++i) {
        v=-7;ok &= parse(bad[i],strlen(bad[i]),&v)==-1 && v==-7;
    }
    const char raw[]={'S','E','T',':','5','0'};
    ok &= parse(raw,sizeof raw,&v)==0 && v==50;
    const char embedded_zero[]={'S','E','T',':','5',0,'0'};
    v=-7;ok &= parse(embedded_zero,sizeof embedded_zero,&v)==-1 && v==-7;
    ok &= parse(NULL,1,&v)==-1 && parse("SET:1",5,NULL)==-1;
    puts("101 valid values; invalid prefix/range/length/bytes; non-NUL buffer checked");
    puts(ok ? "RESULT: PASS (declared corpus only)" : "RESULT: FAIL");return !ok;
}
```

输入校验/模糊测试模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_fuzz.c -o labs/host_fuzz && ./labs/host_fuzz
101 valid values; invalid prefix/range/length/bytes; non-NUL buffer checked
RESULT: PASS (declared corpus only)
```



value 0–100 接受（SET:50→50）；缺分隔/空值/非数字/越界一律返回 -1（拒绝），无越界。



表 8.2 输入向量判定



| 输入 | 判定 | 原因 |
| --- | --- | --- |
| SET:50 | 接受 | 合法 |
| SET: | 拒绝 | 空值 |
| SET:abc | 拒绝 | 非数字 |
| SET:200 | 拒绝 | 越界 |
| NODELIM | 拒绝 | 缺分隔 |



```zhizhan-anchor
m08-fuzz
```



```zhizhan-anchor
m08-fuzz-t
```



## 8.3 模糊测试与内存安全



所有外部输入按不可信处理：校验长度/范围/格式；解析失败要安全返回，不能越界或崩溃。



fuzz.c 节选C

 

```text
if (!sep) return -1;                       // 缺分隔
if (*val == 0 || !is_num(val)) return -1;  // 空/非数字
long v = parse(val);
if (v < 0 || v > 100) return -1;           // 越界拒绝
```

校验分隔/格式/范围；非法输入安全拒绝



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与成熟度对照



健壮性自检：校验长度/范围/格式、失败安全、覆盖畸形输入、有内存检查。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  输入判定统计（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="输入判定统计（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">接受</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="43" class="sv-lbl-hi">3例</text><text x="12" y="67" class="sv-lbl">拒绝</text><rect x="150" y="50" width="500" height="18" rx="4" class="sv-red-s"></rect><text x="658" y="67" class="sv-lbl-hi">5例</text></svg>
```



合法 3 例接受、非法 5 例拒绝；无越界。



表 8.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 校验 | 长度/范围/格式 | 不校验 |
| 失败 | 安全返回 | 崩溃 |
| 覆盖 | 畸形输入 | 只测正常 |
| 内存 | ASAN/静态 | 漏越界 |



```zhizhan-anchor
m08-quick
```



```zhizhan-anchor
m08-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



fuzz.c 节选C

 

```text
if (!sep || !is_num(val)) return -1;      // 格式校验
if (v < 0 || v > 100) return -1;           // 范围校验
/* 失败安全返回，不越界/不崩溃 */
```

格式\+范围校验，失败安全返回



表 8.4 接口风险与对策



| 要点 | 正确做法 |
| --- | --- |
| 越界输入 | 边界校验 |
| 解析崩溃 | 安全返回 |
| DoS | 限流/超时 |
| 权限绕过 | 每接口鉴权 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **不校验输入** ：越界/注入。

- **解析失败崩溃** ：可被 DoS。

- **无限流** ：被刷死。

- **只测正常输入** ：漏洞未暴露。



◆ 自测 · Module 08（先答再看）




1. 模糊测试（fuzzing）主要发现什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用畸形/随机输入触发崩溃、越界、异常路径，暴露输入校验与内存安全问题。是接口健壮性的重要手段。"}
   ```

2. 解析失败时应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"安全返回错误（如 -1），不得越界读写或崩溃。崩溃可被利用做拒绝服务甚至任意代码执行。"}
   ```

3. 为什么“只测正常输入”不够？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"攻击者用畸形/越界/边界输入。只测正常路径无法暴露越界、解析崩溃等漏洞，必须用边界与模糊测试覆盖异常路径。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个解析接口加长度/范围/格式校验，用畸形输入做一轮模糊测试验证安全返回。



核对与延伸：[OWASP 嵌入式应用安全](https://owasp.org/www-project-embedded-application-security/)

 

动手练习



运行 ` labs/host_fuzz.c `：验证解析器验证指定前缀、长度、范围与字节边界；这不是穷尽证明。



**检查结果：** value 0–100 接受（SET:50→50）；SET:200/SET:abc/NODELIM/SET: 全部返回 -1。

 

迁移练习：把本章的“能对不可信输入做长度/范围/格式校验，使非法输入安全返回而不越界或崩溃。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m08","criterion":"value 0–100 接受（SET:50→50）；SET:200/SET:abc/NODELIM/SET: 全部返回 -1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
