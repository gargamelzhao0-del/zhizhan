import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { annotateTerms } from "./annotate-terms.mjs";
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.argv[2] ||
  "C:/Users/Administrator/Documents/work/Nuwax AI Partner/Nuwax AI Partner 7.0/NuwaxAIPartner-v2";
const book = path.join(source, "docs/工程开发学习手册");
const out = path.join(app, "public/seed");
await fs.mkdir(path.join(out, "assets"), { recursive: true });
const now = Date.parse("2026-10-09T00:00:00+08:00");
const contentVersion = "2026.10.13.5";
const shelves = [
  {
    id: "handbook",
    title: "Nuwax AI Partner 开发实录",
    kind: "project",
    description:
      "从构建、硬件与声音地基，到逐项功能接线、失败恢复和交付验收，沿真实代码重新做出灵珠。",
    color: "#386557",
    createdAt: now,
  },
  {
    id: "lessons",
    title: "开发问题与解决经验",
    kind: "experience",
    description:
      "保留排查中的证据、根因和验证方法，把真实问题变成可以复用的经验。",
    color: "#7c6395",
    createdAt: now,
  },
];
const articles = [],
  assets = new Map(),
  warnings = [];
const chapters = (await fs.readdir(book))
  .filter((n) => /^\d\d-.+\.md$/.test(n))
  .sort();
const mapping = new Map(
  chapters.map((n) => [
    path.resolve(book, n).toLowerCase(),
    `handbook-${n.slice(0, 2)}`,
  ]),
);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const article = (id, shelfId, title, body, order, tags = [], sourcePath) => ({
  id,
  shelfId,
  title,
  body,
  order,
  tags,
  sourcePath,
  favorite: false,
  progress: 0,
  note: "",
  reviewAt: 0,
  reviewLevel: 0,
  lastReadAt: 0,
  createdAt: now,
  updatedAt: now,
  version: 1,
  deletedAt: 0,
});
async function addAsset(file) {
  const exampleRoot = path.join(app, "content/examples");
  const exampleRelative = path
    .relative(exampleRoot, file)
    .replaceAll("\\", "/");
  const isExample =
    !exampleRelative.startsWith("..") && !path.isAbsolute(exampleRelative);
  const relative = isExample
    ? `course-examples/${exampleRelative}`
    : path.relative(source, file).replaceAll("\\", "/");
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    /^(tmp|build[^/]*|runtime-logs|\.git|\.private)\//.test(relative) ||
    /(^|\/)(\.env|.*\.(pem|jks|keystore))$/i.test(relative)
  )
    throw Error(`不收录私有或构建文件 ${relative}`);
  const data = await fs.readFile(file);
  const id = isExample
    ? `lesson-${hash(data).slice(0, 24)}`
    : `source-${hash(relative).slice(0, 24)}`;
  if (!assets.has(id)) {
    if (data.length > 3 * 1024 * 1024) throw Error(`引用文件过大 ${relative}`);
    const mime = /\.png$/i.test(file)
      ? "image/png"
      : /\.jpe?g$/i.test(file)
        ? "image/jpeg"
        : /\.json$/i.test(file)
          ? "application/json"
          : /\.zip$/i.test(file) ? "application/zip" : "text/plain";
    // Capacitor's Android HTML5 router serves index.html for extensionless paths.
    // A binary extension avoids that route, and a content hash avoids stale bytes
    // after an upgrade while preserving the stable attachment identity.
    const assetPath = `assets/${id}-${hash(data).slice(0, 16)}.bin`;
    await fs.writeFile(path.join(out, assetPath), data);
    assets.set(id, {
      id,
      name: path.basename(file),
      mime,
      path: assetPath,
      source: relative,
      sha256: hash(data),
      bytes: data.length,
    });
  }
  return id;
}
async function rewrite(body, file) {
  const rx = /(!?\[[^\]]*\])\((<[^>]+>|[^)]+)\)/g;
  const matches = [...body.matchAll(rx)];
  for (const m of matches) {
    let href = m[2].replace(/^<|>$/g, "");
    if (/^(https?:|mailto:|#|doc:|asset:|term:)/.test(href)) continue;
    try {
      href = decodeURIComponent(href.split("#")[0]);
      if (!href) continue;
      const target = path.resolve(path.dirname(file), href);
      let link = mapping.get(target.toLowerCase());
      const value = link ? `doc:${link}` : `asset:${await addAsset(target)}`;
      body = body.replace(m[0], `${m[1]}(${value})`);
    } catch (e) {
      warnings.push({ file: path.basename(file), href, error: e.message });
      body = body.replace(
        m[0],
        `${m[1].replace(/^!?\[|\]$/g, "")}（原工程路径：\`${href}\`，未打包该目录）`,
      );
    }
  }
  return body;
}
for (const [index, name] of chapters.entries()) {
  const file = path.join(book, name),
    raw = await fs.readFile(file, "utf8");
  const title = raw.match(/^#\s+(.+)$/m)?.[1] || name;
  const body = annotateTerms(await rewrite(raw.replace(/^#\s+[^\n]+\n/, ""), file));
  articles.push(
    article(
      `handbook-${name.slice(0, 2)}`,
      "handbook",
      title,
      body,
      index,
      ["ESP32-S3", "技术实现"],
      `工程开发学习手册/${name}`,
    ),
  );
}
const curriculum = JSON.parse(await fs.readFile(path.join(app, "content/curriculum.json"), "utf8"));
for (const kind of ["lessons"]) {
  const lessonOrder = [kind + "-00", ...(curriculum[kind]?.modules.flatMap(m => m.lessons) || [])];
  const dir = path.join(app, "content", kind);
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md")).sort();
  for (const [index, name] of names.entries()) {
    let body = (await fs.readFile(path.join(dir, name), "utf8")).replace(
      /^\uFEFF/,
      "",
    );
    const title = body.match(/^#\s+(.+)$/m)?.[1] || name;
    body = body.replace(/^#\s+[^\n]+\n/, "");
    for (const match of [...body.matchAll(/<!-- example:([\w/.-]+) -->/g)]) {
      const exampleRoot = path.join(app, "content/examples");
      const example = path.resolve(exampleRoot, match[1]);
      if (path.relative(exampleRoot, example).startsWith(".."))
        throw Error("Example outside course root");
      const code = await fs.readFile(example, "utf8");
      const lang = /\.(cpp|hpp)$/.test(example)
        ? "cpp"
        : example.endsWith(".c")
          ? "c"
          : example.endsWith(".dts")
            ? "dts"
            : example.endsWith(".py") ? "python" : example.endsWith("CMakeLists.txt") ? "cmake" : "makefile";
      const asset = await addAsset(example);
      body = body.replace(
        match[0],
        `[完整源码：${path.basename(example)}](asset:${asset})\n\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\``,
      );
    }
    articles.push(
      article(`${kind}-${name.slice(0, 2)}`, kind, title, body, lessonOrder.includes(`${kind}-${name.slice(0, 2)}`) ? lessonOrder.indexOf(`${kind}-${name.slice(0, 2)}`) : index, [
        kind === "cpp" ? "C++17" : kind === "linux" ? "Linux" : "经验复盘",
      ]),
    );
  }
}
// Textbooks remain ordinary articles: notes, history, search and portable backups
// use the same proven path as the original project records.
const textbooks = JSON.parse(await fs.readFile(path.join(app, "content/textbooks/catalog.json"), "utf8"));
async function textbookBody(file) {
  let body=(await fs.readFile(path.join(app,'content/textbooks',file),'utf8')).replace(/^# [^\n]+\n/,'');
  for(const match of [...body.matchAll(/textbook-file:([^\s)]+)/g)]) {
    const file=path.resolve(app,'content/examples/textbooks',decodeURIComponent(match[1]));
    const relative=path.relative(path.join(app,'content/examples/textbooks'),file);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid textbook attachment');
    body=body.replaceAll(match[0],`asset:${await addAsset(file)}`);
  }
  return body;
}
for (const b of textbooks.books) {
  shelves.push({ id:b.shelfId,title:b.name,kind:'course',description:b.objective,color:'#456d75',createdAt:now });
  const experimentLink=b.experimentFile ? `\n\n## 配套实验\n\n[下载实验源码包（${b.experimentCount} 个文件）](asset:${await addAsset(path.join(app,'content/examples/textbooks',b.experimentFile))})\n\n依正文注明的工具链、SDK 和平台运行；主机结果不等于目标板验收。` : '';
  const guide=await textbookBody(b.guide.file) + experimentLink +
    `\n\n## 本册目录\n\n${b.chapters.map(c=>`${c.order}. [${c.title}](doc:${c.id})`).join('\n')}` +
    '\n\n[完整项目学习路线](doc:course-learning-path) · [逐册审查与验证边界](doc:course-quality-review)\n';
  articles.push(article(b.overviewId,b.shelfId,`${b.name} · 导读与实验`,guide,0,[b.id,b.group,'课本导读']));
  for(const chapter of b.chapters) {
    const body=await textbookBody(chapter.file);
    articles.push(article(chapter.id,b.shelfId,chapter.title,body,chapter.order,[b.id,b.group,'课本正文'],`修订书库/${b.href}#${chapter.anchor}`));
  }
}
if(textbooks.auxiliary?.length) {
  shelves.push({id:'course-workshop',title:'项目学习路线与实践',kind:'course',description:'从零基础到独立项目；六项工程与逐册审查',color:'#456d75',createdAt:now});
  for(const [i,item] of textbooks.auxiliary.entries())
    articles.push(article(item.id,'course-workshop',item.title,await textbookBody(item.file),i,['学习路线','综合项目'],`修订书库/${item.href}`));
}

await fs.writeFile(
  path.join(out, "catalog.json"),
  JSON.stringify({
    contentVersion,
    legacyHashes: JSON.parse(
      await fs.readFile(
        path.join(app, "content/legacy-seed-hashes.json"),
        "utf8",
      ),
    ),
    shelves,
    articles,
    attachments: [...assets.values()].map(
      ({ id, name, mime, path, sha256 }) => ({
        id,
        name,
        mime,
        path,
        sha256,
      }),
    ),
  }),
);
await fs.mkdir(path.join(app, "docs"), { recursive: true });
// Only remove unreferenced generated files under this generator's asset directory.
const assetDirectory = path.resolve(out, "assets");
const retained = new Set([...assets.values()].map((a) => path.basename(a.path)));
for (const name of await fs.readdir(assetDirectory)) {
  const generatedFile = path.resolve(assetDirectory, name);
  if (path.dirname(generatedFile) !== assetDirectory) throw Error("Invalid asset cleanup path");
  if (/^(source|lesson)-[a-f0-9]{24}(?:-[a-f0-9]{16}\.bin)?$/.test(name) && !retained.has(name))
    await fs.unlink(generatedFile);
}
await fs.writeFile(
  path.join(app, "docs/seed-report.json"),
  JSON.stringify(
    {
      date: "2026-10-09",
      source,
      chapters: chapters.length,
      articles: articles.length,
      assets: [...assets.values()],
      warnings,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    chapters: chapters.length,
    articles: articles.length,
    attachments: assets.size,
    warnings: warnings.length,
  }),
);
