import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readNoteDraft, writeNoteDraft, clearNoteDraft } from "../src/drafts";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("retains the note base after recovery and does not clear a different window's newer draft", () => {
  writeNoteDraft("a", "未保存的修改", "原笔记");
  expect(readNoteDraft("a")).toEqual({ value: "未保存的修改", base: "原笔记" });
  clearNoteDraft("a", "另一草稿");
  expect(readNoteDraft("a")?.value).toBe("未保存的修改");
  clearNoteDraft("a", "未保存的修改");
  expect(readNoteDraft("a")).toBeUndefined();
});
it("keeps v1.0.0 plain-text drafts recoverable but marks their base unknown", () => {
  localStorage.setItem("note:a", "旧版笔记");
  expect(readNoteDraft("a")).toEqual({ value: "旧版笔记", base: null });
});
