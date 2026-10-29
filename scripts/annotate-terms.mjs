import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";

export const aliases = {
  资源所有权: "ownership",
  所有权: "ownership",
  owner: "ownership",
  epoch: "epoch",
  generation: "epoch",
  PCM16: "pcm",
  DMA: "dma",
  PSRAM: "psram",
  背压: "backpressure",
  ACK: "ack",
  幂等: "idempotency",
  CRC32: "crc",
  "SHA-256": "sha",
  "I²S": "i2s",
  "I²C": "i2c",
  VAD: "vad",
  preroll: "preroll",
  AEC: "aec",
  抖动缓冲: "jitter",
  NVS: "nvs",
  事务: "transaction",
  OTA: "ota",
  SOC: "soc",
  FreeRTOS: "rtos",
  "RX barrier": "barrier",
  TLS: "tls",
  Q1000: "qformat",
};

// Annotate a concept once per chapter. Keep code, headings, existing links and
// diagram definitions unchanged; use source offsets to preserve author layout.
export function annotateTerms(body) {
  const tree = fromMarkdown(body, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const seen = new Set();
  function findExisting(node) {
    if (node.type === "link" && node.url?.startsWith("term:"))
      seen.add(node.url.slice(5));
    node.children?.forEach(findExisting);
  }
  findExisting(tree);
  const patches = [];
  const words = Object.keys(aliases).sort((a, b) => b.length - a.length);
  const escaped = words.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const rx = new RegExp(escaped.join("|"), "g");
  function visit(node, blocked = false) {
    const skip =
      blocked ||
      [
        "link",
        "image",
        "definition",
        "heading",
        "code",
        "inlineCode",
        "html",
      ].includes(node.type);
    if (!skip && node.type === "text" && node.position) {
      const start = node.position.start.offset,
        end = node.position.end.offset;
      const raw = body.slice(start, end);
      for (const match of raw.matchAll(rx)) {
        const term = aliases[match[0]],
          at = match.index;
        // Avoid partial English identifiers, e.g. OTA_BOOT or ownershipCounter.
        if (
          /^[A-Za-z]/.test(match[0]) &&
          (/[A-Za-z0-9_]/.test(raw[at - 1] || "") ||
            /[A-Za-z0-9_]/.test(raw[at + match[0].length] || ""))
        )
          continue;
        if (seen.has(term)) continue;
        seen.add(term);
        patches.push({
          start: start + at,
          end: start + at + match[0].length,
          text: `[${match[0]}](term:${term})`,
        });
      }
    }
    if (node.children) node.children.forEach((child) => visit(child, skip));
  }
  visit(tree);
  for (const p of patches.reverse())
    body = body.slice(0, p.start) + p.text + body.slice(p.end);
  return body;
}
