import { ReaderMedia } from "./ReaderMedia";
import { useId, useMemo } from "react";
import DOMPurify from "dompurify";

export interface PipelineStep {
  title: string;
  subtitle?: string;
  tone: "default" | "grn" | "amb" | "cyn" | "red" | "vio";
}

function getAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : "";
}

function stripXmlTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts structured step cards from horizontal single-row pipeline SVGs
 * (e.g. viewBox="0 0 800 132" / "0 0 660 150") so mobile readers can read
 * every box at crisp native font size without pinching or squinting.
 */
export function extractPipelineSteps(svgMarkup: string): PipelineStep[] {
  if (!svgMarkup) return [];
  try {
    const cleanSvg = svgMarkup.replace(/<defs[\s\S]*?<\/defs>/gi, "");
    const vbMatch = cleanSvg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    if (vbMatch) {
      const vb = vbMatch[1].trim().split(/[\s,]+/).map(Number);
      if (vb.length === 4 && (vb[2] < 500 || vb[3] > 220)) return [];
    }

    const rectTags = [...cleanSvg.matchAll(/<rect\b[^>]*>/gi)].map((m) => m[0]);
    const rects = rectTags
      .map((tag) => ({
        tag,
        x: Number(getAttr(tag, "x") || 0),
        y: Number(getAttr(tag, "y") || 0),
        w: Number(getAttr(tag, "width") || 0),
        h: Number(getAttr(tag, "height") || 0),
      }))
      .filter((r) => r.w >= 85 && r.w <= 260 && r.h >= 32 && r.h <= 95);

    if (rects.length < 3 || rects.length > 6) return [];
    const ys = rects.map((r) => r.y);
    if (Math.max(...ys) - Math.min(...ys) > 24) return [];

    const sortedRects = [...rects].sort((a, b) => a.x - b.x);
    const texts = [
      ...cleanSvg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi),
    ]
      .map((m) => ({
        x: Number(getAttr(m[0], "x") || 0),
        y: Number(getAttr(m[0], "y") || 0),
        content: stripXmlTags(m[2]),
      }))
      .filter((t) => t.content.length > 0);

    const steps: PipelineStep[] = [];
    for (const r of sortedRects) {
      const inside = texts
        .filter(
          (t) =>
            t.x >= r.x - 8 &&
            t.x <= r.x + r.w + 8 &&
            t.y >= r.y - 8 &&
            t.y <= r.y + r.h + 16,
        )
        .sort((a, b) => a.y - b.y)
        .map((t) => t.content);

      if (!inside.length) return [];
      const attrBlob = `${getAttr(r.tag, "class")} ${getAttr(r.tag, "fill")} ${getAttr(r.tag, "stroke")}`;
      const tone: PipelineStep["tone"] =
        attrBlob.includes("grn") || attrBlob.includes("primary")
          ? "grn"
          : attrBlob.includes("amb")
            ? "amb"
            : attrBlob.includes("cyn")
              ? "cyn"
              : attrBlob.includes("red")
                ? "red"
                : attrBlob.includes("vio")
                  ? "vio"
                  : "default";
      steps.push({
        title: inside[0],
        subtitle: inside.slice(1).join(" · ") || undefined,
        tone,
      });
    }
    return steps;
  } catch {
    return [];
  }
}

export function safeTextbookSvg(source: string, prefix: string) {
  if (source.length > 250000) return "";
  const clean = DOMPurify.sanitize(source, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { svg: true },
    FORBID_TAGS: [
      "foreignObject",
      "script",
      "style",
      "image",
      "use",
      "a",
      "animate",
      "animateMotion",
      "animateTransform",
      "set",
    ],
    FORBID_ATTR: ["href", "xlink:href"],
  });
  // HTML course SVG may contain &nbsp;. Keep the sanitized DOM instead of
  // reparsing an HTML serialization as XML (where that entity is undefined).
  const svg = clean.querySelector("svg");
  if (!svg) return "";
  const doc = svg.ownerDocument;
  const elements = [svg, ...svg.querySelectorAll("*")];
  for (const el of elements) {
    for (const a of [...el.attributes]) {
      if (a.name === "id") el.setAttribute("id", prefix + a.value);
      else if (a.name === "aria-labelledby" || a.name === "aria-describedby")
        el.setAttribute(
          a.name,
          a.value
            .split(/\s+/)
            .map((id) => prefix + id)
            .join(" "),
        );
      else if (/url\s*\(/i.test(a.value)) {
        // Permit local marker/clip references only; no CSS network requests.
        const stripped = a.value.replace(/url\(#[\w-]+\)/g, "");
        if (/url\s*\(/i.test(stripped)) el.removeAttribute(a.name);
        else
          el.setAttribute(
            a.name,
            a.value.replace(/url\(#([\w-]+)\)/g, `url(#${prefix}$1)`),
          );
      }
    }
  }
  // Some source diagrams refer to shared arrows through classes rather than attributes.
  const defs = doc.createElementNS("http://www.w3.org/2000/svg", "defs");
  for (const id of ["ah", "aha"]) {
    if (!elements.some((el) => el.id === prefix + id)) {
      const marker = doc.createElementNS(
        "http://www.w3.org/2000/svg",
        "marker",
      );
      Object.entries({
        id: prefix + id,
        viewBox: "0 0 10 10",
        refX: "9",
        refY: "5",
        markerWidth: "6",
        markerHeight: "6",
        orient: "auto-start-reverse",
      }).forEach(([k, v]) => marker.setAttribute(k, v));
      const arrow = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      arrow.setAttribute("fill", id === "ah" ? "var(--grn)" : "var(--amb)");
      marker.appendChild(arrow);
      defs.appendChild(marker);
    }
  }
  svg.prepend(defs);
  for (const el of svg.querySelectorAll(".sv-arrow,.sv-arrow-a"))
    el.setAttribute(
      "marker-end",
      `url(#${prefix}${el.classList.contains("sv-arrow-a") ? "aha" : "ah"})`,
    );
  svg.setAttribute("role", "img");
  if (!svg.hasAttribute("aria-label") && !svg.querySelector("title"))
    svg.setAttribute("aria-label", "课程机制图");
  return new XMLSerializer().serializeToString(svg);
}

export function TextbookFigure({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svg = useMemo(
    () => safeTextbookSvg(source, `fig-${id}-`),
    [source, id],
  );
  const steps = useMemo(() => extractPipelineSteps(svg), [svg]);
  return svg ? (
    <figure className="textbook-figure">
      <ReaderMedia kind="figure">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {steps.length > 0 && (
          <div className="figure-step-strip" aria-hidden="true">
            {steps.map((s, idx) => (
              <div key={idx} className={`figure-step-card tone-${s.tone}`}>
                <span className="figure-step-num">{String(idx + 1).padStart(2, "0")}</span>
                <div className="figure-step-copy">
                  <strong>{s.title}</strong>
                  {s.subtitle && <small>{s.subtitle}</small>}
                </div>
              </div>
            ))}
          </div>
        )}
      </ReaderMedia>
    </figure>
  ) : (
    <p className="muted">图解格式不受支持。</p>
  );
}
