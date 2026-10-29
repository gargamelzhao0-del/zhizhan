# 时序数据存储

```zhizhan-anchor
m03
```



时序数据的特点是“ **写多读少、按时间排列、需要降采样** ”。存储要支持标签、区间查询与保留策略。

 

> 前置：完成 M02（边缘汇聚与缓存）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：实现时序区间查询与降采样聚合，使 \[200,500\] 命中 4 点、\[0,1000) 均值=4.50。

 

本章速览




- 时序数据写多读少，需要标签、区间查询与保留策略。

- 降采样省空间又保留趋势。

- 高基数字段别当标签。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 度量、标签、降采样、保留



时序库用“度量 \+ 标签”组织数据；写入高吞吐要批量/缓冲；压缩靠时间戳差值；降采样把高频数据聚合成低频历史；保留策略自动清理过期数据。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  时序数据的写入与降采样



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="时序数据的写入与降采样" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写入</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">索引存储</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">降采样</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">保留/查询</text></svg>
```



高频写入 → 按时间索引存储 → 定期降采样（均值/最大/最小）→ 保留策略清理 → 区间查询/聚合。



表 3.1 时序存储五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 度量/标签 | 分类与索引 | 标签基数 |
| 写入 | 高吞吐 | 批量/缓冲 |
| 压缩 | 省空间 | 按时间戳差值 |
| 降采样 | 聚合历史 | 精度/空间权衡 |
| 保留 | 自动清理 | 按时间/体积 |



schema.txt 节选Text

 

```text
measurement: sensor_data
  tags:   device_type, region    # 低基数做标签
  fields: value, quality          # 高基数做字段
  retention: raw 30d, downsample 1y
```

低基数做标签、高基数做字段；降采样\+保留策略



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：区间查询与降采样



下面这段程序验证按时间区间查询与降采样均值：



host\_tsdb.cC

 

```text
/* host_tsdb.c —— 时序存储：追加、区间查询、降采样（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tsdb.c -o host_tsdb && ./host_tsdb
 */
#include <stdio.h>
typedef struct { long t; float v; } pt_t;
static pt_t S[16]; static int n = 0;
static void put(long t, float v) { if (n < 16) { S[n].t = t; S[n].v = v; n++; } }
static int range(long a, long b, float *out) { int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= a && S[i].t <= b) out[c++] = S[i].v; return c; }
static float avg_downsample(long bucket, long t0, long t1) { (void)bucket; float s = 0; int c = 0; for (int i = 0; i < n; i++) if (S[i].t >= t0 && S[i].t < t1) { s += S[i].v; c++; } return c ? s/c : 0; }
int main(void) {
    int ok = 1;
    for (int i = 0; i < 10; i++) put(i * 100, (float)i);
    float out[16]; int c = range(200, 500, out);
    printf("区间 [200,500] 点数=%d（期望 4：2,3,4,5）\n", c);
    if (c != 4) ok = 0;
    float m = avg_downsample(1000, 0, 1000);
    printf("降采样 [0,1000) 均值=%.2f（期望 4.50）\n", m);
    if (m < 4.49f || m > 4.51f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

时序查询/降采样模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_tsdb.c -o labs/host_tsdb && ./labs/host_tsdb
区间 [200,500] 点数=4（期望 4：2,3,4,5）
降采样 [0,1000) 均值=4.50（期望 4.50）
RESULT: PASS
```



闭区间 \[200,500\] 命中 4 点；降采样桶 \[0,1000)（左闭右开）均值为 4.50。



表 3.2 查询与降采样口径



| 操作 | 口径 | 结果 |
| --- | --- | --- |
| 区间查询 | \[200,500\] 闭区间 | 4 点 |
| 降采样 | \[0,1000) 左闭右开 | 均值 4.50 |
| 聚合 | 桶内均值 | 保留趋势 |
| 保留 | 原始 30d \+ 降采样 1y | 自动清理 |



```zhizhan-anchor
m03-index
```



```zhizhan-anchor
m03-index-t
```



## 3.3 标签基数与查询效率



把高基数字段（设备唯一 ID、时间戳）当标签会产生海量索引项（基数爆炸），内存与查询开销剧增。高基数字段应作为字段而非标签；查询要按时间索引，避免全表扫描。



schema.txt 节选Text

 

```text
measurement: sensor_data
  tags:   device_type, region        # 低基数，做索引
  fields: value, quality             # 高基数/数值，不做标签
  time:   ts (ms)                    # 时间索引
retention: raw 30d, downsample 1y
```

低基数字段做标签，高基数字段做字段



表 3.3 时序存储问题与对策



| 问题 | 原因 | 对策 |
| --- | --- | --- |
| 标签基数爆炸 | 高基数当标签 | 改字段 |
| 查询慢 | 全表扫描 | 时间索引/降采样 |
| 存储爆 | 不做降采样 | 聚合历史 |
| 磁盘写满 | 无保留策略 | 按时间清理 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与三级对照



存储自检：标签合理、有降采样、有保留、查询走索引。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  原始 vs 降采样（空间示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="原始 vs 降采样（空间示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">原始 30 天</text><rect x="150" y="26" width="545" height="18" rx="4" class="sv-amb-s"></rect><text x="703" y="43" class="sv-lbl-hi">100(相对空间)</text><text x="12" y="67" class="sv-lbl">降采样 1 年</text><rect x="150" y="50" width="109" height="18" rx="4" class="sv-grn-s"></rect><text x="267" y="67" class="sv-lbl-hi">20(相对空间)</text></svg>
```



降采样把高频原始数据压缩为低频历史，明显省空间且保留趋势。



表 3.4 三级存储



| 层级 | 存储角色 | 注意 |
| --- | --- | --- |
| 设备端 | 本地环形缓冲 | 容量小 |
| 边缘网关 | 短时缓存/降采样 | 续传 |
| 云平台 | 时序库长存 | 保留/查询 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **标签基数爆炸** ：索引膨胀，查询慢。

- **不做降采样** ：存储爆、查询慢。

- **无保留策略** ：磁盘写满。

- **全表扫描** ：查询拖垮库。



◆ 自测 · Module 03（先答再看）




1. 什么是“标签基数爆炸”，为什么危险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把高基数字段（如每设备唯一 ID、时间戳）当标签，会产生海量索引项，内存与查询开销剧增。高基数字段应作为字段而非标签。"}
   ```

2. 降采样解决什么问题、代价是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把高频原始数据聚合成低频历史，省空间且保留趋势；代价是损失细粒度细节（精度）。"}
   ```

3. 为什么区间查询要按时间索引？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"时序数据按时间排列；用时间索引能快速定位区间，避免全表扫描拖垮数据库。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的时序数据设计“标签/字段/降采样/保留”策略，并验证区间查询与降采样口径。



核对与延伸：[InfluxDB 文档](https://docs.influxdata.com/) · [TimescaleDB 文档](https://docs.timescale.com/)

 

动手练习



运行 ` labs/host_tsdb.c `：验证按时间区间查询与降采样均值。



**检查结果：** 区间 \[200,500\] 点数=4；降采样 \[0,1000) 均值 4.50；聚合口径与定义一致。

 

迁移练习：把本章的“实现时序区间查询与降采样聚合，使 \[200,500\] 命中 4 点、\[0,1000) 均值=4.50。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m03","criterion":"区间 [200,500] 点数=4；降采样 [0,1000) 均值 4.50；聚合口径与定义一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
