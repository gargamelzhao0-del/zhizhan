import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { expandedChrome, nextChromeState } from "./chromeState";
import { GlassMaterial } from "./GlassMaterial";
import {
  prepareChromeMorph,
  finishChromeMorph,
  cancelChromeMorph,
} from "./chromeAnimation";

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate the current DOM without remounting it or postponing navigation/data writes. */
export function useEnterMotion(
  ref: RefObject<HTMLElement | null>,
  token: string,
  enabled = true,
) {
  const previous = useRef(token);
  useLayoutEffect(() => {
    const element = ref.current,
      media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const old = previous.current;
    previous.current = token;
    if (!enabled || !element?.animate || media.matches) return;
    const depth = (route: string) =>
      /^(article|edit)\//.test(route) ? 2 : route.startsWith("shelf/") ? 1 : 0;
    const direction =
      depth(token) === depth(old) ? 0 : depth(token) > depth(old) ? 1 : -1;
    const animations = [
      element.animate(
        [
          {
            opacity: 0.6,
            translate: direction ? `${direction * 14}px 0` : "0 6px",
          },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 230, easing: "cubic-bezier(.16,1,.3,1)" },
      ),
    ];
    // Only short, bounded entrance cues. Reading, editing and input remain immediate.
    if (
      ["home", "library", "courses", "projects", "experiences"].includes(token)
    ) {
      Array.from(
        element.querySelectorAll<HTMLElement>(
          ":scope > .continue-card, :scope > .shelf-grid > .shelf-card",
        ),
      )
        .slice(0, 5)
        .forEach((child, index) => {
          animations.push(
            child.animate(
              [
                { opacity: 0.65, translate: "0 10px" },
                { opacity: 1, translate: "0 0" },
              ],
              {
                duration: 260,
                delay: index * 24,
                easing: "cubic-bezier(.16,1,.3,1)",
                fill: "backwards",
              },
            ),
          );
        });
    }
    const stop = () => {
      if (media.matches) animations.forEach((a) => a.cancel());
    };
    media.addEventListener("change", stop);
    return () => {
      animations.forEach((a) => a.cancel());
      media.removeEventListener("change", stop);
    };
  }, [ref, token, enabled]);
}

/** A single moving selection surface; selection and keyboard focus never wait for it. */
export function SelectionGroup({
  as: Tag = "div",
  label,
  value,
  className,
  children,
  accessory,
}: {
  as?: "div" | "nav";
  label: string;
  value: string;
  className: string;
  children: ReactNode;
  accessory?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const measureSelection = useRef(() => {});
  const count = Children.count(children);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0,
      settle = 0;
    const measure = () => {
      const selected = el.querySelector<HTMLElement>(
        '[aria-pressed="true"], [aria-current="page"]',
      );
      if (!selected) {
        el.dataset.selectionReady = "false";
        return;
      }
      if (!el.offsetWidth) return;
      const box = [
        selected.offsetLeft,
        selected.offsetTop,
        selected.offsetWidth,
        selected.offsetHeight,
      ];
      ["x", "y", "width", "height"].forEach((key, index) => {
        const value = `${box[index]}px`;
        if (el.style.getPropertyValue(`--selection-${key}`) !== value)
          el.style.setProperty(`--selection-${key}`, value);
      });
      el.dataset.selectionReady = "true";
    };
    measureSelection.current = measure;
    measure();
    const size = () =>
      [
        el.offsetWidth,
        el.offsetHeight,
        ...Array.from(el.querySelectorAll("button")).flatMap((b) => [
          b.offsetWidth,
          b.offsetHeight,
        ]),
      ].join(",");
    let dimensions = size();
    const observer = new ResizeObserver(() => {
      const next = size();
      if (next !== dimensions) {
        dimensions = next;
        el.dataset.selectionResizing = "true";
        clearTimeout(settle);
        settle = window.setTimeout(() => {
          delete el.dataset.selectionResizing;
        }, 100);
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(el);
    for (const child of el.querySelectorAll("button")) observer.observe(child);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      delete el.dataset.selectionResizing;
      measureSelection.current = () => {};
    };
  }, [count]);
  useLayoutEffect(() => {
    measureSelection.current();
  }, [value]);
  return (
    <Tag
      ref={ref as RefObject<HTMLDivElement & HTMLElement>}
      role={Tag === "nav" ? undefined : "group"}
      aria-label={label}
      className={`selection-group ${className}`}
    >
      {className.split(" ").includes("bottom-nav") && <GlassMaterial />}
      <span className="selection-lens" aria-hidden="true" />
      {children}
      {accessory}
    </Tag>
  );
}

/** Keep the document geometry fixed while the floating controls compact. */
export function useChromeMotion(
  route: string,
  locked: boolean,
  editing: boolean,
  reading = false,
) {
  const [dock, setDock] = useState({ route, open: false });
  const readingDockOpen = reading && dock.route === route && dock.open;
  const focusDock = useRef(false);
  const focusOrb = useRef(false);
  useLayoutEffect(() => {
    cancelChromeMorph();
    focusDock.current = false;
    focusOrb.current = false;
    setDock((current) =>
      current.route === route ? current : { route, open: false },
    );
  }, [route]);
  useLayoutEffect(() => () => cancelChromeMorph(), []);
  const openReadingDock = (focus = false) => {
    if (!readingDockOpen) prepareChromeMorph();
    focusDock.current = focus;
    setDock({ route, open: true });
  };
  const closeReadingDock = (restoreFocus = false) => {
    if (readingDockOpen) prepareChromeMorph();
    const active = document.activeElement;
    focusOrb.current =
      restoreFocus &&
      active instanceof HTMLElement &&
      !!active.closest(".bottom-nav .nav-destination");
    setDock((current) => (current.open ? { route, open: false } : current));
  };
  const viewportBase = useRef({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useLayoutEffect(() => {
    const root = document.documentElement;
    const mobile = window.matchMedia(
      "(max-width: 760px), (max-width: 1000px) and (max-height: 500px) and (orientation: landscape)",
    );
    const viewport = window.visualViewport;
    let state = nextChromeState(
      expandedChrome(Math.max(0, scrollY)),
      scrollY,
      root.scrollHeight - innerHeight,
      locked || editing,
      reading,
    );
    let frame = 0;
    const write = (key: string, value: boolean | string) => {
      if (root.dataset[key] !== String(value))
        root.dataset[key] = String(value);
    };
    const fieldFocused = () =>
      !!document.activeElement?.matches(
        'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]',
      );
    const keyboardVisible = () =>
      mobile.matches &&
      fieldFocused() &&
      (viewport?.scale || 1) === 1 &&
      viewportBase.current.height - (viewport?.height || innerHeight) > 120;
    const chromeFocused = () =>
      document.activeElement instanceof HTMLElement &&
      !!document.activeElement.closest(".topbar, .bottom-nav") &&
      document.activeElement.matches(":focus-visible");
    const paint = () => {
      const chrome = state.compact && mobile.matches ? "compact" : "expanded";
      if (root.dataset.chrome !== chrome) prepareChromeMorph();
      write("scrolled", scrollY > 12);
      write("chrome", chrome);
      write("reading", reading && mobile.matches);
      write("keyboard", keyboardVisible());
      finishChromeMorph();
    };
    const update = () => {
      state = nextChromeState(
        state,
        scrollY,
        root.scrollHeight - innerHeight,
        locked ||
          editing ||
          !mobile.matches ||
          chromeFocused() ||
          keyboardVisible(),
        reading,
      );
      paint();
    };
    const scroll = () => {
      if (readingDockOpen && Math.abs(scrollY - state.y) >= 1)
        closeReadingDock(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const reveal = () => {
      state = reading
        ? { ...expandedChrome(Math.max(0, scrollY)), compact: true }
        : expandedChrome(Math.max(0, scrollY));
      paint();
    };
    const focus = () => {
      if (!reading && (chromeFocused() || fieldFocused())) reveal();
      scroll();
    };
    const resize = () => {
      cancelChromeMorph();
      if (
        Math.abs(viewportBase.current.width - innerWidth) > 2 ||
        !fieldFocused()
      )
        viewportBase.current = { width: innerWidth, height: innerHeight };
      update();
    };
    const dismissOutside = (event: PointerEvent) => {
      if (
        readingDockOpen &&
        event.target instanceof Element &&
        !event.target.closest(".bottom-nav")
      )
        closeReadingDock();
    };
    const escape = (event: KeyboardEvent) => {
      if (readingDockOpen && event.key === "Escape") {
        closeReadingDock(true);
        event.preventDefault();
      }
    };
    const back = (event: Event) => {
      if (readingDockOpen && !event.defaultPrevented) {
        closeReadingDock(true);
        event.preventDefault();
      }
    };
    paint();
    if (!readingDockOpen && focusOrb.current) {
      focusOrb.current = false;
      if (reading)
        document
          .querySelector<HTMLButtonElement>(".reading-nav-orb")
          ?.focus({ preventScroll: true });
    }
    if (readingDockOpen && focusDock.current) {
      focusDock.current = false;
      document
        .querySelector<HTMLButtonElement>(".bottom-nav .nav-destination")
        ?.focus({ preventScroll: true });
    }
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    viewport?.addEventListener("resize", resize);
    mobile.addEventListener("change", resize);
    window.addEventListener("zhizhan:reveal-chrome", reveal);
    window.addEventListener("zhizhan:back", back);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", scroll);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      viewport?.removeEventListener("resize", resize);
      mobile.removeEventListener("change", resize);
      window.removeEventListener("zhizhan:reveal-chrome", reveal);
      window.removeEventListener("zhizhan:back", back);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", scroll);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", escape);
      cancelAnimationFrame(frame);
    };
  }, [route, locked, editing, reading, readingDockOpen]);
  return { readingDockOpen, openReadingDock, closeReadingDock };
}

/** Collapsed controls stay mounted but cannot receive focus or accessibility input. */
export function Reveal({
  open,
  children,
  id,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  id: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={`reveal ${className}`}
      data-open={open}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="reveal-inner">{children}</div>
    </div>
  );
}

export function useModalClose(
  ref: RefObject<HTMLElement | null>,
  close: () => void,
) {
  const callback = useRef(close),
    closing = useRef<Animation | null>(null),
    surface = useRef<Animation | null>(null),
    alive = useRef(true);
  callback.current = close;
  useLayoutEffect(() => {
    alive.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => {
      if (media.matches) {
        surface.current?.finish();
        closing.current?.finish();
      }
    };
    media.addEventListener("change", settle);
    return () => {
      alive.current = false;
      media.removeEventListener("change", settle);
      closing.current?.cancel();
      surface.current?.cancel();
      closing.current = null;
    };
  }, []);
  return () => {
    if (closing.current) return;
    const element = ref.current;
    if (!element?.animate || reducedMotion()) {
      callback.current();
      return;
    }
    const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      easing: "ease-out",
      fill: "forwards",
    });
    closing.current = animation;
    surface.current =
      element.querySelector(".modal")?.animate(
        [
          { translate: "0 0", scale: 1 },
          {
            translate:
              element.classList.contains("term-backdrop") &&
              window.matchMedia("(min-width: 701px)").matches
                ? "28px 0"
                : "0 20px",
            scale: element.classList.contains("term-backdrop") ? 1 : 0.985,
          },
        ],
        { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      ) || null;
    void animation.finished.then(
      () => {
        if (alive.current && closing.current === animation) callback.current();
      },
      () => {},
    );
  };
}

export function scrollBehavior(): ScrollBehavior {
  return reducedMotion() ? "auto" : "smooth";
}
