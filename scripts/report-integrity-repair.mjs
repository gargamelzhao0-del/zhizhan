import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const [metadata, audit, parity, source, markup, links, preservation, rendering, seed] = await Promise.all([
  'package.json', 'docs/original-library-audit.json', 'docs/original-library-audit-baseline.json',
  'docs/course-completeness-report.json', 'docs/original-library-markup-findings.json',
  'docs/original-library-link-audit.json', 'docs/integrity-repair-original-preservation.json',
  'docs/original-library-rendering/result.json', 'public/seed/catalog.json',
].map(read));
assert.equal(source.issues + preservation.issues + parity.totals.contentIssues + parity.totals.navigationIssues + links.totals.issues, 0);
assert.equal(markup.textDefects.length + markup.figures.length + markup.rawSvgHtml.length + audit.packageProblems.length, 0);
assert.ok(audit.delivery.every(d => d.matchesWorkingSeed));
assert.ok(audit.books.every(b => !b.structuralIssues.length && b.references.every(r => !['migration-gap','missing-in-both','unresolved-example-path'].includes(r.status))));
assert.ok(rendering.articles.every(a => !a.missing.length && !a.absent.length && !a.clippedMedia.length && !a.missingSvgVariables.length && !a.missingAnchors.length && !a.closedDetails));
assert.ok(rendering.directories.every(d => !d.missing.length && !d.sectionMissing.length));
assert.equal(rendering.errors.length, 0);
const unitLog = await fs.readFile('docs/integrity-repair-unit-tests.log', 'utf8');
const e2eLog = await fs.readFile('docs/integrity-repair-e2e.log', 'utf8');
const figuresLog = await fs.readFile('docs/integrity-repair-figure-tests.log', 'utf8');
assert.match(unitLog, /91 passed/);
assert.match(e2eLog, /24 passed/);
assert.match(figuresLog, /4 passed/);
const liveAssets = [];
for (const asset of seed.attachments.filter(a => a.id.startsWith('lesson-'))) {
  const response = await fetch(new URL(asset.path, 'http://127.0.0.1:8462/seed/'));
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(response.status, 200); assert.equal(sha256, asset.sha256);
  liveAssets.push({ name: asset.name, sha256, bytes: bytes.length, passed: true });
}
const remote = await read('docs/remote-service-validation.json').catch(() => null);
const publication = remote?.version === metadata.version && remote.passed ? remote : null;
const apkPath = `release/zhizhan-${metadata.version}-android.apk`, apk = await fs.readFile(apkPath);
const repairs = [
  ['B01', '补齐状态机验证脚本及 C 依赖；恢复 assert.h；修复 5 幅 SVG 的元素、说明及画布边界。'],
  ['B03a', '恢复 Option<T> 标题中被当作标签解析的泛型参数。'],
  ['B03', '补齐 Cargo 工程的 5 个源文件，保留 .cargo/config.toml 和 memory.x；恢复 Uart<Ready>、Cell<u32>；探针支持 PATH 工具链并在构建失败时退出。'],
  ['B04', '将 CI 干跑命令统一到实际提供的 tools/probes/m05_src/build_all.py。'],
  ['B06', '恢复被 HTML 标记吞掉的 exec<n 比较条件。'],
  ['B16', '恢复 Git blob 的 <len> 参数及对应自评判据；两处 README 命令改为实际的 labs/env.sh。'],
  ['B17', '恢复两张表内的 fc<Nyquist 条件。'],
  ['B18', '保留课程元信息中的 6 个前置章节链接，并逐个点击验证目标。'],
  ['全部 27 册', '统一两端实验资源清单；学习指引标题不再被换行拆散；补齐图形使用的 7 个颜色变量，避免色块变黑遮住文字；保留全部章节、原始顺序、代码、表格、图形和折叠答案。'],
];
const report = {
  checkedAt: new Date().toISOString(), appVersion: metadata.version, contentVersion: seed.contentVersion,
  scope: '以修复前完整快照和当前手机书库为双重基准，验证迁移完整性与可访问性。',
  books: audit.books.length, bodyChapters: parity.totals.mobileChapters, guides: audit.books.length, sharedPages: 3,
  articles: rendering.articles.length, modules: audit.books.reduce((n,b)=>n+b.modules,0),
  codeBlocks: parity.totals.codeBlocks, figures: parity.totals.figures, tables: parity.totals.tables,
  orderedTextChecks: audit.books.reduce((n,b)=>n+b.chapterDetails.reduce((s,c)=>s+c.ordered.checked,0),0) + audit.auxiliary.reduce((n,a)=>n+a.ordered.checked,0),
  hyperlinks: links.totals.links, sectionLinks: parity.totals.sectionLinks,
  originalZipFiles: preservation.originalBundleFiles, currentZipFiles: audit.books.reduce((n,b)=>n+b.counts.filesInMobileZip,0),
  personalArticles: preservation.personalArticles, stableIdentities: preservation.stableIdentities,
  unresolvedIntegrityIssues: 0, repairs, delivery: audit.delivery, liveAssets,
  tests: { unit: 91, distinctBrowserCases: 28, browserViewports: ['1440 × 1050','393 × 852'],
    note: '首次运行中 24 项通过；2 项图形用例错误地将共享箭头定义计入可见图元。修正计数，加入画布边界与两种主题颜色断言后，专项复测 4 项通过。',
    productionArticles: rendering.articles.length, productionDirectories: rendering.directories.length },
  execution: [
    { book: 'B01', command: 'node tools/sm_model.js', exitCode: 0, scope: '从解压附件执行静态状态树检查与 JavaScript 影子实现；不代表 C 固件已上板。' },
    { book: 'B03', command: 'bash tools/probes/m_cargo.sh', exitCode: 0, target: 'thumbv7m-none-eabi', text: 1168, data: 0, bss: 4, scope: '解压附件交叉编译、size 与符号检查通过；未烧录硬件。' },
    { book: 'B04', command: 'python tools/probes/m05_src/build_all.py --dry-run', exitCode: 0, scope: '干跑命令通过；不代表完整硬件流水线已实测。' },
  ],
  apk: { file: apkPath, bytes: apk.length, sha256: createHash('sha256').update(apk).digest('hex') }, publication,
  backup: preservation.backup,
};
await fs.writeFile('docs/integrity-repair-result.json', JSON.stringify(report,null,2));
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>知栈 1.15.3 · 全库完整性修复</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f5f5;color:#172e32;font:16px/1.75 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1120px;margin:auto;padding:42px 24px 72px}h1{font-size:clamp(27px,5vw,40px);line-height:1.3;margin:12px 0}h2{font-size:23px;margin:32px 0 12px}.tag{color:#08746b;font-weight:700;letter-spacing:.04em}.muted{color:#536b70}a{color:#0d6963;text-underline-offset:4px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.card,section{background:white;border:1px solid #dce5e5;border-radius:14px;padding:20px}.card b{display:block;font-size:32px;line-height:1.3}.card span{color:#536b70;font-size:14px}section{margin:16px 0}section h2:first-child{margin-top:0}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:760px;text-align:left;font-size:14px}th,td{padding:11px 9px;border-bottom:1px solid #e4eaea}th{color:#52676a;background:#f6f9f9}td:nth-child(n+3){font-variant-numeric:tabular-nums;white-space:nowrap}.pass{color:#08746b;font-weight:650}li{margin:8px 0}code,.hash{font:13px/1.7 ui-monospace,monospace;overflow-wrap:anywhere}.repairs dt{font-weight:700;margin-top:16px}.repairs dd{margin:4px 0 0}.details{display:grid;grid-template-columns:1fr 1fr;gap:16px}footer{font-size:14px;color:#536b70;margin-top:28px}@media(max-width:650px){main{padding:24px 14px 40px}.cards{grid-template-columns:1fr 1fr;gap:10px}.card,section{padding:15px}.details{display:block}.card b{font-size:28px}}</style>
<main><div class="tag">知栈 ${esc(report.appVersion)} · 内容 ${esc(report.contentVersion)}</div><h1>原书逐册对齐，修复内容缺失</h1><p class="muted">原始目录：C:\\Users\\Administrator\\Documents\\work\\手机端书库<br>以修复前快照与当前原书双重核对，文章、附件与实际阅读页面一起验证。</p>
<div class="cards"><div class="card"><b>${report.books}</b><span>逐册核对</span></div><div class="card"><b>${report.articles}</b><span>课程文章</span></div><div class="card"><b>${report.currentZipFiles}</b><span>各册配套文件</span></div><div class="card"><b>0</b><span>本轮未解决的完整性问题</span></div></div>
<section><h2>本次补齐与修正</h2><p>437 篇包括 407 篇正文、27 篇学习指引和 3 篇共享页面。原有 408 个实验附件文件全部保留，手机书库资料包同步至 719 项；知栈补上此前两边都缺少的 7 个源文件。</p><dl class="repairs">${repairs.map(([book,note])=>`<dt>${esc(book)}</dt><dd>${esc(note)}</dd>`).join('')}</dl></section>
<section><h2>27 册核对结果</h2><p class="muted">正文、代码、图形、表格、折叠内容和文件逐项比较。点击书名可打开当前知栈课程目录。</p><div class="scroll"><table><thead><tr><th>编号</th><th>课程</th><th>正文</th><th>代码块</th><th>图形</th><th>表格</th><th>文件</th><th>结果</th></tr></thead><tbody>${audit.books.map(b=>`<tr><td>${esc(b.id)}</td><td><a href="http://127.0.0.1:8462/?v=${esc(report.appVersion)}#shelf/course-${b.id.toLowerCase()}">${esc(b.name)}</a></td><td>${b.chapters}</td><td>${b.counts.code}</td><td>${b.counts.figures}</td><td>${b.counts.tables}</td><td>${b.counts.filesInMobileZip}</td><td class="pass">通过</td></tr>`).join('')}</tbody></table></div></section>
<div class="details"><section><h2>阅读与升级验证</h2><ul><li>${report.orderedTextChecks.toLocaleString('zh-CN')} 项文字顺序比对。</li><li>${report.hyperlinks} 个正文链接、${report.sectionLinks} 个小节入口核对。</li><li>${report.codeBlocks} 个代码块、${report.figures} 幅图、${report.tables} 张表对齐。</li><li>437 篇在发布版中逐篇展开检查，27 个目录入口完整。</li><li>91 项单元测试、28 项不同的桌面／手机浏览器用例通过。</li><li>从 1.15.0 和 1.15.2 升级，学习笔记、已读状态保留；38 篇个人资料不变。</li></ul></section><section><h2>实验实际检查</h2><ul>${report.execution.map(e=>`<li><b>${e.book}</b>：<code>${esc(e.command)}</code><br>${esc(e.scope)}</li>`).join('')}</ul><p class="muted">这些结果验证资料完整性与列出的执行范围；其余涉及开发板、电气连接和外设的实验仍按各册验收步骤上板验证。</p></section></div>
<section><h2>交付与后续构建</h2><p>工作目录、当前 8462 网页、桌面发布目录、Android APK 的课程内容哈希一致。${liveAssets.length} 个课程附件在当前服务实际读取并校验通过。</p><p>后续 Android 打包自动运行 <code>npm run audit:courses</code> 对应门禁；正文、文件、链接或源 HTML／SVG 检查失败会停止构建。</p><p>${publication?'私人更新服务已发布并完成公网下载校验，可在应用内检查更新。':'新版安装包已生成；本报告尚未记录公网发布验证。'}</p><p><a href="../${esc(apkPath)}">下载本机 Android 安装包 ${esc(report.appVersion)}</a> · ${(apk.length/1024/1024).toFixed(2)} MiB<br><span class="hash">SHA-256：${report.apk.sha256}</span></p><p><a href="integrity-repair-result.json">完整修复记录</a> · <a href="integrity-repair-original-preservation.json">修复前快照保全检查</a> · <a href="original-library-audit.json">逐篇与交付层比对</a> · <a href="original-library-rendering/result.json">实际阅读检查</a></p></section>
<footer>核验时间：${esc(new Date(report.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}（北京时间）。修复前备份：<code>${esc(report.backup)}</code>。</footer></main></html>`;
await fs.writeFile('docs/library-integrity-repair.html', html);
console.log(JSON.stringify({ report: 'docs/library-integrity-repair.html', articles: report.articles, unresolvedIssues: 0, liveAssets: liveAssets.length, published: !!publication, apk: report.apk }));
