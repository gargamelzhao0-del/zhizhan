import { ReaderMedia } from "./ReaderMedia";
import { useId, useMemo } from "react";
import DOMPurify from "dompurify";

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
  return svg ? (
    <figure className="textbook-figure">
      <ReaderMedia kind="figure">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </ReaderMedia>
    </figure>
  ) : (
    <p className="muted">图解格式不受支持。</p>
  );
}
