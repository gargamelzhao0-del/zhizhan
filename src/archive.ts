import { isAssessmentSetting } from "./courseBlocks";
import { strToU8, strFromU8 } from "fflate";
import { zipInBackground, unzipInBackground } from "./zipJobs";
import { MAX_TOTAL, MAX_FILE } from "./zipCodec";
export { unzipBounded } from "./zipCodec";
import { db, snapshot, type VaultDB } from "./db";
import { rewriteLinks, internalLinks, copyTitle } from "./links";
import {
  uid,
  type Article,
  type Attachment,
  type Revision,
  type Setting,
  type Shelf,
} from "./model";
const safeFilename = (name: string) =>
  name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.+$/, "_") ||
  "attachment";
interface AssetRef {
  id: string;
  name: string;
  mime: string;
  path: string;
  size: number;
  sha256: string;
}
interface Manifest {
  format: "zhizhan";
  version: 1;
  exportedAt: string;
  shelves: Shelf[];
  articles: Article[];
  attachments: AssetRef[];
  revisions: Revision[];
  settings: Setting[];
}
export interface ImportData {
  manifest: Manifest;
  attachments: Attachment[];
}
const bytesBlob = (bytes: Uint8Array, mime = "application/zip") =>
  new Blob([new Uint8Array(bytes)], { type: mime });
export async function hash(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function exportArchive(database = db): Promise<Blob> {
  const state = await snapshot(database);
  if (
    state.shelves.length > 1000 ||
    state.articles.length > 10000 ||
    state.attachments.length > 5000 ||
    state.revisions.length > 10000
  )
    throw new Error("资料条目超过首版资料包数量限制");
  const files: Record<string, Uint8Array> = {};
  const refs: AssetRef[] = [];
  let size = 0;
  for (const a of state.attachments) {
    const bytes = new Uint8Array(await a.data.arrayBuffer());
    size += bytes.length;
    if (bytes.length > MAX_FILE || size > MAX_TOTAL)
      throw new Error("资料超过首版单包 128 MiB 限制，请先分批整理附件");
    const path = `assets/${a.id}/${safeFilename(a.name)}`;
    files[path] = bytes;
    refs.push({
      id: a.id,
      name: a.name,
      mime: a.mime,
      path,
      size: bytes.length,
      sha256: await hash(bytes),
    });
  }
  const manifest: Manifest = {
    format: "zhizhan",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state,
    attachments: refs,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  // Plain Markdown companions keep content usable outside this application.
  const portable = (body: string) =>
    rewriteLinks(body, (url) => {
      const match = /^(doc|asset):([a-zA-Z0-9_-]+)(#.*)?$/.exec(url);
      if (!match) return url;
      const [, kind, id, anchor = ""] = match;
      return (
        (kind === "doc"
          ? `${id}.md`
          : `../${(refs.find((a) => a.id === id)?.path || `assets/${id}`)
              .split("/")
              .map((part) => encodeURIComponent(part))
              .join("/")}`) + anchor
      );
    });
  for (const a of state.articles)
    files[`markdown/${a.id}.md`] = strToU8(
      `# ${a.title}\n\n${portable(a.body)}\n\n${a.note ? `## 我的笔记\n\n${portable(a.note)}` : ""}`,
    );
  files["README.txt"] = strToU8(
    "知栈资料包 v1\nmanifest.json 包含文章、进度、笔记和历史。markdown/ 是可直接阅读的副本；assets/ 是原始附件。请保留整个 ZIP 以便恢复。导入时同 ID 的不同内容保留为副本，不会覆盖原内容。\n",
  );
  size = Object.values(files).reduce((n, b) => n + b.length, 0);
  if (Object.values(files).some((b) => b.length > MAX_FILE))
    throw new Error(
      "正文与历史清单超过单文件 24 MiB 限制，请减少超长内容后导出",
    );
  if (size > MAX_TOTAL) throw new Error("资料超过单包 128 MiB 限制");
  const zipped = await zipInBackground(files);
  if (zipped.length > MAX_TOTAL)
    throw new Error("压缩后的资料包超过 128 MiB 限制");
  return bytesBlob(zipped);
}
function check(ok: unknown, text: string): asserts ok {
  if (!ok) throw new Error(`资料包校验失败：${text}`);
}
function text(v: unknown, max: number) {
  return typeof v === "string" && v.length <= max;
}
function id(v: unknown) {
  return typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
}
function number(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}
function validArticle(a: Article, shelfIds: Set<string>) {
  check(
    a &&
      id(a.id) &&
      shelfIds.has(a.shelfId) &&
      text(a.title, 300) &&
      text(a.body, 2 * 1024 * 1024) &&
      text(a.note, 128 * 1024),
    "文章字段",
  );
  check(
    Array.isArray(a.tags) &&
      a.tags.length <= 30 &&
      a.tags.every((t) => text(t, 100)),
    "标签",
  );
  check(
    typeof a.favorite === "boolean" &&
      [
        a.order,
        a.progress,
        a.reviewAt,
        a.reviewLevel,
        a.lastReadAt,
        a.createdAt,
        a.updatedAt,
        a.version,
        a.deletedAt,
      ].every(number) &&
      a.progress <= 100 &&
      a.reviewLevel <= 5 &&
      Number.isInteger(a.version),
    "文章进度或版本",
  );
  check(a.sourcePath === undefined || text(a.sourcePath, 2048), "来源路径");
}
function unique(values: { id: string }[], label: string) {
  check(
    values.length === new Set(values.map((a) => a.id)).size,
    `${label} ID 重复`,
  );
}
export async function inspectArchive(file: Blob): Promise<ImportData> {
  if (file.size > MAX_TOTAL) throw new Error("资料包超过 128 MiB");
  const files = await unzipInBackground(
    new Uint8Array(await file.arrayBuffer()),
  );
  check(files["manifest.json"], "缺少 manifest.json");
  const m = JSON.parse(strFromU8(files["manifest.json"])) as Manifest;
  check(m?.format === "zhizhan" && m.version === 1, "不支持的资料包格式或版本");
  check(
    Array.isArray(m.shelves) &&
      m.shelves.length <= 1000 &&
      Array.isArray(m.articles) &&
      m.articles.length <= 10000 &&
      Array.isArray(m.attachments) &&
      m.attachments.length <= 5000 &&
      Array.isArray(m.revisions) &&
      m.revisions.length <= 10000 &&
      Array.isArray(m.settings),
    "列表数量",
  );
  const shelfIds = new Set(m.shelves.map((s) => s.id));
  for (const s of m.shelves)
    check(
      s &&
        id(s.id) &&
        text(s.title, 150) &&
        text(s.description, 2000) &&
        ["project", "course", "experience"].includes(s.kind) &&
        /^#[0-9a-fA-F]{6}$/.test(s.color) &&
        number(s.createdAt),
      "知识库字段",
    );
  for (const a of m.articles) validArticle(a, shelfIds);
  unique(m.shelves, "知识库");
  unique(m.articles, "文章");
  unique(m.attachments, "附件");
  unique(m.revisions, "历史");
  const docIds = new Set(m.articles.map((a) => a.id));
  for (const r of m.revisions) {
    check(
      id(r.id) &&
        docIds.has(r.articleId) &&
        number(r.savedAt) &&
        r.article?.id === r.articleId,
      "历史版本",
    );
    validArticle(r.article, shelfIds);
  }
  const attachments: Attachment[] = [];
  for (const a of m.attachments) {
    check(
      a &&
        id(a.id) &&
        text(a.name, 255) &&
        text(a.mime, 150) &&
        a.path === `assets/${a.id}/${safeFilename(a.name)}` &&
        number(a.size) &&
        /^[a-f0-9]{64}$/.test(a.sha256),
      "附件字段",
    );
    const b = files[a.path];
    check(
      b && b.length === a.size && (await hash(b)) === a.sha256,
      `附件 ${a.name} 不完整或已损坏`,
    );
    attachments.push({
      id: a.id,
      name: a.name,
      mime: a.mime,
      data: bytesBlob(b, a.mime),
      size: a.size,
    });
  }
  m.settings = m.settings.filter(
    (s) =>
      s &&
      ((s.key === "theme" &&
        ["light", "dark", "system"].includes(String(s.value))) ||
        (s.key === "fontSize" && [16, 18, 20, 22].includes(Number(s.value))) ||
        isAssessmentSetting(s.key, s.value)),
  );
  return { manifest: m, attachments };
}
export async function importArchive(input: ImportData, database: VaultDB = db) {
  const m = input.manifest;
  // Snapshot used only for attachment hashing; all identity decisions happen atomically below.
  const oldAttachments = await database.attachments.toArray();
  const sameAttachments = new Set<string>();
  for (const a of m.attachments) {
    const old = oldAttachments.find((o) => o.id === a.id);
    if (
      old &&
      old.name === a.name &&
      old.mime === a.mime &&
      old.size === a.size &&
      (await hash(new Uint8Array(await old.data.arrayBuffer()))) === a.sha256
    )
      sameAttachments.add(a.id);
  }
  return database.transaction(
    "rw",
    [
      database.shelves,
      database.articles,
      database.attachments,
      database.revisions,
      database.settings,
    ],
    async () => {
      const shelfMap = new Map<string, string>(),
        docMap = new Map<string, string>(),
        assetMap = new Map<string, string>();
      let added = 0,
        skipped = 0,
        copies = 0;
      for (const s of m.shelves) {
        const old = await database.shelves.get(s.id);
        const next =
          old && JSON.stringify(old) !== JSON.stringify(s) ? uid() : s.id;
        shelfMap.set(s.id, next);
        if (!old || next !== s.id)
          await database.shelves.add({ ...s, id: next });
      }
      for (const a of input.attachments) {
        const old = await database.attachments.get(a.id);
        const next = old && !sameAttachments.has(a.id) ? uid() : a.id;
        assetMap.set(a.id, next);
        if (!old || next !== a.id)
          await database.attachments.add({ ...a, id: next });
      }
      const existing = new Map(
        (await database.articles.toArray()).map((a) => [a.id, a]),
      );
      const refsByDoc = new Map(
        m.articles.map((a) => [a.id, internalLinks(`${a.body}\n${a.note}`)]),
      );
      const changed = new Set<string>();
      for (const a of m.articles) {
        const old = existing.get(a.id);
        const remappedResource =
          shelfMap.get(a.shelfId) !== a.shelfId ||
          refsByDoc
            .get(a.id)!
            .some(
              (ref) =>
                ref.kind === "asset" &&
                assetMap.has(ref.id) &&
                assetMap.get(ref.id) !== ref.id,
            );
        if (
          old &&
          (remappedResource || JSON.stringify(old) !== JSON.stringify(a))
        )
          changed.add(a.id);
      }
      // Propagate through references (including cycles) so a copied course stays self-consistent.
      const dependents = new Map<string, Set<string>>();
      for (const [id, refs] of refsByDoc)
        for (const ref of refs)
          if (ref.kind === "doc") {
            if (!dependents.has(ref.id)) dependents.set(ref.id, new Set());
            dependents.get(ref.id)!.add(id);
          }
      const queue = [...changed];
      for (let i = 0; i < queue.length; i++)
        for (const parent of dependents.get(queue[i]) || []) {
          if (existing.has(parent) && !changed.has(parent)) {
            changed.add(parent);
            queue.push(parent);
          }
        }
      const inserting: Article[] = [];
      for (const a of m.articles) {
        const old = existing.get(a.id);
        if (old && !changed.has(a.id)) {
          docMap.set(a.id, a.id);
          skipped++;
          continue;
        }
        const next = old ? uid() : a.id;
        docMap.set(a.id, next);
        inserting.push({
          ...a,
          id: next,
          title: old ? copyTitle(a.title, "（导入副本）") : a.title,
          shelfId: shelfMap.get(a.shelfId)!,
        });
        added++;
        if (old) copies++;
      }
      const remap = (body: string) =>
        rewriteLinks(body, (url) => {
          const match = /^(doc|asset):([a-zA-Z0-9_-]+)(#.*)?$/.exec(url);
          if (!match) return url;
          const [, kind, key, anchor = ""] = match;
          return `${kind}:${(kind === "doc" ? docMap : assetMap).get(key) || key}${anchor}`;
        });
      for (const a of inserting)
        await database.articles.add({
          ...a,
          body: remap(a.body),
          note: remap(a.note),
        });
      for (const r of m.revisions) {
        const next = docMap.get(r.articleId)!;
        if (!inserting.some((a) => a.id === next)) continue;
        await database.revisions.add({
          ...r,
          id: uid(),
          articleId: next,
          article: {
            ...r.article,
            id: next,
            shelfId: shelfMap.get(r.article.shelfId)!,
            body: remap(r.article.body),
            note: remap(r.article.note),
          },
        });
      }
      for (const s of m.settings)
        if (!(await database.settings.get(s.key)))
          await database.settings.put(s);
      await database.settings.put({ key: "initialized", value: true });
      return { added, skipped, copies };
    },
  );
}
