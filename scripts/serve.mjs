import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  fs.readFileSync(path.join(base, "package.json"), "utf8"),
);
const root = path.join(base, "dist");
const port = 8462,
  host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.headers.host !== `${host}:${port}`) {
    res.writeHead(403);
    res.end("Use http://127.0.0.1:8462");
    return;
  }
  let relative;
  try {
    relative = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (relative === "/__zhizhan_health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ app: "zhizhan", version }));
    return;
  }
  const target = path.resolve(
    root,
    `.${relative === "/" ? "/index.html" : relative}`,
  );
  if (!target.startsWith(root + path.sep) || relative.includes("\\")) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": relative.startsWith('/original-library/') ? "SAMEORIGIN" : "DENY",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(target).pipe(res);
  });
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    http
      .get(`http://${host}:${port}/__zhizhan_health`, (r) => {
        let body = "";
        r.on("data", (c) => (body += c));
        r.on("end", () => {
          if (body.includes('"app":"zhizhan"')) {
            open();
            process.exit(0);
          } else {
            console.error("Port 8462 is in use by another application.");
            process.exit(1);
          }
        });
      })
      .on("error", () => process.exit(1));
  } else {
    console.error(e);
    process.exit(1);
  }
});
function open() {
  if (process.argv.includes("--no-open")) return;
  if (process.platform === "win32")
    spawn(
      "rundll32",
      ["url.dll,FileProtocolHandler", `http://${host}:${port}`],
      { detached: true, stdio: "ignore", windowsHide: true },
    ).unref();
}
server.listen(port, host, () => {
  console.log(
    `Zhizhan ${version}: http://${host}:${port}\nKeep this process running. Data stays in this browser profile; export backups regularly.`,
  );
  open();
});
