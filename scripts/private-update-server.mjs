import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

// Only the manifest and its verified APK are served. Never point a generic file server at the project.
export async function createReleaseServer(directory, { token = "" } = {}) {
  if (token && !/^[A-Za-z0-9_-]{43,128}$/.test(token))
    throw Error("Invalid access credential");
  const expected = Buffer.from(`Bearer ${token}`);
  const root = await fs.realpath(directory);
  const manifestPath = await fs.realpath(path.join(root, "latest.json"));
  if (path.dirname(manifestPath) !== root)
    throw Error("Manifest must be inside the release directory");
  const manifest = await fs.readFile(manifestPath);
  if (manifest.length > 65536) throw Error("Manifest exceeds 64 KiB");
  const feed = JSON.parse(manifest.toString("utf8"));
  if (
    feed.format !== "zhizhan-update" ||
    feed.schemaVersion !== 1 ||
    feed.appId !== "app.zhizhan.local" ||
    !Number.isInteger(feed.versionCode) ||
    feed.versionCode < 1 ||
    typeof feed.version !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/.test(feed.version)
  )
    throw Error("Invalid release identity");
  if (
    !/^\.\/zhizhan-[0-9A-Za-z.+_-]+-android\.apk$/.test(feed.apk?.url || "") ||
    !Number.isInteger(feed.apk.bytes) ||
    feed.apk.bytes <= 0 ||
    feed.apk.bytes > 128 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/i.test(feed.apk.sha256 || "")
  )
    throw Error("Invalid release APK metadata");
  const filename = feed.apk.url.slice(2),
    apkPath = await fs.realpath(path.join(root, filename));
  if (path.dirname(apkPath) !== root)
    throw Error("APK must be inside the release directory");
  if ((await fs.stat(apkPath)).size !== feed.apk.bytes)
    throw Error("APK length does not match manifest");
  const apk = await fs.readFile(apkPath);
  if (
    createHash("sha256").update(apk).digest("hex") !==
    feed.apk.sha256.toLowerCase()
  )
    throw Error("APK digest does not match manifest");
  // Hold an immutable, verified snapshot so an in-flight download cannot mix two releases.
  const server = http.createServer({ maxHeaderSize: 8192 }, (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (token && pathname !== "/__zhizhan_release_health") {
      const supplied = Buffer.from(req.headers.authorization || "");
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        res.writeHead(401, {
          "WWW-Authenticate": "Bearer",
          "Content-Length": 0,
        });
        res.end();
        return;
      }
    }
    let data, type;
    if (pathname === "/latest.json") {
      data = manifest;
      type = "application/json; charset=utf-8";
    } else if (pathname === "/" + filename) {
      data = apk;
      type = "application/vnd.android.package-archive";
    } else if (pathname === "/__zhizhan_release_health") {
      data = Buffer.from(
        JSON.stringify({
          service: "zhizhan-private-updates",
          version: feed.version,
          versionCode: feed.versionCode,
          authenticated: !!token,
        }),
      );
      type = "application/json";
    } else {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(req.method === "HEAD" ? undefined : data);
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.setTimeout(120000, (socket) => socket.destroy());
  return server;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = process.argv[2];
  if (!directory)
    throw Error(
      "Usage: node scripts/private-update-server.mjs RELEASE_DIRECTORY",
    );
  let profile = {};
  const profilePath = process.argv[3];
  if (profilePath)
    profile = JSON.parse(
      (await fs.readFile(profilePath, "utf8")).replace(/^\uFEFF/, ""),
    );
  const server = await createReleaseServer(directory, {
    token: profile.token || "",
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(8463, "127.0.0.1", () =>
    console.log(
      `Update backend ready on loopback :8463; authenticated=${!!profile.token}`,
    ),
  );
}
