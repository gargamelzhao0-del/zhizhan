export type ReadingPosition = {
  block: number;
  signature: string;
  fraction: number;
};
const blocks = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(".prose > *"));
const signature = (element: HTMLElement) =>
  (element.textContent || "").replace(/\s+/g, " ").slice(0, 180);
export function captureReadingPosition(
  root: HTMLElement,
): ReadingPosition | null {
  const items = blocks(root);
  let index = items.findIndex((el) => el.getBoundingClientRect().bottom > 80);
  if (index < 0) index = items.length - 1;
  const el = items[index];
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    block: index,
    signature: signature(el),
    fraction: Math.max(
      0,
      Math.min(1, (80 - rect.top) / Math.max(1, rect.height)),
    ),
  };
}
export function restoreReadingPosition(root: HTMLElement, saved: unknown) {
  if (!saved || typeof saved !== "object") return false;
  const value = saved as ReadingPosition;
  if (
    !Number.isInteger(value.block) ||
    !Number.isFinite(value.fraction) ||
    typeof value.signature !== "string"
  )
    return false;
  const items = blocks(root);
  // A content update may insert paragraphs: relocate by text rather than stale height.
  const candidate = items[value.block];
  const el =
    candidate && signature(candidate) === value.signature
      ? candidate
      : items.find((item) => signature(item) === value.signature);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  window.scrollTo({
    top:
      window.scrollY +
      rect.top +
      Math.max(0, Math.min(1, value.fraction)) * rect.height -
      80,
    behavior: "instant",
  });
  return true;
}
