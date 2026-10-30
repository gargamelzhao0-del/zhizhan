import { test, expect } from "@playwright/test";

test("Samsung Galaxy S25 (360x780) full experience: home interactive grid, 27-book demos, multi-demo tabs, pocket calculator, and SVG step cards", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Samsung Galaxy S25 standard viewport (360 x 780, 19.5:9)
  await page.setViewportSize({ width: 360, height: 780 });

  // 1. Home Interactive Demo Grid on Galaxy S25
  await page.goto("/#home");
  const homeDemoGrid = page.locator(".home-demo-grid");
  await expect(homeDemoGrid).toBeVisible();
  expect(await homeDemoGrid.locator(".home-demo-card").count()).toBe(6);
  await page.screenshot({ path: info.outputPath("s25-home-interactive.png") });

  // 2. Navigate via Home Demo Card to B05-M01 Clock Tree
  await homeDemoGrid.getByRole("button", { name: /STM32 时钟树与 PLL/ }).click();
  await expect(page).toHaveURL(/#article\/course-b05-m01/);

  const bookBar = page.locator(".reader-book-bar");
  await expect(bookBar).toBeVisible();
  await expect(bookBar).toContainText("B05");
  await expect(bookBar).toContainText("交互推演");

  const demo = page.locator(".learning-demo").first();
  await expect(demo).toBeVisible();
  await expect(demo).toContainText("STM32 时钟树倍频、分频与 Flash 等待周期");
  await demo.locator(".demo-steps li").nth(3).click();
  await expect(demo).toContainText("VCO 72 MHz");
  await page.screenshot({ path: info.outputPath("s25-b05-clock-demo.png") });

  // 3. Test Embedded Pocket Calculator ("计算尺") in Reader
  await bookBar.getByRole("button", { name: /计算尺/ }).click();
  const calcDialog = page.getByRole("dialog", { name: "嵌入式随身工程计算尺" });
  await expect(calcDialog).toBeVisible();
  await expect(calcDialog).toContainText("十六进制寄存器值");
  await calcDialog.getByRole("tab", { name: /TIM/ }).click();
  await expect(calcDialog).toContainText("溢出频率 / PWM 频率");
  await page.screenshot({ path: info.outputPath("s25-pocket-calculator.png") });
  await calcDialog.getByRole("button", { name: "关闭阅读面板" }).click();

  // 4. Test Multi-Demo Chapter Tabs on B05-M10 (Low Power + Watchdog FSM)
  await page.goto("/#article/course-b05-m10");
  const demoTabs = page.locator(".chapter-demo-tabs");
  await expect(demoTabs).toBeVisible();
  await expect(page.locator(".learning-demo").first()).toContainText(
    "MCU 低功耗模式",
  );
  await demoTabs.getByRole("tab").nth(1).click();
  await expect(page.locator(".learning-demo").first()).toContainText(
    "工业高可靠状态机",
  );

  // 5. Test CAN Bus Arbitration Visualizer on B07-M04
  await page.goto("/#article/course-b07-m04");
  const canDemo = page.locator(".learning-demo").first();
  await expect(canDemo).toContainText("CAN 总线非破坏性逐位仲裁");
  await canDemo.locator(".demo-steps li").nth(3).click();
  await expect(canDemo).toContainText("Node B 无损退避");
  await page.screenshot({ path: info.outputPath("s25-can-arbitration.png") });

  // 6. Verify 320px narrow viewport & dark theme zero horizontal overflow
  await page.goto("/#settings");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/#article/course-b07-m04");
  await expect(page.locator(".learning-demo").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
