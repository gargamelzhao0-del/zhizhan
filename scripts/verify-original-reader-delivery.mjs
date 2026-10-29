import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await fs.readFile('content/original-library.json', 'utf8'));
const metadata = JSON.parse(await fs.readFile('package.json', 'utf8'));
const packagesOnly = process.argv.includes('--packages-only');
const apkPath = `release/zhizhan-${metadata.version}-android.apk`;
const bytes = await fs.readFile(apkPath), apk = unzipSync(bytes);
const sha = value => createHash('sha256').update(value).digest('hex');
const checked = [];
for (const file of manifest.files) {
  const original = await fs.readFile(`${manifest.source}/${file.path}`);
  assert.equal(sha(original), file.sha256, `Source changed: ${file.path}`);
  for (const directory of ['public', 'dist', 'release/zhizhan-windows/dist'])
    assert.equal(sha(await fs.readFile(`${directory}/original-library/${file.path}`)), file.sha256, `${directory}: ${file.path}`);
  const packaged = apk[`assets/public/original-library/${file.path}`];
  assert.ok(packaged, `Missing from APK: ${file.path}`);
  assert.equal(sha(packaged), file.sha256, `APK mismatch: ${file.path}`);
  checked.push(file.path);
}
for (const [original, alias] of Object.entries(manifest.downloads)) {
  assert.equal(sha(apk[`assets/public/original-library/${alias}`]), manifest.files.find(f => f.path === original).sha256);
}
const books = [];
for (const book of manifest.books) {
  if (packagesOnly) { books.push({ ...book, liveVerified: false }); continue; }
  const response = await fetch(`http://127.0.0.1:8462/original-library/${book.path}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), book.sha256, `Live: ${book.id}`);
  books.push({ ...book, liveVerified: true });
}
const result = { version: metadata.version, checkedAt: new Date().toISOString(),
  source: manifest.source, sourceUnchanged: true, originalFilesChecked: checked.length,
  sourceManifestSha256: manifest.sourceManifestSha256, books,
  layers: ['原手机书库', '知栈工作目录', '生产构建', 'Windows 发布目录', 'Android 安装包'],
  liveBooksChecked: books.filter(book => book.liveVerified).length, desktopRestartPending: packagesOnly,
  apk: { path: apkPath, bytes: bytes.length, sha256: sha(bytes) },
  limitation: '核对了原册文件原样收录和桌面/手机尺寸浏览器显示；没有连接用户手机检查实际安装状态。' };
await fs.writeFile('docs/original-reader-delivery.json', JSON.stringify(result, null, 2) + '\n');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await fs.writeFile('docs/original-reader-delivery.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原版整册交付核对 · 知栈 ${metadata.version}</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:1040px;margin:auto;padding:24px;color:#18342e;background:#f6f8f5}h1{font-size:28px}p{max-width:54em}a{color:#125b53}.table{overflow:auto}table{border-collapse:collapse;width:100%;background:white;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce5df}code{overflow-wrap:anywhere}small{color:#617069}</style><h1>原版整册已接入知栈 ${metadata.version}</h1><p>来源：<code>${esc(manifest.source)}</code>。27 册以完整原网页接入课程，保留连续正文、原目录、图表、代码、自测和附录。原手机书库在本次接入中未被重新生成或修改。</p><p>每册课程顶部选择 <strong>阅读原版整册</strong>；需要笔记时用 <strong>分章与笔记</strong> 返回当前章节。原有分章正文和个人数据继续保留。</p><p>另修正一个课程入口问题：更新为保护用户编辑而另存新版时，目录和“下一篇”现在打开已安装的新版，旧文仍可保留。</p><p><strong>${checked.length} 个原文件逐字节一致</strong>：已逐一核对工作目录、生产构建、桌面发布目录和 APK；${packagesOnly ? "电脑端服务等待手动重启，运行中的服务尚未完成验收。" : "运行中的 8462 服务也已核对全部 27 册。"}以下哈希对应原手机书库的完整 HTML 文件。</p><div class="table"><table><thead><tr><th>册号</th><th>原册名称</th><th>原目录项</th><th>完整文件</th><th>SHA-256（前 16 位）</th></tr></thead><tbody>${books.map(b=>`<tr><td>${b.id}</td><td>${esc(b.name)}</td><td>${b.chapters.length}</td><td>${b.bytes.toLocaleString()} 字节</td><td><code>${b.sha256.slice(0,16)}</code></td></tr>`).join('')}</tbody></table></div><p><a href="http://127.0.0.1:8462/#original/course-b03">打开知栈中的原版 Rust 整册</a> · <a href="../${apkPath}">Android 安装包 ${metadata.version}</a> · <a href="original-reader-delivery.json">完整核对记录</a></p><p><small>${esc(result.limitation)} 文件一致性证明迁移保真，不代表原书的知识深度、技术准确性或硬件实验已全部验收。</small></p></html>`);
console.log(JSON.stringify({ version: result.version, originalFilesChecked: checked.length, liveBooksChecked: result.liveBooksChecked, apk: result.apk }));
