# 数组与字符串

```zhizhan-anchor
m05
```



存一列数据用 **数组** ，处理文字用 **字符串** 。这一节讲清"下标从 0 开始""越界是灾难"， 以及 C 字符串为什么是"以 ` \0 ` 结尾的字符数组"。

 

> ◷ 约 55 分钟 · ◈ 数组 · C 字符串 · 越界 · ⚑ 小心越界

 

```zhizhan-anchor
m05-1
```



## 5.1 数组：一排同类型元素

 

array\_string.c — 数组与字符串（可运行） C

 

```text
#include <stdio.h>
#include <string.h>

int main(void)
{
    int a[5] = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int i = 0; i < 5; i++) sum += a[i];       /* 合法下标：0..4 */
    printf("sum = %d, average = %.1f\n", sum, sum / 5.0);

    char name[16] = "embedded";                     /* 实际占 9 字节（含 '\0'） */
    printf("strlen = %zu, name = %s\n", strlen(name), name);

    char other[16];
    strcpy(other, name);                            /* 复制（目标必须够大） */
    printf("compare = %d\n", strcmp(name, other));  /* 相等返回 0 */
    return 0;
}
```

 

**bash**  — 复跑：` bash tools/probes/m05.sh `

 

```text
$ gcc -std=c11 -Wall -Wextra array_string.c -o array_string && ./array_string
sum = 150, average = 30.0
strlen = 8, name = embedded
compare = 0
```

 

```zhizhan-anchor
m05-2
```



## 5.2 字符串的真相：以 ` \0 ` 结尾

 

**FIG 5.1**  ` "embedded" ` 在内存里其实是 9 个字节

 

```zhizhan-figure
<svg viewBox="0 0 660 120" role="img" aria-label="C 字符串以 0 结尾">
          <g>
            <rect x="30" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="60" y="62" class="sv-lbl-hi" text-anchor="middle">e</text><text x="60" y="86" class="sv-lbl-dim" text-anchor="middle">0</text>
            <rect x="95" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="125" y="62" class="sv-lbl-hi" text-anchor="middle">m</text><text x="125" y="86" class="sv-lbl-dim" text-anchor="middle">1</text>
            <rect x="160" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="190" y="62" class="sv-lbl-hi" text-anchor="middle">b</text><text x="190" y="86" class="sv-lbl-dim" text-anchor="middle">2</text>
            <rect x="225" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="255" y="62" class="sv-lbl-hi" text-anchor="middle">e</text><text x="255" y="86" class="sv-lbl-dim" text-anchor="middle">3</text>
            <rect x="290" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="320" y="62" class="sv-lbl-hi" text-anchor="middle">d</text><text x="320" y="86" class="sv-lbl-dim" text-anchor="middle">4</text>
            <rect x="355" y="40" width="60" height="34" rx="4" class="sv-box"></rect><text x="385" y="62" class="sv-lbl-hi" text-anchor="middle">…</text><text x="385" y="86" class="sv-lbl-dim" text-anchor="middle">…</text>
            <rect x="420" y="40" width="60" height="34" rx="4" class="sv-grn-s"></rect><text x="450" y="62" class="sv-lbl-hi" text-anchor="middle">\0</text><text x="450" y="86" class="sv-lbl-dim" text-anchor="middle">8</text>
            <text x="500" y="62" class="sv-lbl-dim" style="fill:var(--grn)">← 结束标记</text>
          </g>
          <text x="30" y="26" class="sv-lbl-dim">下标：0 1 2 3 4 5 6 7 8（共 9 字节；<tspan style="fill:var(--grn)">strlen</tspan>=8，不含结束符）</text>
        </svg>
```

 

` strlen ` 数到 ` \0 ` 之前为止（=8）；` sizeof(name) ` 是数组总容量（=16）。 **忘了 ` \0 `，字符串函数就会一直往下读，直到越界。**

 

```zhizhan-anchor
m05-3
```



## 5.3 数组最危险的错误：越界

 

⚠ 下标越界 = 未定义行为

 

 
- ` int a[5] ` 的合法下标是 ` 0..4 `；` a[5] ` 已经在数组外。
 
- C  **不会** 检查越界，可能读到垃圾、也可能悄悄改坏别的变量——在嵌入式里甚至会踩到外设寄存器。
 
- 写循环时牢记：` i < 5 ` 而不是 ` i <= 5 `。

 

```zhizhan-anchor
m05-4
```



## 5.4 数组在内存里是连续的

 

**FIG 5.2**  ` int a[4] ` 的四个元素紧挨着放

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="a[0]..a[3] 在内存中连续排列，a[i] 的地址是 基址 + i×4">
          <rect x="40" y="46" width="120" height="44" rx="4" class="sv-grn-s"></rect>
          <text x="100" y="65" class="sv-lbl-hi" text-anchor="middle">a[0]</text>
          <text x="100" y="81" class="sv-lbl-dim" text-anchor="middle">1000</text>
          <rect x="160" y="46" width="120" height="44" rx="4" class="sv-cyn-s"></rect>
          <text x="220" y="65" class="sv-lbl-hi" text-anchor="middle">a[1]</text>
          <text x="220" y="81" class="sv-lbl-dim" text-anchor="middle">1004</text>
          <rect x="280" y="46" width="120" height="44" rx="4" class="sv-amb-s"></rect>
          <text x="340" y="65" class="sv-lbl-hi" text-anchor="middle">a[2]</text>
          <text x="340" y="81" class="sv-lbl-dim" text-anchor="middle">1008</text>
          <rect x="400" y="46" width="120" height="44" rx="4" class="sv-red-s"></rect>
          <text x="460" y="65" class="sv-lbl-hi" text-anchor="middle">a[3]</text>
          <text x="460" y="81" class="sv-lbl-dim" text-anchor="middle">1012</text>
        </svg>
```

 

连续排列是"下标能算地址"的前提，也是"越界没报错却读到别人数据"的原因。

 

array\_iter.c — 用循环遍历数组 C

 

```text
#include <stdio.h>

int main(void) {
    int a[5] = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int i = 0; i < 5; i++) sum += a[i];
    printf("sum = %d, avg = %.1f\n", sum, sum / 5.0);
    return 0;
}
```

 

| 要点 | 正确做法 | 错误做法 |
| --- | --- | --- |
| 下标范围 | ` 0 .. n-1 ` | 用到 ` a[n] ` |
| 数组长度 | ` sizeof(a)/sizeof(a[0]) ` | 硬编码、数错 |
| 初始化 | ` int a[5] = {0}; ` | 只初始化一部分 |
| 求平均 | ` sum / 5.0 ` | ` sum / 5 `（整数） |

 

```zhizhan-anchor
m05-5
```



## 5.5 字符串与缓冲区安全

 

| 函数 | 作用 | 要小心的点 |
| --- | --- | --- |
| ` strlen(s) ` | 长度（不含 ` \0 `） | 必须已以 ` \0 ` 结尾 |
| ` strcpy(d,s) ` | 复制 | 不检查目标大小→溢出 |
| ` strncpy(d,s,n) ` | 最多复制 n 字节 | 可能不加 ` \0 ` |
| ` strcmp(a,b) ` | 比较 | 返回 0 才表示相等 |

 

safe\_copy.c — 给字符串留够空间 C

 

```text
#include <stdio.h>
#include <string.h>

int main(void) {
    char src[] = "embedded";
    char dst[16];                 /* 够大：至少 strlen(src)+1 */
    strncpy(dst, src, sizeof(dst) - 1);
    dst[sizeof(dst) - 1] = '\0';   /* 收尾，防止无终止符 */
    printf("%s (%zu)\n", dst, strlen(dst));
    return 0;
}
```

 

| 场景 | 危险写法 | 更安全 |
| --- | --- | --- |
| 读字符串 | ` gets(buf) ` | ` fgets(buf,n,stdin) ` |
| 读整数 | ` scanf("%d",&x) ` 不检查 | 检查返回值 |
| 拼字符串 | ` strcat ` 不管大小 | 先算长度再决定 |
| 定长缓冲 | 不预留 ` \0 ` | 长度 = 字符数 \+ 1 |

 

◆ 迁移练习

 

写一个程序：把一个长字符串安全地拷进 8 字节的缓冲，打印复制后的长度；若源串太长，说明你如何"截断而不溢出"。

 

| 常见量 | 值 | 备注 |
| --- | --- | --- |
| ` "abc" ` 的字符数 | 3 | 不含 ` \0 ` |
| ` "abc" ` 占的字节 | 4 | 含结尾 ` \0 ` |
| ` char buf[8] ` 可存字符 | 7 | 留 1 字节给 ` \0 ` |
| ` sizeof(buf) ` | 8 | 整个缓冲大小 |

 

◆ 本章要点

 

 
- 数组是一排同类型元素；下标从 ` 0 ` 到 ` 长度-1 `。
 
- C 字符串是"以 ` \0 ` 结尾的字符数组"；` strlen ` 不算结束符，` sizeof ` 算容量。
 
- 字符串操作靠 ` <string.h> `：` strlen `/` strcpy `/` strcmp `。
 
- 越界是未定义行为，C 不检查——自己保证下标合法。
 
- 数组名在多数场合等于"首元素地址"，这直接引出下一节的指针。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 填空：` int a[5] ` 的合法下标是 \_\_\_\_\_\_ 到 \_\_\_\_\_\_。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"**0**  到  **4** 。"}
   ```
 
2. 判断：` char s[16] = "embedded"; ` 中 ` sizeof(s) ` 等于 ` strlen(s) `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不等。` sizeof(s)=16 `（数组容量），` strlen(s)=8 `（到 ` \\0 ` 为止的字符数）。"}
   ```
 
3. 诊断：把 ` strcpy(dst, src) ` 里的 ` dst ` 开得太小，会怎样？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"缓冲区溢出——写到 ` dst ` 之外，覆盖别的数据，可能崩溃或被利用。目标数组必须容得下 ` src ` 及其 ` \\0 `。"}
   ```
 
4. 动手：把 ` array_string.c ` 的循环条件改成 ` i <= 5 ` 再编译运行，观察结果是否异常（可能不报错，这正是可怕之处）。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"多数情况仍\"看似正常\"，因为它读到了数组后面的内存——这就是未定义行为：不报错 ≠ 正确。"}
   ```
 
5. 判断：` strcmp(a,b) ` 相等时返回 1。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"错，相等返回  **0** ；返回正/负表示 a 大于/小于 b。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  写一个程序：读入一行字符串，统计其中有多少个数字字符、多少个字母。

 

```zhizhan-assessment
{"id":"course-b00-m05","criterion":"为字符串缓冲区预留终止符；空串、恰好装满和超长输入均不越界。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 委员会草案 N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
