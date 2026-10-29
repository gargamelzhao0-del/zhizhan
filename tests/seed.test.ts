import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultDB, saveArticle, saveNote } from "../src/db";
import { applyBundledSeed, contentKey, digest, updateBundledContent } from "../src/seed";
import {
  articleDefaults,
  type Seed,
  type Article,
  type Attachment,
} from "../src/model";
let database: VaultDB;
const makeArticle = (id: string, body = "old lesson"): Article => ({
  ...articleDefaults("course", id),
  id,
  body,
});
const makeSeed = (articles: Article[]): Seed => ({
  contentVersion: "edition-2",
  articles,
  attachments: [],
  shelves: [
    {
      id: "course",
      title: "课程",
      kind: "course",
      description: "",
      color: "#333333",
      createdAt: 1,
    },
  ],
});
beforeEach(() => {
  database = new VaultDB(`seed-${crypto.randomUUID()}`);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await database.delete();
});
describe("safe bundled course updates", () => {
  it("loads attachments concurrently and reuses verified bytes on a content-only update", async () => {
    const seed = makeSeed([makeArticle('a')]);
    seed.attachments = await Promise.all(Array.from({length: 9}, async (_, i) => ({
      id: `asset-${i}`, name: `example-${i}.c`, mime: 'text/plain', path: `assets/${i}.bin`, sha256: await digest(`code ${i}`),
    })));
    let active = 0, peak = 0, downloads = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('catalog.json')) return new Response(JSON.stringify(seed));
      active++; downloads++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active--;
      return new Response(`code ${url.match(/(\d+)\.bin$/)![1]}`);
    }));
    await updateBundledContent(database);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(6);
    expect(downloads).toBe(9);
    expect(await database.attachments.count()).toBe(9);
    seed.contentVersion = 'edition-3';
    seed.articles[0].body = 'updated prose';
    await updateBundledContent(database);
    expect(downloads).toBe(9);
    expect((await database.articles.get('a'))?.body).toBe('updated prose');
    // A damaged local attachment must not be trusted merely because its id matches.
    await database.attachments.update('asset-0', { data: new Blob(['damaged']) });
    await updateBundledContent(database);
    expect(downloads).toBe(10);
  });
  it("does not commit partial content when one of several parallel attachments is corrupt", async () => {
    await database.articles.add({...makeArticle('personal'), note: '保留笔记'});
    const seed = makeSeed([makeArticle('new-course')]);
    seed.attachments = await Promise.all(['good', 'bad'].map(async id => ({
      id, name: id, path: `${id}.bin`, mime: 'text/plain', sha256: await digest(id),
    })));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('catalog.json')
      ? JSON.stringify(seed) : url.endsWith('bad.bin') ? 'corrupt' : 'good')));
    await expect(updateBundledContent(database)).rejects.toThrow('校验失败');
    expect(await database.articles.count()).toBe(1);
    expect((await database.articles.get('personal'))?.note).toBe('保留笔记');
    expect(await database.attachments.count()).toBe(0);
    expect(await database.settings.count()).toBe(0);
  });
  it("detects Android HTML route fallback before changing existing data and permits a corrected retry", async () => {
    const article = makeArticle('preserved');
    await database.articles.add({...article, note:'原有笔记'});
    const seed = makeSeed([{...article, body:'新版正文'}]);
    const bytes = new TextEncoder().encode('真实源码');
    seed.attachments=[{id:'asset',name:'example.cpp',mime:'text/plain',path:'assets/asset.bin',sha256:await digest(bytes.buffer)}];
    let broken = true;
    const requests = vi.fn(async (url:string,options?:RequestInit) => {
      expect(options?.cache).toBe('no-store');
      if(url.endsWith('catalog.json'))return new Response(JSON.stringify(seed));
      return broken ? new Response('<!doctype html><html>App page</html>',{headers:{'content-type':'text/html'}}) : new Response(bytes,{headers:{'content-type':'application/octet-stream'}});
    });
    vi.stubGlobal('fetch',requests);
    await expect(updateBundledContent(database)).rejects.toThrow('页面而非附件');
    expect(await database.articles.get('preserved')).toMatchObject({body:article.body,note:'原有笔记'});
    expect(await database.settings.count()).toBe(0);
    expect(await database.attachments.count()).toBe(0);
    broken=false;
    await updateBundledContent(database);
    expect((await database.attachments.get('asset'))?.data.type).toBe('text/plain');
    expect(await database.articles.get('preserved')).toMatchObject({note:'原有笔记'});
  });
  it("initializes once and applies the same edition idempotently", async () => {
    const seed = makeSeed([makeArticle("a"), makeArticle("b")]);
    expect((await applyBundledSeed(seed, [], database)).added).toBe(2);
    expect(await applyBundledSeed(seed, [], database)).toEqual({
      added: 0,
      updated: 0,
      copies: 0,
      skipped: 2,
    });
    expect(await database.articles.count()).toBe(2);
  });
  it("migrates untouched legacy text while preserving notes, favorites and completion", async () => {
    const original = makeArticle("a");
    await database.articles.add({
      ...original,
      note: "我的理解",
      favorite: true,
      progress: 100,
      reviewAt: 999,
      reviewLevel: 3,
    });
    const seed = {
      ...makeSeed([{ ...original, body: "better lesson" }]),
      legacyHashes: { a: await digest(contentKey(original)) },
    };
    expect((await applyBundledSeed(seed, [], database)).updated).toBe(1);
    expect(await database.articles.get("a")).toMatchObject({
      body: "better lesson",
      note: "我的理解",
      favorite: true,
      progress: 100,
      reviewAt: 999,
      reviewLevel: 3,
      version: 2,
    });
    expect((await database.revisions.toArray())[0].article.body).toBe(
      "old lesson",
    );
  });
  it("preserves edited legacy text, creates a new copy and remaps chapter links", async () => {
    const a = makeArticle("a"),
      b = makeArticle("b", "[next](doc:a#section)");
    await database.articles.bulkAdd([
      { ...a, body: "personal change", note: "私有笔记" },
      b,
    ]);
    const seed = {
      ...makeSeed([{ ...a, body: "new text" }, b]),
      legacyHashes: {
        a: await digest(contentKey(a)),
        b: await digest(contentKey(b)),
      },
    };
    const result = await applyBundledSeed(seed, [], database);
    expect(result.copies).toBe(1);
    const copy = (await database.articles.toArray()).find(
      (x) => x.id !== "a" && x.id !== "b",
    )!;
    expect(copy.title).toContain("内置新版");
    expect(copy.note).toBe("");
    expect(await database.articles.get("a")).toMatchObject({
      body: "personal change",
      note: "私有笔记",
    });
    expect((await database.articles.get("b"))!.body).toContain(
      `doc:${copy.id}#section`,
    );
    await applyBundledSeed(seed, [], database);
    expect(await database.articles.count()).toBe(3);
  });
  it("keeps edits to an already installed edition and updates it safely on the next edition", async () => {
    const a = makeArticle("a");
    await applyBundledSeed(makeSeed([a]), [], database);
    await saveArticle({ ...a, body: "my change" }, 1, database);
    expect((await applyBundledSeed(makeSeed([a]), [], database)).copies).toBe(
      0,
    );
    expect(
      (
        await applyBundledSeed(
          makeSeed([{ ...a, body: "edition three" }]),
          [],
          database,
        )
      ).copies,
    ).toBe(1);
    expect((await database.articles.get("a"))!.body).toBe("my change");
  });
  it("copies cyclic edited references without mixing old and new graphs", async () => {
    const a = makeArticle("a", "[b](doc:b)"),
      b = makeArticle("b", "[a](doc:a)");
    await applyBundledSeed(makeSeed([a, b]), [], database);
    await saveArticle({ ...a, body: a.body + " personal" }, 1, database);
    await saveArticle({ ...b, body: b.body + " personal" }, 1, database);
    const result = await applyBundledSeed(
      makeSeed([{ ...a, body: a.body + " updated" }, b]),
      [],
      database,
    );
    expect(result.copies).toBe(2);
    const copies = (await database.articles.toArray()).filter(
      (x) => !["a", "b"].includes(x.id),
    );
    expect(copies[0].body).toContain(`doc:${copies[1].id}`);
    expect(copies[1].body).toContain(`doc:${copies[0].id}`);
  });
  it("does not resurrect trashed lessons or modify private articles", async () => {
    const a = { ...makeArticle("a"), deletedAt: 7 },
      privateArticle = { ...makeArticle("private"), body: "private" };
    await database.articles.bulkAdd([a, privateArticle]);
    await applyBundledSeed(
      makeSeed([{ ...a, body: "new", deletedAt: 0 }]),
      [],
      database,
    );
    expect(await database.articles.get("a")).toEqual(a);
    expect(await database.articles.get("private")).toEqual(privateArticle);
  });
  it("does not replace an existing attachment with different bytes", async () => {
    const old: Attachment = {
      id: "file",
      name: "old.cpp",
      mime: "text/plain",
      size: 3,
      data: new Blob(["old"]),
    };
    const fresh: Attachment = {
      ...old,
      name: "new.cpp",
      data: new Blob(["new"]),
    };
    await database.attachments.add(old);
    const seed = makeSeed([makeArticle("a", "[code](asset:file)")]);
    seed.attachments = [
      {
        id: "file",
        name: fresh.name,
        mime: fresh.mime,
        path: "file",
        sha256: await digest("new"),
      },
    ];
    await applyBundledSeed(seed, [fresh], database);
    expect(await (await database.attachments.get("file"))!.data.text()).toBe(
      "old",
    );
    expect((await database.articles.get("a"))!.body).toContain("asset:file-");
    await applyBundledSeed(seed, [fresh], database);
    expect(await database.attachments.count()).toBe(2);
  });
  it("rejects corrupt bundled assets before changing anything", async () => {
    const seed = makeSeed([makeArticle("a")]);
    seed.attachments = [
      {
        id: "bad",
        name: "bad",
        mime: "text/plain",
        path: "bad",
        sha256: await digest("expected"),
      },
    ];
    await expect(
      applyBundledSeed(
        seed,
        [
          {
            id: "bad",
            name: "bad",
            mime: "text/plain",
            data: new Blob(["wrong"]),
            size: 5,
          },
        ],
        database,
      ),
    ).rejects.toThrow("校验失败");
    expect(await database.articles.count()).toBe(0);
    expect(await database.settings.count()).toBe(0);
  });
  it("rolls back prior edits, revisions and markers if a later write fails", async () => {
    const a = makeArticle("a");
    await applyBundledSeed(makeSeed([a]), [], database);
    const beforeSettings = await database.settings.toArray();
    database.articles.hook("creating", (_key, obj) => {
      if (obj.id === "b") throw new Error("injected storage failure");
    });
    await expect(
      applyBundledSeed(
        makeSeed([{ ...a, body: "new" }, makeArticle("b")]),
        [],
        database,
      ),
    ).rejects.toThrow("injected storage failure");
    expect((await database.articles.get("a"))!.body).toBe("old lesson");
    expect(await database.revisions.count()).toBe(0);
    expect(await database.settings.toArray()).toEqual(beforeSettings);
  });
  it("serializes a simultaneous note save without losing the note", async () => {
    const a = makeArticle("a");
    await applyBundledSeed(makeSeed([a]), [], database);
    await Promise.all([
      applyBundledSeed(makeSeed([{ ...a, body: "new" }]), [], database),
      saveNote("a", "concurrent note", "", database),
    ]);
    expect(await database.articles.get("a")).toMatchObject({
      body: "new",
      note: "concurrent note",
    });
  });
});
