import terms from "../content/glossary.json";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { useEffect, useRef } from "react";

export type TermId = keyof typeof terms;
export const getTerm = (id: string) =>
  Object.prototype.hasOwnProperty.call(terms, id)
    ? terms[id as TermId]
    : undefined;

export function Glossary({
  id,
  onTerm,
  onRead,
}: {
  id: string;
  onTerm: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const term = getTerm(id);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = root.current?.closest<HTMLElement>("[role=dialog]");
    if (panel) {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
  }, [id]);
  if (!term) return null;
  return (
    <div className="term-content" ref={root}>
      <span className="term-english">{term.english}</span>
      <p className="term-summary">{term.summary}</p>
      <p>{term.detail}</p>
      <section className="term-example">
        <h3>工程实践语境</h3>
        <p>{term.example}</p>
      </section>
      <section className="term-caution">
        <h3>容易混淆</h3>
        <p>{term.pitfall}</p>
      </section>
      <nav className="term-related" aria-label="相关概念">
        {term.related.map((key) => (
          <button key={key} onClick={() => onTerm(key)}>
            {getTerm(key)?.title}
            <ArrowUpRight size={14} />
          </button>
        ))}
      </nav>
      <button className="button term-read" onClick={() => onRead(term.chapter)}>
        <BookOpen size={17} />
        阅读相关章节
        <ArrowUpRight size={16} />
      </button>
      <small className="term-scope">嵌入式系统工程 · 核心概念速查</small>
    </div>
  );
}
