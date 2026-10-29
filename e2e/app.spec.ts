import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("imports Markdown, local image and chapter links without executing HTML", async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !== new URL(baseURL!).origin
    )
      external.push(r.url());
  });
  await page.goto("/#settings");
  await expect(page.getByRole("heading", { name: "设置与资料" })).toBeVisible();
  await page.locator("input[type=file][multiple]").setInputFiles([
    {
      name: "first.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# 导入第一课\n\n![本地图片](tiny.png)\n\n[下一课](second.md#核心原理)\n\n<script>window.__injected=1</script>\n\n![远程图片](https://example.invalid/track.png)",
      ),
    },
    {
      name: "second.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# 导入第二课\n\n[本章原理](#核心原理)\n\n## 核心原理\n\n第二章原理。",
      ),
    },
    {
      name: "tiny.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xoAAAAASUVORK5CYII=",
        "base64",
      ),
    },
  ]);
  await expect(
    page.getByRole("status").filter({ hasText: "已导入 2 篇文章" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^导入第一课 / }).click();
  await expect(page.getByRole("img", { name: "本地图片" })).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: "本地图片" })
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__injected,
    ),
  ).toBeUndefined();
  await page.getByRole("link", { name: "下一课", exact: true }).click();
  await expect(page.locator(".reading-paper>h1")).toHaveText("导入第二课");
  await expect(page.locator('.prose h2[data-anchor="核心原理"]')).toBeVisible();
  await page.getByRole("button", { name: "本章原理", exact: true }).click();
  expect(page.url()).toContain("?section=");
  expect(external).toEqual([]);
});
test("offline knowledge lifecycle, persistent edits, attachments, revisions and round trip", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "学习" })).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "记录新知识" }).click();
  await page.getByLabel("文章标题", { exact: true }).fill("测试：资料可靠性");
  await page.getByRole("button", { name: "创建并编辑" }).click();
  const body =
    "## 验证步骤\n\n保存到本地的中文资料。\n\n```cpp\nint answer = 42;\n```\n\n| 输入 | 输出 |\n| --- | --- |\n| 测试 | 成功 |";
  await page.getByLabel("文章正文", { exact: true }).fill(body);
  await expect(page.getByText("所有修改已保存")).toBeVisible();
  await page.getByTitle("添加图片或附件").click(); // File chooser is fulfilled via DOM for deterministic testing.
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("attachment evidence"),
  });
  await expect(page.getByLabel("文章正文")).toContainText("");
  await expect(page.getByText("所有修改已保存")).toBeVisible();
  await page.getByRole("button", { name: "返回阅读" }).click();
  await expect(
    page.getByRole("heading", { name: "测试：资料可靠性", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "sample.txt", exact: true }).click();
  await expect(page.getByText("attachment evidence")).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.getByRole("button", { name: "我的学习笔记" }).click();
  await page.getByLabel("学习笔记").fill("记住短读必须按返回值推进偏移");
  await expect(page.getByText("笔记已保存")).toBeVisible();
  await page.getByRole("button", { name: "标记已读完" }).click();
  await page.getByRole("button", { name: "加入复习", exact: true }).click();
  await page.getByRole("button", { name: "切换收藏" }).click();
  const articleUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "测试：资料可靠性", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "已读完 · 重新学习" }),
  ).toBeVisible();
  await page.getByLabel("文章更多操作").click();
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("字符");
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  if (await page.getByRole("button", { name: "打开搜索" }).isVisible())
    await page.getByRole("button", { name: "打开搜索" }).click();
  await page.getByLabel("搜索全部知识").fill("短读 偏移");
  await expect(
    page.getByRole("button", { name: /测试：资料可靠性/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await page.goto("/#settings");
  await expect(page.getByRole("heading", { name: "设置与资料" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const backup = await download.path();
  expect(backup).toBeTruthy();
  await page.getByRole("button", { name: "导入资料包", exact: true }).click();
  await page
    .locator('input[accept=".zip,application/zip"]')
    .setInputFiles(backup!);
  await expect(page.getByRole("dialog")).toContainText("校验已通过");
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "导入完成" }),
  ).toBeVisible();
  expect(
    workers.filter((url) => url.includes("zip")).length,
  ).toBeGreaterThanOrEqual(2);
  await context.setOffline(true);
  await page.goto(articleUrl);
  await expect(
    page.getByRole("heading", { name: "测试：资料可靠性", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "移入回收站" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已移入回收站" }),
  ).toBeVisible();
  await page.goto("/#trash");
  await expect(
    page.getByText("测试：资料可靠性", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "回收站是空的" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("types multiple tags naturally and saves before the application back action", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "记录新知识" }).click();
  await page.getByLabel("文章标题", { exact: true }).fill("标签与返回验证");
  await page.getByRole("button", { name: "创建并编辑" }).click();
  const tags = page.getByLabel("标签，以逗号分隔");
  await tags.pressSequentially("Linux,C++,Linux", { delay: 30 });
  await expect(tags).toHaveValue("Linux,C++,Linux");
  await page.getByLabel("文章正文").fill("返回前最后输入的内容");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("zhizhan:back", { cancelable: true })),
  );
  await expect(page.locator(".reading-paper>h1")).toHaveText("标签与返回验证");
  await page.getByLabel("文章更多操作").click();
  await expect(page.getByRole("dialog")).toContainText("Linux / C++");
  await page.getByLabel("关闭阅读面板").click();
  await page.reload();
  await expect(page.locator(".prose")).toContainText("返回前最后输入的内容");
});
test("recovered stale notes never overwrite newer notes and can be saved separately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "记录新知识" }).click();
  await page.getByLabel("文章标题", { exact: true }).fill("笔记冲突验证");
  await page.getByRole("button", { name: "创建并编辑" }).click();
  await page.getByRole("button", { name: "返回阅读" }).click();
  const original = page.url();
  await page.getByRole("button", { name: "我的学习笔记" }).click();
  await page.getByLabel("学习笔记").fill("已经保存的新笔记");
  await expect(page.getByText("笔记已保存")).toBeVisible();
  await page.evaluate(() => {
    const id = location.hash.split("/")[1];
    localStorage.setItem(
      `note:${id}`,
      JSON.stringify({
        format: "zhizhan-note-v1",
        value: "需要找回的旧草稿",
        base: "更早的笔记",
      }),
    );
  });
  await page.reload();
  await expect(page.getByLabel("学习笔记")).toHaveValue("需要找回的旧草稿");
  await expect(page.getByText(/保存失败：笔记已在另一窗口修改/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "草稿另存为文章" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "草稿另存为文章" }).click();
  await expect(page.locator(".prose")).toContainText("需要找回的旧草稿");
  await page.goto(original);
  await page.getByRole("button", { name: "我的学习笔记" }).click();
  await expect(page.getByLabel("学习笔记")).toHaveValue("已经保存的新笔记");
});
test("mobile layout, real chapters, dark mode and source navigation", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "学习" })).toBeVisible();
  await page.goto("/#article/handbook-14");
  await expect(page.locator(".prose")).toContainText("writer");
  await expect(page.locator(".diagram svg").first()).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({
    path: `test-results/${info.project.name}-reader.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const source = page.locator(".prose button.inline-link").first();
  await source.click();
  await expect(page.locator(".asset-code")).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.goto("/#settings");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: `test-results/${info.project.name}-dark.png`,
    fullPage: false,
  });
});
