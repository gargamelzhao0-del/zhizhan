# 查找、排序与索引

```zhizhan-anchor
m04
```



查找/排序是数据处理的基础： **有序数据用二分 O(log n)** ；排序要考虑 **稳定性与内存** ；频繁查找可建索引/哈希。

 

> 前置：理解数组与时间复杂度，会写循环比较。 · ◷ 约 44 分钟 · ◈ 主机固定点/加速对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为有序数据实现二分查找与标定表线性插值，并选择稳定/不稳定的排序。

 

本章速览




- 有序数据用二分 O(log n)；频繁查找建索引。

- 排序看稳定性与内存（归并稳定）。

- 标定表用有序表\+插值。

 

```zhizhan-anchor
m04-search
```



```zhizhan-anchor
m04-search-t
```



## 4.1 二分与标定表



有序数据用二分 O(log n)；排序要考虑稳定性与内存；频繁查找建索引/哈希。嵌入式常把标定/映射做成有序表 \+ 二分/插值，O(log n) 且可预测。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  二分查找



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="二分查找" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">取中点</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">比较</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">缩半</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">命中/未命中</text></svg>
```



取中点 → 比较 → 缩半 → 命中或区间为空。每步排除一半，O(log n)。



表 4.1 查找与排序



| 方法 | 复杂度 | 适用 |
| --- | --- | --- |
| 线性查找 | O(n) | 小规模/无序 |
| 二分查找 | O(log n) | 有序 |
| 哈希 | O(1) 平均 | 键值查找 |
| 快排 | O(n log n) | 通用/原地 |
| 归并 | O(n log n) | 稳定/外部 |



search.c 节选C

 

```text
int lo=0, hi=n-1;
while (lo <= hi) { int m=(lo+hi)/2; if (a[m]==key) return m; a[m]<key?lo=m+1:hi=m-1; }
return -1;   // 未命中
/* 插值 y=y0+(y1-y0)*(x-x0)/(x1-x0)，仅标定区间内 */
```

二分 O(log n)；插值仅区间内有效



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：二分与插值



下面这段程序验证二分查找与标定表线性插值：



host\_search.cC

 

```text
/* host_search.c —— 二分查找与标定表线性插值（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_search.c -o host_search && ./host_search
 */
#include <stdio.h>
static int bsearch_int(const int *a, int n, int key) { int lo=0, hi=n-1; while (lo<=hi){ int m=(lo+hi)/2; if(a[m]==key) return m; if(a[m]<key) lo=m+1; else hi=m-1; } return -1; }
/* 标定点 (x,y) 线性插值 */
static float interp(const float *x, const float *y, int n, float xi) {
    if (xi <= x[0]) return y[0];
    if (xi >= x[n-1]) return y[n-1];
    for (int i = 0; i < n-1; i++)
        if (xi >= x[i] && xi <= x[i+1])
            return y[i] + (y[i+1]-y[i]) * (xi-x[i]) / (x[i+1]-x[i]);
    return y[n-1];
}
int main(void) {
    int ok = 1;
    int a[] = {1,3,5,7,9,11};
    printf("查找 7 → 下标 %d（期望 3）\n", bsearch_int(a,6,7));
    if (bsearch_int(a,6,7) != 3) ok = 0;
    printf("查找 4 → %d（期望 -1）\n", bsearch_int(a,6,4));
    if (bsearch_int(a,6,4) != -1) ok = 0;
    float x[] = {0,10,20}, y[] = {0,100,300};
    float v = interp(x,y,3,15);
    printf("插值 x=15 → %.1f（期望 200.0）\n", v);
    if (v < 199.9f || v > 200.1f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

二分/插值模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_search.c -o labs/host_search && ./labs/host_search
查找 7 → 下标 3（期望 3）
查找 4 → -1（期望 -1）
插值 x=15 → 200.0（期望 200.0）
RESULT: PASS
```



有序表 {1,3,5,7,9,11}：7 命中下标 3、4 未命中 -1；插值 x=15→200.0（区间内）。



表 4.2 查找/插值结果



| 操作 | 输入 | 输出 |
| --- | --- | --- |
| 二分命中 | 7 | 下标 3 |
| 二分未命中 | 4 | -1 |
| 插值 | x=15 | 200.0 |
| 区间 | \[0,20\] | 区间内 |



```zhizhan-anchor
m04-sort
```



```zhizhan-anchor
m04-sort-t
```



## 4.3 排序稳定性与索引



相同键的相对顺序有意义时必须用稳定排序（归并）；否则快排/堆排。频繁查找可建索引/哈希。



search.c 节选C

 

```text
int lo=0, hi=n-1;
while (lo <= hi) { int m=(lo+hi)/2; if (a[m]==key) return m; a[m]<key?lo=m+1:hi=m-1; }
return -1;   // 未命中
/* 插值 y = y0 + (y1-y0)*(x-x0)/(x1-x0)，仅在标定区间内有效 */
```

二分 O(log n)；插值仅区间内有效



表 4.3 选择依据



| 需求 | 选择 | 原因 |
| --- | --- | --- |
| 稳定 | 归并排序 | 保持相对顺序 |
| 原地省内存 | 快排/堆排 | 额外空间小 |
| 频繁查找 | 哈希/索引 | O(1) 平均 |
| 标定映射 | 有序表\+插值 | 可预测 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



查找/排序自检：数据有序、区间正确、稳定性满足、外插标注。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  查找复杂度（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="查找复杂度（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">线性 n=256</text><rect x="150" y="26" width="512" height="18" rx="4" class="sv-red-s"></rect><text x="670" y="43" class="sv-lbl-hi">256比较次数</text><text x="12" y="67" class="sv-lbl">二分 n=256</text><rect x="150" y="50" width="16" height="18" rx="4" class="sv-grn-s"></rect><text x="174" y="67" class="sv-lbl-hi">8比较次数</text></svg>
```



线性 O(n) 对二分 O(log n)：n 大时差距巨大。有序数据应二分。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 有序 | 二分前提 | 对无序二分 |
| 区间 | 不越界 | 标定表越界 |
| 稳定 | 按需求 | 顺序被扰动 |
| 外插 | 标注/降级 | 盲目外插 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **对无序数据二分** ：结果错。

- **忽略排序稳定性** ：顺序有意义的数据被扰动。

- **哈希冲突处理差** ：性能退化。

- **标定表越界** ：读写越界。



◆ 自测 · Module 04（先答再看）




1. 什么时候必须用稳定排序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"当相同键的元素的相对顺序有意义时（如多级排序的第二关键字）。归并排序稳定；快排通常不稳定。"}
   ```

2. 二分查找的前提是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"数据必须是有序的。对无序数据二分会得到错误结果。"}
   ```

3. 标定表插值为什么只应在标定区间内使用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"标定关系通常只在测量区间内成立；区间外（外插）误差不可控，必须标注有效范围并在越界时降级/告警。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你一张映射/标定表改为有序 \+ 二分/插值，并标注有效区间。



核对与延伸：[MIT 算法公开课](https://ocw.mit.edu/)

 

动手练习



运行 ` labs/host_search.c `：验证二分查找与标定表线性插值。



**检查结果：** 二分 7→下标 3、4→-1；插值 x=15→200.0（|误差|\<0.1）。

 

迁移练习：把本章的“能为有序数据实现二分查找与标定表线性插值，并选择稳定/不稳定的排序。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b19-m04","criterion":"二分 7→下标 3、4→-1；插值 x=15→200.0（|误差|<0.1）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b19-guide)
