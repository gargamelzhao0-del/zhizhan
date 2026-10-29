# 从代码到量产的工程闭环

```zhizhan-anchor
capstone
```



把 12 章串成一条路径：规范与门禁 → 单测/HIL → 版本与固件管理 → 产测标定 → 合规可追溯 → 现场定位 → 故障注入回归 → 发布与现场闭环。



> ◈ 10 步构建路径 · ⚑ 每步可验收

 

把 12 章串成一条路径： **规范与门禁 → 单测/HIL → 版本与固件管理 → 产测标定 → 合规可追溯 → 现场定位 → 故障注入回归 → 发布与现场闭环。**

 

 
1. **① 规范** （M01）——自动检查；验收：门禁可执行。
 
2. **② 门禁** （M02）——零警告 \+ 静态分析 \+ 测试；验收：硬性失败阻塞。
 
3. **③ 单测** （M03）——主机仿真 \+ 错误路径；验收：关键分支覆盖。
 
4. **④ HIL** （M04/M06）——硬件相关测试与产测；验收：激励/观测/超时齐全。
 
5. **⑤ 版本** （M05）——semver \+ 构建号；验收：升级准入正确。
 
6. **⑥ 追溯** （M07/M10）——需求↔测试矩阵；验收：未覆盖项显式列出。
 
7. **⑦ 诊断** （M08）——保留现场 \+ 二分；验收：可定位到版本/参数。
 
8. **⑧ 选型** （M09）——总成本 \+ 替代料；验收：BOM 可算、有备选。
 
9. **⑨ 回归** （M11）——故障注入 \+ 长跑 \+ 基线；验收：恢复率与阈值可测。
 
10. **⑩ 发布** （M12）——清单 \+ 灰度 \+ 回滚；验收：批次可追溯、反馈闭环。
 

 

本册所有板上/产线项（真实 HIL、产测良率、长跑、发布）均标注为“需实测”；单测框架、门禁聚合、HIL 序列、版本准入、故障注入统计、需求覆盖、BOM 成本等主机可验证部分已给出真实运行结果。



ci pipelineYAML

 

```text
stages: [build, analyze, test, package]

build:
  stage: build
  script: [ "make all" ]

analyze:
  stage: analyze
  script: [ "make tidy", "cppcheck --error-exitcode=1 src" ]

test:
  stage: test
  script: [ "make unittest", "make coverage" ]

package:
  stage: package
  script: [ "make image", "sha256sum image.bin" ]
  rules:
    - if: $CI_COMMIT_TAG
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
