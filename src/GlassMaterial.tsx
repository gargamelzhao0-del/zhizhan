import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type NormalMap = { url: string; width: number; height: number };
const normalMaps = new Map<string, string>();
/** Cache only the lens geometry, never an image of the page behind it. */
function capsuleMap(width: number, height: number) {
  const key = `${width}:${height}`,
    cached = normalMaps.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas"),
    ratio = Math.min(1, 480 / width);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pixels = context.createImageData(canvas.width, canvas.height),
    radius = canvas.height / 2;
  const rim = Math.max(3, Math.min(8 * ratio, radius * 0.45));
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const nx =
          x + 0.5 - Math.max(radius, Math.min(canvas.width - radius, x + 0.5)),
        ny = y + 0.5 - radius;
      const distance = Math.hypot(nx, ny),
        depth = radius - distance;
      const bend =
          depth > 0 && depth < rim
            ? Math.sin((depth / rim) * Math.PI) * 104
            : 0,
        i = (y * canvas.width + x) * 4;
      pixels.data[i] = 128 + (distance ? (nx / distance) * bend : 0);
      pixels.data[i + 1] = 128 + (distance ? (ny / distance) * bend : 0);
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL();
  if (normalMaps.size >= 16) normalMaps.delete(normalMaps.keys().next().value!);
  normalMaps.set(key, url);
  return url;
}

/** Morph with a live native backdrop; crossfade to refraction only at its exact settled size. */
export function GlassMaterial() {
  const id = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<HTMLSpanElement>(null),
    [map, setMap] = useState<NormalMap | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const solid = matchMedia(
      "(prefers-reduced-transparency: reduce), (prefers-contrast: more)",
    );
    let timer = 0,
      generation = 0,
      disposed = false,
      observed = "";
    const update = async () => {
      const token = ++generation,
        width = el.clientWidth,
        height = el.clientHeight;
      observed = `${width}:${height}`;
      if (solid.matches || !width || !height) {
        setMap(null);
        el.dataset.glassPhase = "fallback";
        return;
      }
      try {
        const url = capsuleMap(width, height);
        if (!url) {
          setMap(null);
          return;
        }
        // Decode before exposing the SVG image, avoiding a blank frame during replacement.
        const bitmap = new Image();
        bitmap.src = url;
        await bitmap.decode();
        if (disposed || token !== generation) return;
        setMap({ url, width, height });
      } catch {
        if (!disposed && token === generation) {
          setMap(null);
          el.dataset.glassPhase = "fallback";
        }
      }
    };
    const invalidate = () => {
      const size = `${el.clientWidth}:${el.clientHeight}`;
      if (size === observed) return;
      observed = size;
      ++generation;
      clearTimeout(timer);
      el.dataset.glassPhase = "moving";
      timer = window.setTimeout(() => void update(), 60);
    };
    const preference = () => {
      ++generation;
      clearTimeout(timer);
      el.dataset.glassPhase = "fallback";
      void update();
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(el);
    solid.addEventListener("change", preference);
    void update();
    return () => {
      disposed = true;
      ++generation;
      clearTimeout(timer);
      observer.disconnect();
      solid.removeEventListener("change", preference);
    };
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (
      el &&
      map &&
      el.clientWidth === map.width &&
      el.clientHeight === map.height
    )
      el.dataset.glassPhase = "still";
  }, [map]);
  return (
    <span
      ref={ref}
      className="glass-material"
      aria-hidden="true"
      data-optics={map ? "ready" : undefined}
      style={{ "--glass-optic": `url("#${id}")` } as CSSProperties}
    >
      <span className="glass-diffusion" />
      <span className="glass-refraction" />
      <svg className="glass-definitions" width="0" height="0" focusable="false">
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width="1"
            height="1"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="3.5"
              result="soft"
            />
            <feImage
              href={map?.url}
              x="0"
              y="0"
              width={map?.width || 1}
              height={map?.height || 1}
              preserveAspectRatio="none"
              result="normal"
            />
            <feDisplacementMap
              in="soft"
              in2="normal"
              scale="8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
    </span>
  );
}
