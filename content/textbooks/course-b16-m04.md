# Git 与变更管理

```zhizhan-anchor
m04
```



Git 的本质是 **内容寻址的快照链** ：blob（内容）→ tree（目录）→ commit（快照\+父）。理解这一点，分支/合并/回滚就都清晰了。

 

> 前置：用过 Git 的基本 add/commit。 · ◷ 约 44 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用内容寻址理解 blob/commit 链，做小步提交、分支合并与标签发布，实现源码与产物可追溯。

 

本章速览




- Git 是内容寻址的快照链。

- 小步提交、清晰信息、标签对应发布。

- rebase 勿改公共历史。

 

```zhizhan-anchor
m04-model
```



```zhizhan-anchor
m04-model-t
```



## 4.1 内容寻址的快照链



Git 用内容寻址：blob（内容）→ tree（目录）→ commit（快照\+父）。相同内容自动去重、任何变化产生新哈希，天然防篡改与可追溯。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  blob → tree → commit



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="blob → tree → commit" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">blob(内容)</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">tree(目录)</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">commit(快照)</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">历史链</text></svg>
```



文件内容 → blob（哈希）→ tree（目录结构）→ commit（快照 \+ 父 commit）→ 形成历史链。



表 4.1 Git 五操作



| 操作 | 作用 | 注意 |
| --- | --- | --- |
| add/commit | 暂存并记录 | 小步提交 |
| branch/merge | 并行开发与合并 | 冲突解决 |
| rebase | 整理历史 | 勿改公共历史 |
| tag | 标记发布 | 对应构建 |
| log/diff | 追溯变更 | 定位回归 |



git.sh 节选Shell

 

```text
git add -p                    # 小步暂存
git commit -m "fix uart ore clear (why: 接收假死)"
git tag -a v1.3.0 -m "release 1.3.0"
```

小步提交\+有意义信息\+标签发布



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：SHA-1 内容寻址



下面这段程序用真实 SHA-1 计算 Git blob 名，与 ` git hash-object ` 一致：



host\_git.cC

 

```text
/* host_git.c —— 内容寻址版本库：真实 Git blob 哈希（SHA-1）与提交链（主机可运行）。
 * Git 的对象名 = SHA1("<type> <len>\0" + 内容)；本程序实现 SHA-1 并据此计算 blob 名。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_git.c -o host_git && ./host_git
 */
#include <stdio.h>
#include <string.h>
#include <stdint.h>

/* ---- SHA-1（RFC 3174）---- */
typedef struct { uint32_t h[5]; uint64_t len; uint8_t buf[64]; size_t n; } sha1_t;
static uint32_t rol(uint32_t x, int n) { return (x << n) | (x >> (32 - n)); }
static void sha1_block(sha1_t *s, const uint8_t *p) {
    uint32_t w[80];
    for (int i = 0; i < 16; i++) w[i] = (uint32_t)p[i*4]<<24 | p[i*4+1]<<16 | p[i*4+2]<<8 | p[i*4+3];
    for (int i = 16; i < 80; i++) w[i] = rol(w[i-3]^w[i-8]^w[i-14]^w[i-16], 1);
    uint32_t a=s->h[0], b=s->h[1], c=s->h[2], d=s->h[3], e=s->h[4];
    for (int i = 0; i < 80; i++) {
        uint32_t f, k;
        if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        uint32_t t = rol(a,5) + f + e + k + w[i];
        e = d; d = c; c = rol(b,30); b = a; a = t;
    }
    s->h[0]+=a; s->h[1]+=b; s->h[2]+=c; s->h[3]+=d; s->h[4]+=e;
}
static void sha1_init(sha1_t *s) {
    s->h[0]=0x67452301; s->h[1]=0xEFCDAB89; s->h[2]=0x98BADCFE; s->h[3]=0x10325476; s->h[4]=0xC3D2E1F0;
    s->len=0; s->n=0;
}
static void sha1_update(sha1_t *s, const uint8_t *p, size_t n) {
    s->len += (uint64_t)n * 8;
    while (n) {
        size_t take = 64 - s->n; if (take > n) take = n;
        memcpy(s->buf + s->n, p, take); s->n += take; p += take; n -= take;
        if (s->n == 64) { sha1_block(s, s->buf); s->n = 0; }
    }
}
static void sha1_final(sha1_t *s, uint8_t out[20]) {
    uint64_t bits = s->len; uint8_t pad = 0x80;
    sha1_update(s, &pad, 1);
    uint8_t zero = 0; while (s->n != 56) sha1_update(s, &zero, 1);
    uint8_t lb[8];
    for (int i = 0; i < 8; i++) lb[i] = (uint8_t)(bits >> (56 - 8*i));
    sha1_update(s, lb, 8);
    for (int i = 0; i < 5; i++) { out[i*4]=s->h[i]>>24; out[i*4+1]=s->h[i]>>16; out[i*4+2]=s->h[i]>>8; out[i*4+3]=s->h[i]; }
}
/* Git blob 名：SHA1("blob <len>\0" + content) */
static void git_blob(const char *content, char hex[41]) {
    char hdr[32]; int hl = snprintf(hdr, sizeof(hdr), "blob %zu", strlen(content));
    sha1_t s; sha1_init(&s);
    sha1_update(&s, (const uint8_t*)hdr, (size_t)hl + 1);   /* 含结尾的 '\0' */
    sha1_update(&s, (const uint8_t*)content, strlen(content));
    uint8_t d[20]; sha1_final(&s, d);
    static const char *hx = "0123456789abcdef";
    for (int i = 0; i < 20; i++) { hex[i*2]=hx[d[i]>>4]; hex[i*2+1]=hx[d[i]&15]; }
    hex[40] = 0;
}
int main(void) {
    int ok = 1;
    char h1[41], h2[41], h3[41];
    git_blob("hello", h1); git_blob("hello", h2); git_blob("hello!", h3);
    printf("SHA1(\"blob 5\\0hello\") = %s\n", h1);
    printf("相同内容哈希相同=%d 不同内容哈希不同=%d\n", strcmp(h1,h2)==0, strcmp(h1,h3)!=0);
    /* 已知值：git hash-object 对 "hello" 的结果 */
    if (strcmp(h1, "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0") != 0) ok = 0;
    if (!(strcmp(h1,h2)==0 && strcmp(h1,h3)!=0)) ok = 0;
    /* 提交链：提交对象记录父提交，形成可追溯历史 */
    struct { const char *id; const char *parent; } c1 = {"c1", "(root)"}, c2 = {"c2", "c1"};
    printf("提交链 %s(parent=%s) → %s(parent=%s)\n", c1.id, c1.parent, c2.id, c2.parent);
    if (strcmp(c2.parent, c1.id) != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

Git blob 内容寻址模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_git.c -o labs/host_git && ./labs/host_git
SHA1("blob 5\0hello") = b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0
相同内容哈希相同=1 不同内容哈希不同=1
提交链 c1(parent=(root)) → c2(parent=c1)
RESULT: PASS
```



blob 名 = SHA1("blob \<字节长度\>\\0" \+ 内容)；该值可由 printf hello | git hash-object --stdin 复现。



表 4.2 Git 对象模型



| 对象 | 内容 | 哈希基础 |
| --- | --- | --- |
| blob | 文件内容 | SHA1("blob len\\0"\+内容) |
| tree | 目录结构 | 子对象哈希 |
| commit | 快照\+父 | tree\+parent\+msg |
| tag | 指向 commit | 发布标记 |



```zhizhan-anchor
m04-practice
```



```zhizhan-anchor
m04-practice-t
```



## 4.3 提交、分支与发布



小步提交、提交信息说明“为什么改”；rebase 整理本地历史（勿改公共历史）；发布用标签对应构建产物，实现“源码↔固件”可追溯。



git.sh 节选Shell

 

```text
git add -p                    # 小步暂存
git commit -m "fix uart ore clear (why: 接收假死)"
git tag -a v1.3.0 -m "release 1.3.0"
git log --oneline v1.2.3..v1.3.0   # 变更清单
```

小步提交\+有意义信息\+标签发布\+变更清单



表 4.3 Git 工程实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 小步提交 | 可定位/回滚 | 大杂烩 |
| 有意义信息 | 历史可读 | “update” |
| rebase 本地 | 历史整洁 | 改公共历史 |
| 标签发布 | 源码↔产物 | 无标签 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与三平台对照



Git 自检：理解内容寻址、小步提交、分支管理、标签可追溯。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  提交粒度与可回滚性（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="提交粒度与可回滚性（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">小步提交</text><rect x="150" y="26" width="540" height="18" rx="4" class="sv-grn-s"></rect><text x="698" y="43" class="sv-lbl-hi">90(相对可定位性)</text><text x="12" y="67" class="sv-lbl">大杂烩</text><rect x="150" y="50" width="180" height="18" rx="4" class="sv-red-s"></rect><text x="338" y="67" class="sv-lbl-hi">30(相对可定位性)</text></svg>
```



小步提交让每次变更可定位、可回滚；大杂烩提交难以定位回归来源。



表 4.4 三平台 Git



| 平台 | Git 工具 | 注意 |
| --- | --- | --- |
| Windows | Git for Windows | 换行 autocrlf |
| macOS | git \+ Xcode CLT | 大小写不敏感 |
| Linux | git | 标准 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **大杂烩提交** ：无法定位与回滚。

- **rebase 公共历史** ：破坏他人仓库。

- **提交信息无意义** ：历史不可读。

- **发布无标签** ：源码与固件对不上。



◆ 自测 · Module 04（先答再看）




1. 为什么 Git 用“内容寻址”而不是给文件编号？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内容寻址让相同内容自动去重、可校验完整性，并支持高效的快照与合并；任何内容变化都会产生新哈希，天然防篡改与可追溯。"}
   ```

2. 为什么不应 rebase 已推送的公共历史？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"rebase 会重写提交哈希，破坏他人已基于旧历史的工作，造成冲突与混乱。只整理本地未推送历史。"}
   ```

3. 发布为什么必须打标签？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"标签把源码快照与构建产物绑定，实现“这块板子上是哪个固件”的精确追溯，便于回滚与审计。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目做一次小步提交 \+ 标签发布，并核对标签对应的构建产物可追溯。



核对与延伸：[Git 官方参考](https://git-scm.com/docs)

 

动手练习



运行 ` labs/host_git.c `：用真实 SHA-1 计算 Git blob 名，验证内容寻址与提交链。



**检查结果：** blob 名 = SHA1("blob \<len\>\\0"\+内容) 与 git hash-object 一致；相同内容同哈希、不同内容不同哈希；提交链 c2.parent=c1。

 

迁移练习：把本章的“能用内容寻址理解 blob/commit 链，做小步提交、分支合并与标签发布，实现源码与产物可追溯。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m04","criterion":"blob 名 = SHA1(\"blob <len>\\0\"+内容) 与 git hash-object 一致；相同内容同哈希、不同内容不同哈希；提交链 c2.parent=c1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
