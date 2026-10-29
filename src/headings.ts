export function headingSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, "")
    .replace(/\s/g, "-");
}
export function scrollToHeading(root: HTMLElement | null, fragment: string) {
  let name = fragment.replace(/^#/, "");
  try {
    name = decodeURIComponent(name);
  } catch {
    /* Match the literal text if malformed. */
  }
  const target = Array.from(
    root?.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,[data-source-anchor]",
    ) || [],
  ).find(
    (el) =>
      el.id === name ||
      el.dataset.anchor === name ||
      el.dataset.sourceAnchor === name ||
      el.textContent === name,
  );
  let parent = target?.parentElement;
  while (parent && parent !== root) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  target?.scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
  return !!target;
}
