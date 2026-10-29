import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import type { Root, RootContent } from "mdast";
import { parseCourseBlock } from "./courseBlocks";

/** Rewrite actual Markdown destinations, leaving prose and code examples intact. */
export function rewriteLinks(body: string, change: (url: string) => string) {
  const tree = fromMarkdown(body, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const patches: { start: number; end: number; value: string }[] = [];
  function transform(node: RootContent): boolean {
    let changed = false;
    if (
      node.type === "link" ||
      node.type === "image" ||
      node.type === "definition"
    ) {
      const next = change(node.url);
      changed = next !== node.url;
      node.url = next;
    }
    if ("children" in node)
      for (const child of node.children) changed = transform(child) || changed;
    return changed;
  }
  function visit(node: Root | RootContent) {
    if (node.type === "code" && node.lang) {
      const block = parseCourseBlock(node.lang, node.value);
      if (block && block.kind !== "assessment") {
        const original = JSON.stringify(block);
        if (block.kind === "details") block.body = rewriteLinks(block.body, change);
        else for (const row of block.rows) for (const cell of row) cell.body = rewriteLinks(cell.body, change);
        if (JSON.stringify(block) !== original && node.position) {
          const { kind: _kind, ...value } = block;
          node.value = JSON.stringify(value);
          patches.push({ start: node.position.start.offset!, end: node.position.end.offset!,
            value: toMarkdown({ type: "root", children: [node] }, { extensions: [gfmToMarkdown()] }).trimEnd() });
        }
      }
    }
    if (
      node.type === "link" ||
      node.type === "image" ||
      node.type === "definition"
    ) {
      if (transform(node) && node.position) {
        patches.push({
          start: node.position.start.offset!,
          end: node.position.end.offset!,
          value: toMarkdown(
            { type: "root", children: [node] },
            { extensions: [gfmToMarkdown()] },
          ).trimEnd(),
        });
      }
    } else if ("children" in node) node.children.forEach(visit);
  }
  visit(tree);
  for (const patch of patches.sort((a, b) => b.start - a.start))
    body = body.slice(0, patch.start) + patch.value + body.slice(patch.end);
  return body;
}

export function internalLinks(body: string) {
  const links: { kind: "doc" | "asset"; id: string }[] = [];
  rewriteLinks(body, (url) => {
    const match = /^(doc|asset):([a-zA-Z0-9_-]+)(?:#.*)?$/.exec(url);
    if (match) links.push({ kind: match[1] as "doc" | "asset", id: match[2] });
    return url;
  });
  return links;
}

export function copyTitle(title: string, suffix: string) {
  return title.slice(0, 300 - suffix.length) + suffix;
}
