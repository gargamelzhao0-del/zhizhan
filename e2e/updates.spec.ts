import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const { androidVersionCode } = JSON.parse(
  await fs.readFile("package.json", "utf8"),
);
const feed = "https://updates.example.test/zhizhan/latest.json";
const release = {
  format: "zhizhan-update",
  schemaVersion: 1,
  appId: "app.zhizhan.local",
  version: "9.0.0",
  versionCode: androidVersionCode + 10,
  minSdk: 26,
  publishedAt: "2026-10-07T12:00:00Z",
  notes: ["综合实验与课程更新", "<script>不执行的说明文本</script>"],
  apk: { url: "./app.apk", bytes: 6025659, sha256: "a".repeat(64) },
};

test("Android bridge uses its managed service automatically with no address entry", async ({ page }) => {
  await page.addInitScript(({ feed, release }) => {
    const w = window as any;
    w.androidBridge = {};
    w.updateCalls = [];
    w.Capacitor = {
      PluginHeaders: [
        { name:'Updates', methods:['getService','getInfo','check','cancel'].map(name=>({name,rtype:'promise'})) },
        { name:'App', methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}] },
      ],
      nativeCallback:()=> 'test-listener',
      nativePromise:async (plugin:string, method:string, options:any)=> {
        if(plugin==='App') return {};
        if(method==='getService') return {url:feed,managed:true};
        if(method==='getInfo') return {appId:'app.zhizhan.local',version:'1.3.0',versionCode:5,sdk:36};
        if(method==='check') { w.updateCalls.push(options.url); return {text:JSON.stringify(release),url:feed}; }
        return {};
      },
    };
  },{feed,release});
  await page.goto('/#settings');
  const panel=page.getByRole('region',{name:'软件更新',exact:true});
  await expect(panel.getByText('更新服务已内置，无需配置。个人资料保存在本机。')).toBeVisible();
  await expect(panel.getByLabel('版本清单 HTTPS 地址')).toHaveCount(0);
  await expect(panel.getByText('发现新版本 9.0.0',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).updateCalls)).toEqual([feed]);
  await page.reload();
  await expect(panel.getByRole('button',{name:'检查更新',exact:true})).toBeVisible();
  await page.waitForTimeout(3600);
  expect(await page.evaluate(()=>(window as any).updateCalls)).toEqual([]);
  await panel.getByRole('button',{name:'检查更新',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).updateCalls)).toEqual([feed]);
});

test("configurable manual update checks validate data and leave offline reading intact", async ({
  page,
  context,
}) => {
  let requests = 0;
  await page.route(feed, (route) => {
    requests++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(release),
    });
  });
  await page.goto("/#settings");
  const panel = page.getByRole("region", { name: "软件更新", exact: true });
  await expect(panel.getByText(/尚未配置更新地址。配置后/)).toBeVisible();
  expect(requests).toBe(0);
  await panel.getByRole("checkbox", { name: "自动检查新版本" }).uncheck();
  await panel
    .getByLabel("版本清单 HTTPS 地址")
    .fill("http://unsafe.example.test/feed");
  await panel.getByRole("button", { name: "保存更新地址" }).click();
  await expect(
    panel.getByRole("status").filter({ hasText: "请输入有效的 HTTPS" }),
  ).toBeVisible();
  await panel.getByLabel("版本清单 HTTPS 地址").fill(feed);
  await panel.getByRole("button", { name: "保存更新地址" }).click();
  await panel.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    panel.getByText("发现新版本 9.0.0", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("<script>不执行的说明文本</script>", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page.unroute(feed);
  await page.route(feed, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...release, appId: "malicious.other" }),
    }),
  );
  await panel.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    panel.getByText("版本清单属于其他应用", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("知栈 9.0.0", { exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await page.evaluate(() => {
    location.hash = "article/cpp-07";
  });
  await expect(page.locator(".reading-paper>h1")).toContainText("综合实战");
});

test("automatic checks are persisted and limited while manual checks can retry", async ({
  page,
}) => {
  let requests = 0;
  await page.route(feed, (route) => {
    requests++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...release, versionCode: androidVersionCode }),
    });
  });
  await page.goto("/#settings");
  const panel = page.getByRole("region", { name: "软件更新", exact: true });
  await panel.getByLabel("版本清单 HTTPS 地址").fill(feed);
  await panel.getByRole("button", { name: "保存更新地址" }).click();
  await expect(
    panel.getByText("当前已是此发布地址提供的最新版本", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "检查更新", exact: true }),
  ).toBeVisible();
  // Wait beyond the documented startup timer to verify persistent throttling.
  await page.waitForTimeout(3600);
  expect(requests).toBe(1);
  await panel.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    panel.getByText("当前已是此发布地址提供的最新版本", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(2);
});

test("failed update server produces a recoverable error rather than a false latest-version result", async ({
  page,
}) => {
  await page.route(feed, (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/#settings");
  const panel = page.getByRole("region", { name: "软件更新", exact: true });
  await panel.getByRole("checkbox", { name: "自动检查新版本" }).uncheck();
  await panel.getByLabel("版本清单 HTTPS 地址").fill(feed);
  await panel.getByRole("button", { name: "保存更新地址" }).click();
  await panel.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    panel.getByText("更新服务器返回 HTTP 503", { exact: true }),
  ).toBeVisible();
  await page.unroute(feed);
  await page.route(feed, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(release),
    }),
  );
  await panel.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    panel.getByText("发现新版本 9.0.0", { exact: true }),
  ).toBeVisible();
});
