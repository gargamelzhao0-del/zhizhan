import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const label = process.argv[2] || "after";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("http://127.0.0.1:8462/#library");
  await expect(page.locator(".shelf-card").first()).toBeVisible();
  await page.waitForTimeout(1000);
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((x) => [
        x.name,
        x.value,
      ]),
    );
  const before = await metrics();
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 6; i++) {
      scrollTo(0, 150 + i * 15);
      await wait(600);
      window.dispatchEvent(new Event("zhizhan:reveal-chrome"));
      await wait(600);
    }
  });
  const after = await metrics();
  const result = {
    label,
    viewport: "393x852",
    cpuThrottle: 4,
    transitions: 12,
    metrics: Object.fromEntries(
      [
        "LayoutCount",
        "RecalcStyleCount",
        "LayoutDuration",
        "RecalcStyleDuration",
        "ScriptDuration",
        "TaskDuration",
      ].map((k) => [k, after[k] - before[k]]),
    ),
    deviceTested: false,
  };
  await fs.writeFile(
    `docs/chrome-performance-${label}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
