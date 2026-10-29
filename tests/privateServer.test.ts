import { afterEach, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
// @ts-expect-error Standalone Node server intentionally ships as plain JavaScript.
import { createReleaseServer } from "../scripts/private-update-server.mjs";
const roots: string[] = [], servers: Server[] = [];
async function fixture(change: (feed: any) => void = () => {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhizhan-update-test-")); roots.push(root);
  const apk = Buffer.from("test artifact, not an installable APK");
  const feed = { format: "zhizhan-update", schemaVersion: 1, appId: "app.zhizhan.local", version: "1.3.0", versionCode: 5,
    apk: { url: "./zhizhan-1.3.0-android.apk", bytes: apk.length, sha256: createHash("sha256").update(apk).digest("hex") } };
  await fs.writeFile(path.join(root, feed.apk.url.slice(2)), apk);
  change(feed); await fs.writeFile(path.join(root, "latest.json"), JSON.stringify(feed));
  await fs.writeFile(path.join(root, "secret.txt"), "not served");
  return { root, feed, apk };
}
async function serve(root: string, token = "") {
  const server = await createReleaseServer(root, { token }); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "zhizhan-update-test-")) throw Error("Unexpected test directory");
    await fs.rm(root, { recursive: true, force: true });
  }
});
it("authenticated releases deny anonymous, wrong and query-string credentials before serving files", async () => {
  const { root, apk, feed } = await fixture(), token = "a".repeat(43), url = await serve(root, token);
  for (const endpoint of ["/latest.json", feed.apk.url.slice(1)]) {
    expect((await fetch(url + endpoint)).status).toBe(401);
    expect((await fetch(url + endpoint + "?token=" + token)).status).toBe(401);
    expect((await fetch(url + endpoint, { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
  }
  const headers = { Authorization: `Bearer ${token}` };
  expect(await (await fetch(url + "/latest.json", { headers })).json()).toEqual(feed);
  expect(Buffer.from(await (await fetch(url + feed.apk.url.slice(1), { headers })).arrayBuffer())).toEqual(apk);
  const health = await (await fetch(url + "/__zhizhan_release_health")).text();
  expect(health).toContain('"authenticated":true'); expect(health).not.toContain(token);
});
it("serves exact verified bytes with CORS, identity encoding, HEAD and fresh manifest headers", async () => {
  const { root, apk, feed } = await fixture(), url = await serve(root);
  const response = await fetch(url + "/latest.json");
  expect(await response.json()).toEqual(feed); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  const data = await fetch(url + feed.apk.url.slice(1)); expect(Buffer.from(await data.arrayBuffer())).toEqual(apk);
  expect(data.headers.get("content-encoding")).toBeNull();
  const head = await fetch(url + feed.apk.url.slice(1), { method: "HEAD" });
  expect(head.headers.get("content-length")).toBe(String(apk.length)); expect(await head.text()).toBe("");
});
it("does not expose other files, directories or mutation endpoints", async () => {
  const { root } = await fixture(), url = await serve(root);
  for (const target of ["/", "/secret.txt", "/.private/signing.properties", "/..%2fsecret.txt", "/%5csecret.txt"])
    expect((await fetch(url + target)).status).toBe(404);
  expect((await fetch(url + "/latest.json", { method: "POST", body: "replace" })).status).toBe(405);
});
it("refuses altered artifact bytes before opening a listener", async () => {
  const { root, feed } = await fixture(); await fs.writeFile(path.join(root, feed.apk.url.slice(2)), Buffer.alloc(feed.apk.bytes));
  await expect(createReleaseServer(root)).rejects.toThrow("digest");
});
it("refuses an outside path or wrong application identity", async () => {
  for (const change of [(feed: any) => { feed.apk.url = "../private.apk"; }, (feed: any) => { feed.appId = "other.app"; }]) {
    const { root } = await fixture(change); await expect(createReleaseServer(root)).rejects.toThrow();
  }
});
it("keeps each served release immutable if files on disk change", async () => {
  const { root, apk, feed } = await fixture(), url = await serve(root);
  await fs.writeFile(path.join(root, feed.apk.url.slice(2)), "new contents");
  await fs.writeFile(path.join(root, "latest.json"), "broken");
  expect(await (await fetch(url + "/latest.json")).json()).toEqual(feed);
  expect(Buffer.from(await (await fetch(url + feed.apk.url.slice(1))).arrayBuffer())).toEqual(apk);
});
