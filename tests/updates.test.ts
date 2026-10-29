import { describe, expect, it, vi } from "vitest";
import {
  APP_ID,
  MAX_APK_BYTES,
  automaticCheckDue,
  httpsAddress,
  parseUpdateManifest,
  updateDecision,
  type UpdateBackend,
  type UpdateManifest,
} from "../src/updates";
import { UpdateController } from "../src/updateController";
const source = "https://updates.example.test/releases/latest.json";
const manifest: UpdateManifest = {
  format: "zhizhan-update",
  schemaVersion: 1,
  appId: APP_ID,
  version: "2.0.0",
  versionCode: 100,
  minSdk: 26,
  publishedAt: "2026-10-07T12:00:00Z",
  notes: ["改进课程"],
  apk: { url: "./app.apk", bytes: 1024, sha256: "a".repeat(64) },
};
const info = { appId: APP_ID, version: "1.2.0", versionCode: 4, sdk: 36 };
const serialize = (changes = {}) => JSON.stringify({ ...manifest, ...changes });
describe("update manifest and schedule", () => {
  it("retries failed automatic checks after five minutes without hammering an offline server", () => {
    const last = { url: source, time: 100000000, failed: true };
    expect(automaticCheckDue(last, source, last.time + 299999)).toBe(false);
    expect(automaticCheckDue(last, source, last.time + 300000)).toBe(true);
  });
  it("resolves a relocatable release folder and compares versionCode, not version text", () => {
    const parsed = parseUpdateManifest(serialize({ version: "0.1" }), source);
    expect(parsed.apk.url).toBe(
      "https://updates.example.test/releases/app.apk",
    );
    expect(updateDecision(parsed, info)).toBe("available");
    expect(updateDecision({ ...parsed, versionCode: 4 }, info)).toBe("current");
    expect(updateDecision({ ...parsed, versionCode: 3 }, info)).toBe("current");
  });
  it.each([
    "http://example.test/latest.json",
    "file:///tmp/app",
    "https://user:password@example.test/latest.json",
    "https://example.test/x#fragment",
    "https://example.test:0/x",
    "",
  ])("rejects an unsafe or unusable endpoint: %s", (url) => {
    expect(() => httpsAddress(url)).toThrow();
  });
  it("rejects wrong identities, schemas, fractional codes, bad hashes and oversized files", () => {
    for (const changes of [
      { appId: "other.app" },
      { schemaVersion: 2 },
      { versionCode: 4.5 },
      { versionCode: "5" },
      { apk: { ...manifest.apk, bytes: MAX_APK_BYTES + 1 } },
      { apk: { ...manifest.apk, sha256: "missing" } },
      { apk: { ...manifest.apk, url: "http://example.test/app.apk" } },
      { notes: ["x".repeat(501)] },
      { publishedAt: "no date" },
    ])
      expect(() => parseUpdateManifest(serialize(changes), source)).toThrow();
    expect(() => parseUpdateManifest(" ".repeat(65537), source)).toThrow(
      "64 KiB",
    );
    expect(() => parseUpdateManifest("<html>error</html>", source)).toThrow(
      "JSON",
    );
  });
  it("reports SDK incompatibility and never offers downgrades", () => {
    expect(updateDecision({ ...manifest, minSdk: 37 }, info)).toBe(
      "incompatible",
    );
    expect(
      updateDecision({ ...manifest, versionCode: 3, minSdk: 37 }, info),
    ).toBe("current");
  });
  it("throttles attempts for a day, recovers from clock rollback and resets on endpoint change", () => {
    const last = { url: source, time: 100000000 };
    expect(automaticCheckDue(last, source, last.time + 86399999)).toBe(false);
    expect(automaticCheckDue(last, source, last.time + 86400000)).toBe(true);
    expect(automaticCheckDue(last, source, last.time - 1)).toBe(true);
    expect(
      automaticCheckDue(last, "https://new.example.test/feed", last.time),
    ).toBe(true);
    expect(automaticCheckDue(undefined, source)).toBe(true);
  });
});
function backend(): UpdateBackend {
  return {
    canInstall: true,
    getInfo: vi.fn(async () => info),
    check: vi.fn(async () => ({ text: serialize(), url: source })),
    download: vi.fn(async (_manifest, _id, progress) => {
      progress(512);
      progress(1024);
      return { verified: true };
    }),
    install: vi.fn(async () => ({ launched: true })),
    cancel: vi.fn(async () => {}),
  };
}
describe("update operation ownership", () => {
  it("requires verification before installation and does not claim system handoff is success", async () => {
    const api = backend(),
      controller = new UpdateController(api);
    await controller.install();
    expect(api.install).not.toHaveBeenCalled();
    await controller.check(source);
    await controller.download();
    expect(controller.state).toMatchObject({
      phase: "ready",
      verified: true,
      received: 1024,
    });
    await controller.install();
    expect(controller.state.phase).toBe("handed_off");
    expect(controller.state.message).not.toContain("安装成功");
  });
  it("returns from permission settings and requires an explicit second install action", async () => {
    const api = backend(),
      controller = new UpdateController(api);
    api.install = vi
      .fn()
      .mockResolvedValueOnce({ needsPermission: true })
      .mockResolvedValueOnce({ launched: true });
    await controller.check(source);
    await controller.download();
    await controller.install();
    expect(controller.state.phase).toBe("permission");
    expect(api.install).toHaveBeenCalledTimes(1);
    await controller.install();
    expect(controller.state.phase).toBe("handed_off");
  });
  it("keeps an invalid download non-installable and allows retry", async () => {
    const api = backend(),
      controller = new UpdateController(api);
    api.download = vi
      .fn()
      .mockRejectedValueOnce(new Error("校验失败"))
      .mockResolvedValueOnce({ verified: true });
    await controller.check(source);
    await controller.download();
    expect(controller.state).toMatchObject({ phase: "error", verified: false });
    await controller.install();
    expect(api.install).not.toHaveBeenCalled();
    await controller.download();
    expect(controller.state.phase).toBe("ready");
  });
  it("ignores late progress and successful completion after cancellation", async () => {
    let complete!: (result: { verified: boolean }) => void,
      progress!: (n: number) => void;
    const api = backend(),
      controller = new UpdateController(api);
    api.download = vi.fn((_m, _id, onProgress) => {
      progress = onProgress;
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    api.cancel = vi.fn(async () => {
      progress(1024);
      complete({ verified: true });
    });
    await controller.check(source);
    const downloading = controller.download();
    await controller.cancel();
    await downloading;
    expect(controller.state).toMatchObject({
      phase: "cancelled",
      verified: false,
      received: 0,
    });
    await controller.install();
    expect(api.install).not.toHaveBeenCalled();
  });
  it("does not start network work if cancelled while obtaining native version information", async () => {
    let finish!: (value: typeof info) => void;
    const api = backend(),
      controller = new UpdateController(api);
    api.getInfo = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const checking = controller.check(source),
      cancellation = controller.cancel();
    finish(info);
    await checking;
    await cancellation;
    expect(api.check).not.toHaveBeenCalled();
    expect(controller.state.phase).toBe("cancelled");
  });
  it("serializes double clicks and does not download an incompatible release", async () => {
    const api = backend(),
      controller = new UpdateController(api);
    api.check = vi.fn(async () => ({
      text: serialize({ minSdk: 37 }),
      url: source,
    }));
    await Promise.all([controller.check(source), controller.check(source)]);
    expect(api.check).toHaveBeenCalledTimes(1);
    await controller.download();
    expect(api.download).not.toHaveBeenCalled();
  });
  it("reports a failed check without exposing a stale candidate", async () => {
    const api = backend(),
      controller = new UpdateController(api);
    await controller.check(source);
    api.check = vi.fn(async () => {
      throw new Error("服务器不可用");
    });
    await controller.check(source);
    expect(controller.state).toMatchObject({
      phase: "error",
      manifest: undefined,
      verified: false,
    });
  });
});
