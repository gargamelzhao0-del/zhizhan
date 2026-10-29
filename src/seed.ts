import Dexie from "dexie";
import { db, type VaultDB } from "./db";
import { copyTitle, internalLinks, rewriteLinks } from "./links";
import { uid, type Article, type Attachment, type Seed } from "./model";
import { retireOutdatedTutorials } from "./retiredTutorials";
import textbookCatalog from "../content/textbooks/catalog.json";

interface Entry {
  targetId: string;
  sourceHash: string;
  installedHash: string;
}
interface ContentState {
  version: string;
  articles: Record<string, Entry>;
}
export function contentKey(article: Article) {
  return JSON.stringify({
    title: article.title,
    body: article.body,
    tags: article.tags,
    shelfId: article.shelfId,
  });
}
export async function digest(data: string | ArrayBuffer) {
  const buffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

// Incoming assets are checked before any write. A transaction covers content, history and version markers.
export async function applyBundledSeed(
  seed: Seed,
  assets: Attachment[],
  database: VaultDB = db,
) {
  const incomingHashes = new Map(
    await Promise.all(
      seed.articles.map(
        async (a) => [a.id, await digest(contentKey(a))] as const,
      ),
    ),
  );
  const assetHashes = new Map(
    await Promise.all(
      assets.map(
        async (a) => [a.id, await digest(await a.data.arrayBuffer())] as const,
      ),
    ),
  );
  if (
    !seed.contentVersion ||
    new Set(seed.articles.map((a) => a.id)).size !== seed.articles.length ||
    new Set(seed.attachments.map((a) => a.id)).size !== seed.attachments.length
  )
    throw new Error("内置资料清单无效，尚未修改本地内容");
  for (const ref of seed.attachments) {
    if (assetHashes.get(ref.id) !== ref.sha256)
      throw new Error(`内置附件校验失败：${ref.name}`);
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
      const stored = (await database.settings.get("builtinContent"))?.value as
        ContentState | undefined;
      const state: ContentState = {
        version: seed.contentVersion,
        articles: {},
      };
      const result = { updated: 0, added: 0, copies: 0, skipped: 0 };
      const records = new Map(
        (await database.articles.toArray()).map((a) => [a.id, a]),
      );
      const current = new Map(
        seed.articles.map((a) => [
          a.id,
          records.get(stored?.articles?.[a.id]?.targetId || a.id),
        ]),
      );
      const currentHashes = new Map(
        await Dexie.waitFor(
          Promise.all(
            [...current].map(
              async ([id, a]) =>
                [id, a ? await digest(contentKey(a)) : ""] as const,
            ),
          ),
        ),
      );
      const targets = new Map(
        seed.articles.map((a) => [a.id, current.get(a.id)?.id || a.id]),
      );
      const changed = new Set<string>(),
        edited = new Set<string>(),
        copied = new Set<string>();
      for (const a of seed.articles) {
        const before = current.get(a.id),
          previous = stored?.articles?.[a.id];
        const baseline = previous?.installedHash || seed.legacyHashes?.[a.id];
        const hash = currentHashes.get(a.id);
        if (before && hash !== (baseline || incomingHashes.get(a.id)))
          edited.add(a.id);
        if (
          !before ||
          (previous
            ? previous.sourceHash !== incomingHashes.get(a.id)
            : hash !== incomingHashes.get(a.id))
        )
          changed.add(a.id);
      }
      // Changing a referenced chapter's identity must not rewrite the user's edited text.
      // Propagate copies through edited incoming references, including cycles.
      let again = true;
      while (again) {
        again = false;
        for (const a of seed.articles) {
          if (
            current.get(a.id)?.deletedAt ||
            !edited.has(a.id) ||
            copied.has(a.id)
          )
            continue;
          if (
            changed.has(a.id) ||
            internalLinks(a.body).some(
              (l) => l.kind === "doc" && copied.has(l.id),
            )
          ) {
            copied.add(a.id);
            targets.set(a.id, uid());
            again = true;
          }
        }
      }
      const assetTargets = new Map<string, string>();
      for (const ref of seed.attachments) {
        const asset = assets.find((a) => a.id === ref.id)!;
        let target = ref.id;
        const existing = await database.attachments.get(target);
        if (
          existing &&
          (await Dexie.waitFor(existing.data.arrayBuffer().then(digest))) !==
            ref.sha256
        )
          target = `${ref.id}-${ref.sha256.slice(0, 16)}`;
        const destination =
          target === ref.id ? existing : await database.attachments.get(target);
        if (
          destination &&
          (await Dexie.waitFor(destination.data.arrayBuffer().then(digest))) !==
            ref.sha256
        )
          throw new Error("内置附件身份冲突，更新已回滚");
        if (!destination)
          await database.attachments.add({ ...asset, id: target });
        assetTargets.set(ref.id, target);
      }
      for (const shelf of seed.shelves) {
        if (!(await database.shelves.get(shelf.id)))
          await database.shelves.add(shelf);
      }
      for (const a of seed.articles) {
        const before = current.get(a.id),
          previous = stored?.articles?.[a.id];
        if (before?.deletedAt) {
          if (previous) state.articles[a.id] = previous;
          result.skipped++;
          continue;
        }
        const body = rewriteLinks(a.body, (url) => {
          const match = /^(doc|asset):([\w-]+)(#.*)?$/.exec(url);
          if (!match) return url;
          return `${match[1]}:${(match[1] === "doc" ? targets : assetTargets).get(match[2]) || match[2]}${match[3] || ""}`;
        });
        const copy = copied.has(a.id);
        const desired: Article = {
          ...a,
          id: targets.get(a.id)!,
          body,
          title:
            copy || (previous && previous.targetId !== a.id)
              ? copyTitle(a.title, "（内置新版）")
              : a.title,
        };
        const desiredHash = await Dexie.waitFor(digest(contentKey(desired)));
        // Same edition: an edited local copy is left intact, including its custom links.
        if (
          before &&
          !copy &&
          (edited.has(a.id) || desiredHash === currentHashes.get(a.id))
        ) {
          state.articles[a.id] = previous || {
            targetId: before.id,
            sourceHash: incomingHashes.get(a.id)!,
            installedHash: currentHashes.get(a.id)!,
          };
          result.skipped++;
          continue;
        }
        if (before && !copy) {
          await database.revisions.add({
            id: uid(),
            articleId: before.id,
            savedAt: Date.now(),
            article: before,
          });
          await database.articles.put({
            ...before,
            title: desired.title,
            body,
            tags: desired.tags,
            shelfId: desired.shelfId,
            sourcePath: desired.sourcePath,
            order: desired.order,
            version: before.version + 1,
            updatedAt: Date.now(),
          });
          const revisions = await database.revisions
            .where("articleId")
            .equals(before.id)
            .sortBy("savedAt");
          if (revisions.length > 30)
            await database.revisions.bulkDelete(
              revisions.slice(0, revisions.length - 30).map((r) => r.id),
            );
          result.updated++;
        } else {
          await database.articles.add({
            ...desired,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          if (copy) result.copies++;
          else result.added++;
        }
        state.articles[a.id] = {
          targetId: desired.id,
          sourceHash: incomingHashes.get(a.id)!,
          installedHash: desiredHash,
        };
      }
      await database.settings.put({ key: "builtinContent", value: state });
      await database.settings.put({ key: "initialized", value: true });
      return result;
    },
  );
}

export async function updateBundledContent(database: VaultDB = db) {
  const response = await fetch("./seed/catalog.json", { cache: "no-store" });
  if (!response.ok) throw new Error("内置资料读取失败，请重新打开应用");
  const seed: Seed = await response.json();
  const cached = await database.attachments.bulkGet(seed.attachments.map(ref => ref.id));
  const assets: Attachment[] = new Array(seed.attachments.length);
  let next = 0;
  async function loadAssets() {
    while (next < seed.attachments.length) {
      const index = next++, ref = seed.attachments[index];
      let data = cached[index]?.data;
      // Reuse bytes only after validating them against this edition. The final
      // transaction still verifies every attachment and preserves edited copies.
      if (!data || await digest(await data.arrayBuffer()) !== ref.sha256) {
        const r = await fetch(`./seed/${ref.path}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`内置附件缺失：${ref.name}`);
        data = new Blob([await r.arrayBuffer()], { type: ref.mime });
        if (await digest(await data.arrayBuffer()) !== ref.sha256) {
          const html = /^\s*(?:<!doctype html|<html)/i.test(await data.slice(0, 200).text());
          throw new Error(html
            ? `内置附件读取异常：${ref.name}。应用返回了页面而非附件，请安装修复版本；本地资料未修改。`
            : `内置附件校验失败：${ref.name}。本地资料未修改，请重新打开或更新应用。`);
        }
      }
      assets[index] = { id: ref.id, name: ref.name, mime: ref.mime, size: data.size,
        data: data.type === ref.mime ? data : new Blob([data], { type: ref.mime }) };
    }
  }
  // Bound memory/network work while avoiding hundreds of serial local requests.
  await Promise.all(Array.from({ length: Math.min(6, seed.attachments.length) }, loadAssets));
  return applyBundledSeed(seed, assets, database);
}
let initialization: Promise<void> | undefined;
export async function initializeLibrary(database: VaultDB = db) {
  await retireOutdatedTutorials(database);
  const installed = (await database.settings.get("builtinContent"))?.value as ContentState | undefined;
  if (!(await database.settings.get("initialized")) ||
    (textbookCatalog.books.length > 0 && installed?.version !== textbookCatalog.installationVersion))
    await updateBundledContent(database);
}
export function initialize() {
  return (initialization ??= initializeLibrary().catch((e) => {
    initialization = undefined;
    throw e;
  }));
}
