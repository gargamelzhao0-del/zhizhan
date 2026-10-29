import { createHash } from "node:crypto";

// Validate the manifest consumed by the App, its import report, and actual bytes.
export async function verifySeedIntegrity(catalog, source, readAsset) {
  const issues = [];
  const unique = (rows, label) => {
    const ids = new Set();
    for (const row of rows) {
      if (ids.has(row.id)) issues.push(`Duplicate ${label} ID: ${row.id}`);
      ids.add(row.id);
    }
    return ids;
  };
  unique(catalog.articles, "article");
  const assetIds = unique(catalog.attachments, "attachment");
  unique(source.assets, "import asset");
  const reported = new Map(source.assets.map((a) => [a.id, a]));
  for (const ref of catalog.attachments) {
    const route = /^assets\/(source|lesson)-[a-f0-9]{24}-([a-f0-9]{16})\.bin$/.exec(ref.path);
    if (!route) {
      issues.push(`Android asset route is unsafe: ${ref.path}`);
      continue;
    }
    const row = reported.get(ref.id);
    if (!row) issues.push(`Missing import record: ${ref.id}`);
    else {
      for (const field of ["path", "sha256", "name", "mime"])
        if (row[field] !== ref[field])
          issues.push(`Catalog/report ${field} mismatch: ${ref.id}`);
    }
    try {
      const bytes = await readAsset(ref.path);
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== ref.sha256) issues.push(`Catalog hash mismatch: ${ref.id}`);
      if (digest.slice(0, 16) !== route[2]) issues.push(`Asset filename hash mismatch: ${ref.id}`);
      if (row && row.bytes !== bytes.byteLength) issues.push(`Import byte length mismatch: ${ref.id}`);
    } catch {
      issues.push(`Missing or unreadable asset: ${ref.path}`);
    }
  }
  for (const row of source.assets)
    if (!assetIds.has(row.id)) issues.push(`Import asset absent from catalog: ${row.id}`);
  return issues;
}

// Explicit reading dependencies catch examples mentioned only in code blocks.
export const handbookReadingRequirements = {
  "handbook-00": [
    "docs/工程开发学习手册/evidence/source-manifest.json",
    "docs/工程开发学习手册/evidence/config-snapshot.json",
  ],
  "handbook-11": [
    "main/conversation/head_touch_control.c",
    "main/conversation/head_touch_control_policy.c",
    "main/conversation/sleep_transaction.h",
    "main/conversation/notification_playback.h",
    "main/conversation/notification_playback.c",
  ],
  "handbook-15": ["main/offline_replay_pressure.inc"],
  "handbook-19": ["main/nuwax_ota_new/nuwax_ota_power_policy.h"],
  "handbook-23": [
    "docs/工程开发学习手册/examples/audio_budget.py",
    "docs/工程开发学习手册/examples/inspect_na_frame.py",
    "docs/工程开发学习手册/examples/owner_epoch.py",
    "docs/工程开发学习手册/examples/frame_roundtrip.py",
  ],
  "handbook-30": ["docs/工程开发学习手册/examples/frame_roundtrip.py"],
};

export function verifyHandbookReading(catalog, source) {
  const issues = [];
  const articles = new Map(catalog.articles.map((a) => [a.id, a]));
  const assets = new Map(source.assets.map((a) => [a.source, a]));
  for (const [id, paths] of Object.entries(handbookReadingRequirements)) {
    const links = new Set([...((articles.get(id)?.body || "").matchAll(/\]\(asset:([\w-]+)\)/g))].map((m) => m[1]));
    for (const file of paths) {
      const ref = assets.get(file);
      if (!ref || !links.has(ref.id)) issues.push(`${id}: missing readable attachment ${file}`);
    }
  }
  return issues;
}
