import { beforeEach, expect, it, vi } from "vitest";
const plugin = vi.hoisted(() => ({
  addListener: vi.fn(), download: vi.fn(), cancel: vi.fn(),
  getInfo: vi.fn(), check: vi.fn(), install: vi.fn(), getService: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" }, registerPlugin: () => plugin,
}));
import { configuredService, updateBackend, type UpdateManifest } from "../src/updates";
const manifest: UpdateManifest = { format: "zhizhan-update", schemaVersion: 1, appId: "app.zhizhan.local",
  version: "9.0.0", versionCode: 90, minSdk: 26, publishedAt: "2026-10-07T12:00:00Z", notes: [],
  apk: { url: "https://updates.example.test/app.apk", bytes: 100, sha256: "a".repeat(64) } };
beforeEach(() => { vi.resetAllMocks(); plugin.cancel.mockResolvedValue(undefined); });
it("reads the fixed native endpoint without returning the private credential", async () => {
  plugin.getService.mockResolvedValue({ url: 'https://updates.example.test/latest.json', managed: true, token: 'must-not-cross' });
  expect(await configuredService()).toEqual({ url: 'https://updates.example.test/latest.json', managed: true });
  plugin.getService.mockResolvedValue({ url: 'http://unsafe.test/latest.json', managed:true });
  await expect(configuredService()).rejects.toThrow('HTTPS');
});
it("does not start native download when cancelled while the progress listener is being registered", async () => {
  let registered!: (listener: { remove: () => Promise<void> }) => void;
  const remove = vi.fn(async () => {});
  plugin.addListener.mockImplementation(() => new Promise(resolve => { registered = resolve; }));
  const backend = updateBackend();
  const operation = backend.download(manifest, "pending-listener", () => {});
  const result = expect(operation).rejects.toThrow("已取消");
  await backend.cancel("pending-listener");
  registered({ remove }); await result;
  expect(plugin.download).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledTimes(1);
});
it("filters another operation's progress and removes its listener even after native failure", async () => {
  const remove = vi.fn(async () => {}), progress = vi.fn();
  plugin.addListener.mockImplementation(async (_name, callback) => {
    callback({ operationId: "old", received: 90, total: 100 });
    callback({ operationId: "active", received: 30, total: 100 });
    return { remove };
  });
  plugin.download.mockRejectedValue(new Error("network failed"));
  await expect(updateBackend().download(manifest, "active", progress)).rejects.toThrow("network failed");
  expect(progress.mock.calls).toEqual([[30]]);
  expect(remove).toHaveBeenCalledTimes(1);
});
