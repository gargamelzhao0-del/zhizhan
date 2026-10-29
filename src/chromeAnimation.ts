// FLIP: capture the displayed geometry, commit one layout, then animate transforms.
// No animation-frame loop, intermediate layout sizes or page-image snapshots.
const mobileQuery =
  "(max-width: 760px), (max-width: 1000px) and (max-height: 500px) and (orientation: landscape)";
const selector =
  ".topbar-surface > .glass-material, .bottom-nav > .glass-material, .bottom-nav .nav-glyph, .topbar-surface .search-trigger, .bottom-nav .reading-nav-orb, .topbar-surface .mobile-brand";
type Snapshot = {
  element: HTMLElement;
  box: DOMRect;
  visible: boolean;
  radius: string;
};
let pending: Snapshot[] | null = null;
let animations: Animation[] = [];
let surfaces: HTMLElement[] = [];
let generation = 0;
let removePreference: (() => void) | undefined;

function capture(): Snapshot[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(selector),
    (element) => {
      const style = getComputedStyle(element);
      return {
        element,
        box: element.getBoundingClientRect(),
        visible:
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) > 0,
        radius: style.borderTopLeftRadius,
      };
    },
  );
}

export function cancelChromeMorph() {
  generation++;
  animations.forEach((animation) => animation.cancel());
  animations = [];
  surfaces.forEach((element) => delete element.dataset.chromeMorphing);
  surfaces = [];
  pending = null;
  removePreference?.();
  removePreference = undefined;
}

export function prepareChromeMorph() {
  if (
    pending ||
    !matchMedia(mobileQuery).matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const current = capture(); // Read in-flight visual positions BEFORE cancelling.
  cancelChromeMorph();
  pending = current;
}

export function finishChromeMorph() {
  const before = pending;
  pending = null;
  if (!before) return;
  const after = capture(); // All endpoint reads precede animation writes.
  const token = generation;
  const options = { duration: 280, easing: "cubic-bezier(.22,.8,.2,1)" };
  for (const next of after) {
    const old = before.find((item) => item.element === next.element);
    const { element, box } = next;
    if (!old || !element.animate || !next.visible || !box.width || !box.height)
      continue;
    const material = element.classList.contains("glass-material");
    if (material) {
      const x = old.box.x - box.x,
        y = old.box.y - box.y;
      const sx = old.box.width / box.width,
        sy = old.box.height / box.height;
      if (
        !sx ||
        !sy ||
        Math.abs(x) + Math.abs(y) + Math.abs(sx - 1) + Math.abs(sy - 1) < 0.01
      )
        continue;
      element.dataset.chromeMorphing = "true";
      surfaces.push(element);
      // Compensate the corner radius so a circle does not begin as a stretched ellipse.
      const radius = old.radius.includes("%")
        ? Math.min(old.box.width, old.box.height) / 2
        : parseFloat(old.radius);
      animations.push(
        element.animate(
          [
            {
              transformOrigin: "0 0",
              transform: `translate(${x}px,${y}px) scale(${sx},${sy})`,
              borderRadius: `${radius / sx}px / ${radius / sy}px`,
            },
            {
              transformOrigin: "0 0",
              transform: "translate(0,0) scale(1,1)",
              borderRadius: next.radius,
            },
          ],
          options,
        ),
      );
    } else if (old.visible) {
      const x = old.box.x + old.box.width / 2 - box.x - box.width / 2;
      const y = old.box.y + old.box.height / 2 - box.y - box.height / 2;
      if (Math.abs(x) + Math.abs(y) < 0.1) continue;
      animations.push(
        element.animate(
          [
            { transform: `translate(${x}px,${y}px)` },
            { transform: "translate(0,0)" },
          ],
          options,
        ),
      );
    } else {
      animations.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], options),
      );
    }
  }
  if (!animations.length) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const stop = () => {
    if (media.matches) cancelChromeMorph();
  };
  media.addEventListener("change", stop);
  removePreference = () => media.removeEventListener("change", stop);
  void Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(() => {
    if (token === generation) cancelChromeMorph();
  });
}
