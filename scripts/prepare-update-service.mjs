// Provision on the publisher PC. Credentials never enter logs, Web assets, or source ZIPs.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
if (!input) throw Error("Provide the real stable HTTPS latest.json URL");
const url = new URL(input);
if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
    url.pathname !== "/latest.json" || url.port === "0") throw Error("Invalid HTTPS release endpoint");
const file = path.join(root, ".private/update-service.json");
await fs.mkdir(path.dirname(file), { recursive: true });
let previous;
try { previous = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (previous?.url && previous.url !== url.href) throw Error("Endpoint already provisioned; review migration before changing it");
if (previous?.token && !/^[A-Za-z0-9_-]{43,128}$/.test(previous.token)) throw Error("Invalid existing access credential");
const profile = { url: url.href, token: previous?.token || randomBytes(32).toString("base64url") };
await fs.writeFile(file, JSON.stringify(profile, null, 2), { mode: 0o600 });
console.log(`Publisher profile ready: ${url.href}; credential kept private`);
