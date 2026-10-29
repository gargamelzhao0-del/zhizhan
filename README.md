# 知栈个人技术知识库

知栈 1.15.1 保存个人项目资料、开发经验和嵌入式课程，支持离线阅读、编辑、检索、笔记、复习和完整备份。Android 与 Windows 本地端独立存储。

## 当前内容（2026-10-13）

修订后的 27 册书库已写入知栈原生课程：317 个学习模块，407 个阅读章节（含路线、速查、附录），另有 27 篇导读和 3 篇全库路线、审查及项目资料。与 32 篇个人项目实录、6 篇开发经验合计 475 篇文章、226 个附件。

课程面向从零基础到独立完成嵌入式项目。首页提供项目学习路线、六项综合实践与逐册阅读取舍；各册先说明前置、交付物、延后内容和验收条件。答案与拓展按需展开，阅读进度和验收自评分开保存，自评纳入完整 ZIP 备份。

正文、618 幅图、1,366 张表（包括合并单元格）、1,702 段代码及实验资料随包离线提供。主机参考实现、SDK 工程和目标板测量有不同验证边界，不以阅读完成或模型运行代替实机验收。

1.15.1 补回了各册导言、定位说明、章节外的参考来源、B23 路线图，以及 Linux 系统实验包漏掉的 7 份设备树、启动脚本和构建配方。长代码和表格按完整高度展示；正文提供全部展开按钮，目录跳转展开所在说明，模块任务提供正文链接。表格换行与代码空行保留原义。

升级后首次启动自动安装本版课程，沿用现有内置资料更新机制保护用户编辑、笔记和学习状态。新书库使用 `course-` 标识；175 篇过时教程不再发布，原数据库对应内容进入回收站，附着记录保留。用户恢复后的旧条目不会再次自动删除。

## 打开与安装

- Android：`release/zhizhan-1.15.1-android.apk`，沿用原签名覆盖安装。
- Windows：运行 `release/zhizhan-windows/启动知栈.vbs`，固定地址 `http://127.0.0.1:8462`；继续使用原浏览器与用户配置。
- 1.15.1 已发布到现有私人更新服务，公网认证下载、大小和 SHA-256 校验通过；记录见 `docs/release-1.15.1-publication.json`。
- 使用方法见 [使用说明](docs/使用说明.md)、[更新指南](docs/更新功能与发布指南.md)。

## 内容来源与再次生成

相邻“手机端书库”是阅读发布项目，编写源由其 `sync_content.py` 指向的源库维护。不要直接修改生成的 HTML。修改源库后，运行：

```powershell
node scripts/import-textbooks.mjs <编写源库绝对路径>
node scripts/import-handbook.mjs
node scripts/audit-course-completeness.mjs <编写源库绝对路径>
node scripts/verify-textbooks.mjs
node scripts/verify-content.mjs
```

教材导入器保留源锚点与稳定文章标识，收录章节、导读、章节外参考来源和实验文件，映射跨册链接、附件、折叠答案和验收面板。独立完整性审计遍历源 HTML 的阅读区，检查文本片段、代码原文、图中文字、表格行列与实验文件字节，不以导入器自身的数量作为完整证明。源书库版本变化时，应同步更新教材目录的 `installationVersion` 与内置资料 `contentVersion`。不要复用退役教程标识。

## 开发与验证

需要 Node.js、npm；Android 构建另需 JDK 21、SDK 36、原签名及私有更新配置。

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd test
$env:ZHIZHAN_TEST_PORT='8465'
npx.cmd playwright test e2e/course-completeness.spec.ts e2e/course-repair-upgrade.spec.ts e2e/textbooks.spec.ts e2e/course-integration.spec.ts
./scripts/build-android.ps1 -Offline
node scripts/package-desktop.mjs
```

源书库与课程完整性对照见 `docs/course-completeness-report.json`，迁移结构与引用检查见 `docs/textbook-integrity-report.json`，修复记录见 `docs/course-completeness-repair.json`。检查范围含 437 篇课程文章、73,106 个文本片段及完整段落、1,366 张表、1,702 段代码、618 幅图与 706 份逐册实验文件；六项项目包的 23 份文件另行逐字节比较。SDK 与硬件执行边界以书中说明为准。Android 安装及原生文件操作仍需真机验收。历史 E2E 中部分用例依赖退役课程，不作为本版通过范围。

修改前备份在 `../书库修订备份/2026-10-13-quality/before-course-integration.zip`；前一阶段审查记录在 `docs/book-audit-2026-10-13/`。历史文档的内容数量不作为本版验收依据。

`.private/` 不进入源码包；签名与更新凭证单独备份。保留现有应用数据并覆盖更新，不用卸载来升级。定期导出完整 ZIP 并确认实际保存。
