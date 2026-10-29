import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const currentCatalog = JSON.parse(
  await fs.readFile("public/seed/catalog.json", "utf8"),
);

test("updates the shipped legacy library without losing edits or reviving trash", async ({
  page,
}) => {
  const legacy = JSON.parse(
    await fs.readFile("e2e/fixtures/legacy-catalog.json", "utf8"),
  );
  legacy.articles.find((a: { id: string }) => a.id === "cpp-01").body =
    "我修改过的旧课，必须保留";
  Object.assign(
    legacy.articles.find((a: { id: string }) => a.id === "cpp-02"),
    { note: "我的资源管理笔记", progress: 100, favorite: true },
  );
  legacy.articles.find((a: { id: string }) => a.id === "linux-02").deletedAt =
    10;
  await page.goto("/#settings");
  await expect(page.getByRole("heading", { name: "设置与资料" })).toBeVisible();
  await page.evaluate(
    (seed) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("zhizhan-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction(
            ["articles", "shelves", "settings", "revisions"],
            "readwrite",
          );
          tx.objectStore("articles").clear();
          tx.objectStore("shelves").clear();
          tx.objectStore("revisions").clear();
          tx.objectStore("settings").clear();
          for (const a of seed.articles) tx.objectStore("articles").put(a);
          for (const s of seed.shelves) tx.objectStore("shelves").put(s);
          tx.objectStore("settings").put({ key: "initialized", value: true });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onabort = () => {
            database.close();
            reject(tx.error);
          };
        };
      }),
    legacy,
  );
  await page.reload();
  await page.getByRole("button", { name: "更新内置资料", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "内置资料更新完成" }),
  ).toBeVisible();
  const inspect = () =>
    page.evaluate(
      () =>
        new Promise<any[]>((resolve, reject) => {
          const request = indexedDB.open("zhizhan-v1");
          request.onsuccess = () => {
            const database = request.result;
            const tx = database.transaction("articles");
            const read = tx.objectStore("articles").getAll();
            read.onsuccess = () => resolve(read.result);
            read.onerror = () => reject(read.error);
            tx.oncomplete = () => database.close();
          };
          request.onerror = () => reject(request.error);
        }),
    );
  const first = await inspect();
  expect(first).toHaveLength(currentCatalog.articles.length + 1);
  expect(first.find((a) => a.id === "cpp-01").body).toBe(
    "我修改过的旧课，必须保留",
  );
  expect(first.find((a) => a.id === "cpp-02")).toMatchObject({
    note: "我的资源管理笔记",
    progress: 100,
    favorite: true,
  });
  expect(first.find((a) => a.id === "linux-02").deletedAt).toBe(10);
  const copy = first.find((a) => a.title.includes("内置新版"));
  expect(first.find((a) => a.id === "cpp-00").body).toContain(`doc:${copy.id}`);
  await page.getByRole("button", { name: "更新内置资料", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "内置资料已是本版内容" }),
  ).toBeVisible();
  expect(await inspect()).toHaveLength(currentCatalog.articles.length + 1);
  await page.goto(`/#article/${copy.id}`);
  await expect(page.locator(".reading-paper>h1")).toContainText("内置新版");
  await page
    .getByRole("button", { name: "完整源码：01-lifetime.cpp", exact: true })
    .click();
  await expect(page.locator(".asset-code")).toContainText("std::string_view");
});

test("course roadmap, complete experiment and local source stay usable offline", async ({
  page,
  context,
}) => {
  await page.goto("/#article/cpp-00");
  await expect(page.locator(".reading-paper>h1")).toContainText("C++ 学习路线");
  await context.setOffline(true);
  await page.locator('.prose a[href="#article/cpp-04"]').click();
  await expect(page.locator(".prose")).toContainText("class Queue");
  await expect(page.locator(".prose")).toContainText(
    "sum=21 closed_push=0 drained_pop=0",
  );
  await page
    .getByRole("button", { name: "完整源码：04-concurrency.cpp", exact: true })
    .click();
  await expect(page.locator(".asset-code")).toContainText("worker.join()");
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
