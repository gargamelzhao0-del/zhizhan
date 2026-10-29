import {
  Children,
  useEffect,
  useState,
  isValidElement,
  useMemo,
  useRef,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { db } from "./db";
import DOMPurify from "dompurify";
import { scrollToHeading } from "./headings";
import { LearningDemo } from "./LearningDemo";
import { TextbookFigure } from "./TextbookFigure";
import { ThermalDemo } from "./ThermalDemo";
import { ReaderMedia } from "./ReaderMedia";
import { getTerm } from "./Glossary";
import { parseCourseBlock } from "./courseBlocks";
import { CourseAssessment } from "./CourseAssessment";
let diagramQueue = Promise.resolve();
function CourseContent({ language, source, onAsset, onTerm }: {
  language: string; source: string; onAsset: (id: string) => void; onTerm?: (id: string) => void;
}) {
  const block = parseCourseBlock(language, source);
  if (!block) return <pre className="diagram-fallback">{source}</pre>;
  if (block.kind === "assessment") return <CourseAssessment key={block.id} value={block} />;
  if (block.kind === "details") return <details className="course-details"><summary>{block.title}</summary>
    <Markdown body={block.body} onAsset={onAsset} onTerm={onTerm} /></details>;
  return <ReaderMedia kind="table"><table><tbody>{block.rows.map((row, i) => <tr key={i}>
    {row.map((cell,j) => { const Cell = cell.header ? "th" : "td"; return <Cell key={j} rowSpan={cell.rowSpan} colSpan={cell.colSpan}>
      <Markdown body={cell.body} onAsset={onAsset} onTerm={onTerm} /></Cell>; })}
  </tr>)}</tbody></table></ReaderMedia>;
}
function Diagram({ source }: { source: string }) {
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(false);
    diagramQueue = diagramQueue
      .catch(() => {})
      .then(async () => {
        if (cancelled) return;
        try {
          if (source.length > 20000) throw new Error("Diagram too large");
          const { default: mermaid } = await import("mermaid");
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            look: "classic",
            themeVariables: {
              primaryColor: "#edf4ee",
              primaryBorderColor: "#8ba38f",
              primaryTextColor: "#263b2e",
              lineColor: "#6d8474",
              secondaryColor: "#f4f6f0",
              tertiaryColor: "#fff",
              fontSize: "14px",
            },
            fontFamily: "sans-serif",
            htmlLabels: false,
            flowchart: { htmlLabels: false },
            maxTextSize: 20000,
            suppressErrorRendering: true,
          });
          const result = await mermaid.render(
            `diagram-${crypto.randomUUID()}`,
            source,
          );
          if (!cancelled)
            setSvg(
              DOMPurify.sanitize(result.svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                FORBID_TAGS: ["foreignObject"],
              }),
            );
        } catch {
          if (!cancelled) setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);
  return error ? (
    <pre className="diagram-fallback">{source}</pre>
  ) : svg ? (
    <ReaderMedia kind="figure">
      <div className="diagram" dangerouslySetInnerHTML={{ __html: svg }} />
    </ReaderMedia>
  ) : (
    <div className="muted">正在绘制流程图…</div>
  );
}
function AssetImage({ src, alt }: { src?: string; alt?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    let revoked = false,
      objectUrl = "";
    if (src?.startsWith("asset:"))
      void db.attachments
        .get(src.slice(6))
        .then((a) => {
          if (a && /^image\/(png|jpeg|gif|webp)$/.test(a.mime) && !revoked) {
            objectUrl = URL.createObjectURL(a.data);
            setUrl(objectUrl);
          }
        })
        .catch(() => {
          if (!revoked) setUrl("");
        });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return url ? (
    <img src={url} alt={alt || "文章插图"} loading="lazy" />
  ) : (
    <span className="image-placeholder">
      {alt || "图片"} · 请导入本地图片附件
    </span>
  );
}
export function Markdown({
  body,
  onAsset,
  onTerm,
}: {
  body: string;
  onAsset: (id: string) => void;
  onTerm?: (id: string) => void;
}) {
  const callbacks = useRef({ onAsset, onTerm });
  callbacks.current = { onAsset, onTerm };
  // Stable component types preserve diagram/demo state and the trigger DOM node
  // when reading progress or a modal changes in the parent.
  const components = useMemo<Components>(
    () => ({
      h1: ({ children }) =>
        Children.count(children) ? <h1>{children}</h1> : null,
      h2: ({ children }) =>
        Children.count(children) ? <h2>{children}</h2> : null,
      h3: ({ children }) =>
        Children.count(children) ? <h3>{children}</h3> : null,
      h4: ({ children }) =>
        Children.count(children) ? <h4>{children}</h4> : null,
      h5: ({ children }) =>
        Children.count(children) ? <h5>{children}</h5> : null,
      h6: ({ children }) =>
        Children.count(children) ? <h6>{children}</h6> : null,
      a: ({ href, children }) =>
        href?.startsWith("term:") ? (
          getTerm(href.slice(5)) && callbacks.current.onTerm ? (
            <button
              className="term-link"
              aria-label={`解释：${getTerm(href.slice(5))!.title}`}
              aria-haspopup="dialog"
              onClick={() => callbacks.current.onTerm?.(href.slice(5))}
            >
              {children}
            </button>
          ) : (
            <span>{children}</span>
          )
        ) : href?.startsWith("doc:") ? (
          <a
            href={`#article/${href.slice(4).split("#")[0]}${href.includes("#") ? `?section=${encodeURIComponent(href.slice(href.indexOf("#") + 1))}` : ""}`}
          >
            {children}
          </a>
        ) : href?.startsWith("asset:") ? (
          <button
            className="inline-link"
            onClick={() =>
              callbacks.current.onAsset(href.slice(6).split("#")[0])
            }
          >
            {children}
          </button>
        ) : href?.startsWith("#") ? (
          <button
            className="inline-link"
            onClick={(event) => {
              scrollToHeading(
                document.querySelector<HTMLElement>(".reader .prose") ||
                  event.currentTarget.closest(".prose"),
                href,
              );
            }}
          >
            {children}
          </button>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ) : (
          <span title="此链接未随资料导入">{children}</span>
        ),
      img: ({ src, alt }) => <AssetImage src={src} alt={alt} />,
      table: ({ children }) => (
        <ReaderMedia kind="table">
          <table>{children}</table>
        </ReaderMedia>
      ),
      pre: ({ children }) =>
        isValidElement<{ className?: string; children?: React.ReactNode }>(children) &&
        /language-zhizhan-(details|table|assessment)\b/.test(children.props.className || "") ? (
          <CourseContent language={children.props.className!.match(/language-(zhizhan-[\w-]+)/)![1]}
            source={String(children.props.children || "")}
            onAsset={id => callbacks.current.onAsset(id)} onTerm={id => callbacks.current.onTerm?.(id)} />
        ) :
        isValidElement<{ className?: string; children?: React.ReactNode }>(
          children,
        ) && children.props.className?.includes("language-zhizhan-figure") ? (
          <TextbookFigure source={String(children.props.children || "")} />
        ) : isValidElement<{ className?: string; children?: React.ReactNode }>(
            children,
          ) && children.props.className?.includes("language-zhizhan-anchor") ? (
          <span
            className="textbook-anchor"
            data-source-anchor={String(children.props.children || "").trim()}
          />
        ) : isValidElement<{ className?: string; children?: React.ReactNode }>(
            children,
          ) &&
          children.props.className?.includes("language-zhizhan-thermal") ? (
          <ThermalDemo />
        ) : isValidElement<{ className?: string; children?: React.ReactNode }>(
            children,
          ) && children.props.className?.includes("language-zhizhan-map") ? (
          <div className="reading-map">
            <span>本章脉络</span>
            <ol aria-label="本章知识路径">
              {String(children.props.children || "")
                .trim()
                .split("\n")
                .slice(0, 8)
                .map((label, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </li>
                ))}
            </ol>
          </div>
        ) : isValidElement<{ className?: string; children?: React.ReactNode }>(
            children,
          ) && children.props.className?.includes("language-zhizhan-demo") ? (
          <LearningDemo kind={String(children.props.children || "").trim()} />
        ) : isValidElement<{ className?: string; children?: React.ReactNode }>(
            children,
          ) && children.props.className?.includes("language-mermaid") ? (
          <Diagram source={String(children.props.children || "")} />
        ) : (
          <ReaderMedia kind="code">
            <pre>{children}</pre>
          </ReaderMedia>
        ),
    }),
    [],
  );
  const rendered = useMemo(
    () => (
      <div className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          skipHtml
          urlTransform={(url) =>
            /^(https?:|mailto:|doc:|asset:|term:|#)/.test(url) ? url : ""
          }
          components={components}
        >
          {body}
        </ReactMarkdown>
      </div>
    ),
    [body, components],
  );
  return rendered;
}
