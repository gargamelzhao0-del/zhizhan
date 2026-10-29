# 持久化、配置与服务恢复

```zhizhan-anchor
m09
```



配置与数据要能在掉电/损坏后恢复： **默认值 \+ 校验 \+ 原子写** 。绝不能让“写一半的配置”成为下次启动的输入。

 

> 前置：Module 01 文件 I/O 与 Module 06 服务启动。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用“临时文件→fsync→rename”原子写实现掉电不损坏、缺配置回退默认的配置持久化。



```zhizhan-anchor
m09-knowledge-boundary
```



### 事务结束和连接关闭是两件事



sqlite3.Connection 的上下文管理提交或回滚[事务](term:transaction)，并不关闭连接。用 contextlib.closing 管理连接生命，再在其中使用事务。服务停止前结束后台任务、提交或回滚事务并关闭连接。P04 的测试会关闭服务后重新检查数据库，并清理临时文件。



```text
with closing(sqlite3.connect(path)) as db, db:
    db.execute("INSERT INTO ...", parameters)
```

 

本章速览




- 配置：默认 \+ 校验 \+ 原子写（tmp→rename）。

- 数据与程序分离，升级不动数据。

- 结构升级要迁移并保留回退。

 

```zhizhan-anchor
m09-model
```



```zhizhan-anchor
m09-model-t
```



## 9.1 默认值 \+ 校验 \+ 原子写



三条纪律： **默认值** （缺配置也能启动）、 **校验** （识别损坏）、 **原子写** （写临时文件再 rename，不掉电半写）。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  原子写配置的顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="原子写配置的顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写 tmp</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">fsync</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">rename</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">生效</text></svg>
```



写临时文件 → fsync 落盘 → rename 覆盖 → 生效。rename 提供名称替换的原子性；掉电持久性还需同步父目录并依赖文件系统与存储设备的保证。



表 9.1 持久化的五个机制



| 机制 | 作用 | 实现 |
| --- | --- | --- |
| 默认值 | 缺失也能启动 | 编译期默认 |
| 校验 | 识别损坏 | CRC/JSON 解析校验 |
| 原子写 | 不掉电半写 | 写临时文件再 rename |
| 版本迁移 | 结构升级 | 迁移函数补默认 |
| 自检 | 启动可用 | 关键状态检查 |



cfg\_load.c 节选C

 

```text
if (load_cfg(path, &cfg) != OK) {
    cfg = default_cfg();      // 缺失/损坏 → 回退默认
    log_warn("use default cfg");
}
migrate_cfg(&cfg);            // 旧版本 → 补默认字段
```

缺失/损坏回退默认；旧版本走迁移函数



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：默认回退与掉电不损坏



下面这段主机程序验证“无配置用默认、保存后加载、掉电保存不损坏”：



host\_cfg.cC

 

```text
/* host_cfg.c —— 配置持久化：默认值 + 原子写（tmp→rename）模型（主机可运行）。
 * 直接覆写配置文件在掉电时会损坏；正确做法是写临时文件再 rename（原子替换），失败留旧配置。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cfg.c -o host_cfg && ./host_cfg
 */
#include <stdio.h>
#include <string.h>
typedef struct { int port; int interval_ms; int valid; } cfg_t;
static const cfg_t DEFAULTS = { 1883, 1000, 1 };
static int load_cfg(const cfg_t *stored, cfg_t *out) {
    if (stored && stored->valid) { *out = *stored; return 0; }   /* 有有效配置 */
    *out = DEFAULTS; return 1;                                  /* 否则默认 */
}
static int atomic_save(cfg_t *slot, const cfg_t *v, int crash) {
    cfg_t tmp = *v; tmp.valid = 1;
    if (crash) return -1;                 /* 掉电：临时文件未提交 */
    *slot = tmp; return 0;
}
int main(void) {
    int ok = 1; cfg_t cur = {0}, out;
    int r = load_cfg(0, &out);
    printf("无配置 → 默认 port=%d interval=%d（r=%d）\n", out.port, out.interval_ms, r);
    if (!(r == 1 && out.port == DEFAULTS.port)) ok = 0;
    cfg_t want = { 8883, 500, 1 };
    if (atomic_save(&cur, &want, 0) != 0) ok = 0;
    load_cfg(&cur, &out);
    printf("保存后加载 port=%d interval=%d\n", out.port, out.interval_ms);
    if (!(out.port == 8883 && out.interval_ms == 500)) ok = 0;
    cfg_t keep = cur;
    atomic_save(&cur, &want, 1);         /* 掉电 */
    printf("掉电保存后配置未损坏: %d\n", cur.port == keep.port);
    if (cur.port != keep.port) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

配置持久化模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_cfg.c -o labs/host_cfg && ./labs/host_cfg
无配置 → 默认 port=1883 interval=1000（r=1）
保存后加载 port=8883 interval=500
掉电保存后配置未损坏: 1
RESULT: PASS
```



缺配置回退默认；正常保存后能加载；掉电（未提交）时旧配置不变（未损坏=1）。



表 9.2 配置读取的四种情形



| 情形 | 结果 | 原因 |
| --- | --- | --- |
| 无配置 | 用默认 | 默认值兜底 |
| 正常保存 | 读到新值 | rename 原子 |
| 掉电半写 | 旧配置完好 | 临时文件隔离 |
| 损坏文件 | 回退默认 | 校验失败 |



```zhizhan-anchor
m09-atomic
```



```zhizhan-anchor
m09-atomic-t
```



## 9.3 原子写与数据分离



配置写“临时文件 → fsync → rename”，同目录替换后 fsync 父目录，并检查每一步返回值；只测模型不证明掉电一致性。数据目录与程序分离，升级程序不动数据；启动时做一次自检，失败回退默认或进入维护模式。



cfg\_save.c 节选C

 

```text
int fd = open("/etc/app.conf.tmp", O_WRONLY | O_CREAT | O_TRUNC, 0644);
write(fd, buf, len);
fsync(fd); close(fd);
rename("/etc/app.conf.tmp", "/etc/app.conf");  // 原子替换
int dfd = open("/etc", O_RDONLY | O_DIRECTORY); // Linux
fsync(dfd); close(dfd); // 生产实现必须检查所有返回值、处理短写，并串行化写入者
/* 数据目录 /var/lib/app 与程序 /opt/app 分离，升级不动数据 */
```

示意顺序，不是完整生产函数：同目录临时文件→完整写入→fsync 文件→rename→fsync 父目录；文件系统和设备仍有适用边界



表 9.3 持久化做法对错



| 做法 | 好/坏 | 原因 |
| --- | --- | --- |
| tmp→rename | 好 | 原子、不掉电半写 |
| 直接覆写 | 坏 | 掉电半写损坏 |
| 数据放程序目录 | 坏 | 升级覆盖数据 |
| 无版本迁移 | 坏 | 新程序读旧配置出错 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与三路线对照



配置自检：缺配置可用、损坏可恢复、升级不丢数据。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  配置状态与恢复动作



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="配置状态与恢复动作" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">状态</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">动作</text><text x="12" y="50" class="sv-lbl">正常</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">加载</text><text x="12" y="78" class="sv-lbl">缺失</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">默认</text><text x="12" y="106" class="sv-lbl">损坏</text><rect x="158" y="94" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="109" text-anchor="middle" class="sv-lbl-hi">回退默认</text><text x="12" y="134" class="sv-lbl">旧版本</text><rect x="158" y="122" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="137" text-anchor="middle" class="sv-lbl-hi">迁移</text></svg>
```



正常→加载；缺失→默认；损坏→校验失败回退默认；版本旧→迁移补默认。



表 9.4 三路线持久化



| 路线 | 文件系统 | 说明 |
| --- | --- | --- |
| Buildroot | ext4/ubifs \+ 只读根 | 可写层持久化 |
| Yocto | ext4 \+ overlay | 只读根 \+ 卷 |
| Debian | ext4 \+ overlay | apt 管理 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **直接覆写配置** ：掉电得到半写文件。

- **无默认值** ：缺配置无法启动。

- **数据与程序混放** ：升级覆盖数据。

- **无版本迁移** ：新程序读旧配置出错。



◆ 自测 · Module 09（先答再看）




1. 为什么“写临时文件再 rename”能保证配置不损坏？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"rename 在同一文件系统内是原子操作：要么指向旧文件，要么指向新文件，不会出现“写了一半”的中间态。"}
   ```

2. 配置缺省时程序应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用编译期默认值启动（并可选写出默认配置），不能因为缺配置就崩溃。"}
   ```

3. 为什么数据目录要和程序目录分开？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"升级程序（换镜像/可执行文件）时不希望动到用户数据；数据放独立可写目录/卷，升级只换程序。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你服务的配置写入改为 tmp→fsync→rename 原子写，并加默认值回退与损坏检测。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/)

 

动手练习



运行 ` labs/host_cfg.c `：验证无配置用默认、保存后加载、掉电保存不损坏旧配置。



**检查结果：** 无配置回退默认 port=1883/interval=1000（r=1）；保存后 port=8883/interval=500；掉电保存未损坏=1。

 

迁移练习：把本章的“能用“临时文件→fsync→rename”原子写实现掉电不损坏、缺配置回退默认的配置持久化。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m09","criterion":"无配置回退默认 port=1883/interval=1000（r=1）；保存后 port=8883/interval=500；掉电保存未损坏=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
