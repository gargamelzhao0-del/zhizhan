// Generate a relocatable feed from an already built APK. No deployment or hosting is performed.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (relative) =>
  JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));
const metadata = await read("package.json"),
  notes = await read("content/release-notes.json");
const apkMetadata = (
  await read("android/app/build/outputs/apk/release/output-metadata.json")
).elements[0];
if (
  notes.version !== metadata.version ||
  apkMetadata.versionName !== metadata.version ||
  apkMetadata.versionCode !== metadata.androidVersionCode
)
  throw new Error("Release notes, APK and package version must match");
if (
  !Array.isArray(notes.notes) ||
  notes.notes.length > 20 ||
  notes.notes.some(
    (n) => typeof n !== "string" || !n.trim() || n.length > 500,
  ) ||
  !Number.isFinite(Date.parse(notes.publishedAt))
)
  throw new Error("Invalid release notes");
const name = `zhizhan-${metadata.version}-android.apk`;
const bytes = await fs.readFile(path.join(root, "release", name));
if (bytes.length > 128 * 1024 * 1024 || !bytes.length)
  throw new Error("APK size outside updater limits");
const feed = {
  format: "zhizhan-update",
  schemaVersion: 1,
  appId: "app.zhizhan.local",
  version: metadata.version,
  versionCode: metadata.androidVersionCode,
  minSdk: 26,
  publishedAt: notes.publishedAt,
  notes: notes.notes,
  apk: {
    url: `./${name}`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
};
// Version-specific directory prevents older APKs from accumulating in new feed packages.
const directory = path.join(
  root,
  "release",
  `zhizhan-${metadata.version}-update-feed`,
);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, name), bytes);
await fs.writeFile(
  path.join(directory, "latest.json"),
  JSON.stringify(feed, null, 2) + "\n",
);
await fs.copyFile(
  path.join(root, "docs/更新功能与发布指南.md"),
  path.join(directory, "发布说明.md"),
);
await fs.copyFile(path.join(root, "docs/本机私人更新服务器.md"), path.join(directory, "本机私人更新服务器.md"));
console.log(
  JSON.stringify({
    directory,
    manifest: "latest.json",
    apk: name,
    bytes: bytes.length,
    sha256: feed.apk.sha256,
    published: false,
  }),
);
