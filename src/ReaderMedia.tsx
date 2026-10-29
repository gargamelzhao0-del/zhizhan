import { useRef, useState, type ReactNode } from "react";
import { Maximize2, Copy, Minus, Plus } from "lucide-react";
import { ReaderDialog } from "./ReaderDialog";

export function ReaderMedia({
  kind,
  children,
}: {
  kind: "code" | "figure" | "table";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [zoom, setZoom] = useState(1),
    [wrap, setWrap] = useState(false);
  const [status, setStatus] = useState("");
  const preview = useRef<HTMLDivElement>(null),
    viewer = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  const previewScroll = useRef({ left: 0, top: 0 });
  function closeViewer() {
    setOpen(false);
    requestAnimationFrame(() =>
      preview.current?.scrollTo(previewScroll.current),
    );
  }
  const label = { code: "代码", figure: "图解", table: "表格" }[kind];
  async function copy() {
    const root = open ? viewer.current : preview.current;
    try {
      await navigator.clipboard.writeText(
        root?.querySelector("code")?.textContent || "",
      );
      setStatus("已复制完整代码");
    } catch {
      setStatus("复制未成功，请长按选择代码");
    }
  }
  const content = (
    <div
      className={`media-content ${kind === "figure" ? "textbook-figure-scroll" : ""}`}
    >
      {children}
    </div>
  );
  return (
    <div className={`reader-media media-${kind}`}>
      <div className="media-caption">
        <span>{label}</span>
        <div>
          {kind === "code" && (
            <button aria-label="复制完整代码" onClick={() => void copy()}>
              <Copy size={14} />
              复制
            </button>
          )}
          <button
            aria-label={`全屏查看${label}`}
            onClick={() => {
              height.current =
                preview.current?.getBoundingClientRect().height || 0;
              previewScroll.current = {
                left: preview.current?.scrollLeft || 0,
                top: preview.current?.scrollTop || 0,
              };
              setZoom(1);
              setOpen(true);
            }}
          >
            <Maximize2 size={14} />
            放大
          </button>
        </div>
      </div>
      <div
        className="media-preview"
        ref={preview}
        tabIndex={kind === "figure" ? undefined : 0}
        aria-label={`${label}预览`}
        style={open ? { height: height.current } : undefined}
      >
        {!open && content}
      </div>
      {status && !open && <small role="status">{status}</small>}
      {open && (
        <ReaderDialog title={`${label}查看`} full onClose={closeViewer}>
          <div className="media-controls">
            {kind === "figure" ? (
              <>
                <button
                  aria-label="缩小图解"
                  disabled={zoom <= 1}
                  onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                >
                  <Minus size={18} />
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button
                  aria-label="放大图解"
                  disabled={zoom >= 4}
                  onClick={() => setZoom(Math.min(4, zoom + 0.5))}
                >
                  <Plus size={18} />
                </button>
                <button onClick={() => setZoom(1)}>适合屏幕</button>
                <span>放大后滑动查看</span>
              </>
            ) : kind === "code" ? (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={wrap}
                    onChange={(e) => setWrap(e.target.checked)}
                  />{" "}
                  自动换行
                </label>
                <button onClick={() => void copy()}>复制完整代码</button>
                <span role="status">{status}</span>
              </>
            ) : (
              <span>可横向滑动 · 保留原始行列关系</span>
            )}
          </div>
          <div
            ref={viewer}
            className={`media-viewer prose ${wrap ? "media-wrap" : ""} viewer-${kind} ${kind === "figure" ? "textbook-figure" : ""}`}
            onClickCapture={(event) => {
              if (
                (event.target as Element).closest("a,.term-link,.inline-link")
              )
                setOpen(false);
            }}
          >
            <div
              style={
                kind === "figure" ? { width: `${zoom * 100}%` } : undefined
              }
            >
              {content}
            </div>
          </div>
        </ReaderDialog>
      )}
    </div>
  );
}
