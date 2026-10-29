import { test, expect } from "@playwright/test";

test("the shipped library excludes retired tutorials and keeps personal-reference content", async ({ page }) => {
  await page.goto("/#courses");
  await expect(page.getByRole("heading", { name: "从基础，走向系统。" })).toBeVisible();
  await expect(page.locator(".textbook-card")).toHaveCount(27);
  const seed = await (await page.request.get("/seed/catalog.json")).json();
  expect(seed.articles).toHaveLength(475);
  expect(seed.articles.some((a: { id: string }) => /^(cpp-|linux-|book-)/.test(a.id))).toBe(false);
  expect(seed.articles.some((a: { id: string }) => a.id === "handbook-01")).toBe(true);
  await page.goto("/#article/handbook-01");
  await expect(page.locator(".prose")).toBeVisible();
});
