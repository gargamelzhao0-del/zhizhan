import { Fragment, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Layers3,
  Search,
} from "lucide-react";
import catalogData from "../content/textbooks/catalog.json";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { bundledTarget } from "./bundledTargets";
import type { Article, Shelf } from "./model";
export interface Book {
  id: string; name: string; group: string; objective: string;
  shelfId: string; overviewId: string; prerequisites: string[];
  reading_contract?: { role: string; prerequisite: string; deliverable: string; pass: string; defer: string };
  chapters: { id: string; anchor: string; title: string; order: number; sections?: { anchor: string; title: string }[] }[];
  modules: { id: string; title: string; topics: string; lab: string; acceptance: string; articleId?: string }[];
}
const catalog = catalogData as unknown as {
  books: Book[]; groups: string[];
  projects: { id: string; name: string; deliverable: string; checks: string; books: string[]; articleId?: string }[];
};
export const textbookCatalog = catalog;
export const getTextbook = (id: string) =>
  catalog.books.find((b) => b.shelfId === id);
export function useInstalledBook(source: Book, articles: Article[]) {
  const installed = useLiveQuery(() => db.settings.get('builtinContent'), []);
  const target = (id: string) => bundledTarget(id, installed?.value, articles);
  return { ...source, overviewId: target(source.overviewId),
    chapters: source.chapters.map(c => ({ ...c, id: target(c.id) })),
    modules: source.modules.map(m => ({ ...m, articleId: m.articleId && target(m.articleId) })) };
}
const openBook = (b: Book) => {
  location.hash = `shelf/${b.shelfId}`;
};
export function BookCard({
  book: source,
  articles,
}: {
  book: Book;
  articles: Article[];
}) {
  const book = useInstalledBook(source, articles);
  const completed = book.chapters.filter((c) =>
    articles.some((a) => a.id === c.id && a.progress === 100),
  ).length;
  const installed = articles.some(a => a.shelfId === book.shelfId);
  return (
    <button className="textbook-card" onClick={() => installed ? openBook(book) : (location.hash = 'settings')}>
      <span
        className={`textbook-jacket ${book.chapters.length ? "" : "is-outline"}`}
        aria-hidden="true"
      >
        <span>{book.id}</span>
        <BookOpen size={26} strokeWidth={1.3} />
        <small>{book.group}</small>
      </span>
      <span className="textbook-card-copy">
        <span className="textbook-status">
          {book.chapters.length ? `${book.chapters.length} 篇正文 · ${book.modules.length} 个模块` : "课程规划"}
        </span>
        <strong>{book.name}</strong>
        <span className="textbook-objective">{book.objective}</span>
        <small>
          {!installed ? '更新内置资料后阅读' : completed
            ? `已读 ${completed} / ${book.chapters.length} 章`
            : book.chapters.length
              ? "阅读与实践"
              : `${book.modules.length} 个计划模块`}
        </small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}
export function TextbookLibrary({
  articles,
  shelves,
  onCreate,
}: {
  articles: Article[];
  shelves: Shelf[];
  onCreate: () => void;
}) {
  const [group, setGroup] = useState("全部"),
    [query, setQuery] = useState(""),
    [readable, setReadable] = useState(false);
  const match = (b: Book) =>
    (group === "全部" || b.group === group) &&
    (!readable || b.chapters.length > 0) &&
    `${b.id} ${b.name} ${b.objective}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const extra = shelves.filter(
    (s) => s.kind === "course" && !getTextbook(s.id),
  );
  return (
    <div className="textbook-library">
      <header className="textbook-hero">
        <span className="eyebrow">THE ENGINEERING LIBRARY</span>
        <h1>{catalog.books.length ? "从基础，走向系统。" : "你的课程书库"}</h1>
        <p>{catalog.books.length ? "从零基础到独立嵌入式项目，按需要选择学习。" : "旧版内置教程已移除，可新建课程或导入自己的资料。"}</p>
        <div className="textbook-facts">
          <span>
            <b>{catalog.books.length}</b> 册课本
          </span>
          <span>
            <b>{catalog.groups.length}</b> 个领域
          </span>
          <span>
            <b>{catalog.books.reduce((s, b) => s + b.modules.length, 0)}</b>{" "}
            个模块
          </span>
        </div>
      </header>
      {catalog.books.length > 0 && <nav className="course-entry-links" aria-label="课程学习入口">
        <a href="#article/course-learning-path"><strong>从项目路线开始</strong><span>八个阶段，明确离站条件</span><ArrowRight size={18} /></a>
        <a href="#article/course-projects"><strong>六项综合实践</strong><span>完整工程、输入与验收方法</span><ArrowRight size={18} /></a>
        <a href="#article/course-quality-review"><strong>阅读取舍与验证边界</strong><span>逐册审查，区分主机与实机证据</span><ArrowRight size={18} /></a>
      </nav>}
      {catalog.books.some(b => !shelves.some(s => s.id === b.shelfId)) && <a className="textbook-update" href="#settings"><span><strong>新课本已随应用提供</strong><small>在设置中更新内置资料，即可导入本地书库。</small></span><ArrowRight size={18} /></a>}
      <div className="textbook-tools">
        <label className="textbook-search">
          <Search size={17} />
          <input
            aria-label="查找课本"
            placeholder="书名、技术或册号"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="textbook-readonly">
          <input
            type="checkbox"
            checked={readable}
            onChange={(e) => setReadable(e.target.checked)}
          />
          只看有正文
        </label>
      </div>
      <div className="textbook-groups" role="group" aria-label="课本领域">
        {["全部", ...catalog.groups].map((g) => (
          <button
            key={g}
            aria-pressed={g === group}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      {catalog.groups.map((g) => {
        const books = catalog.books.filter((b) => b.group === g && match(b));
        return books.length ? (
          <section className="textbook-domain" key={g}>
            <h2>
              {g}
              <span>{books.length} 册</span>
            </h2>
            <div className="textbook-grid">
              {books.map((b) => (
                <BookCard key={b.id} book={b} articles={articles} />
              ))}
            </div>
          </section>
        ) : null;
      })}
      {catalog.books.length > 0 && !catalog.books.some(match) && (
        <p className="textbook-empty">
          没有符合条件的课本，试试其他关键词或领域。
        </p>
      )}
      {catalog.projects.length > 0 && <section className="textbook-projects">
        <div className="section-heading">
          <h2>把知识连成项目</h2>
          <Layers3 size={20} />
        </div>
        <p className="muted">六条实践路线，明确交付物和验收方法。</p>
        {catalog.projects.map((p) => (
          <details key={p.id}>
            <summary>
              <span>{p.id}</span>
              <strong>{p.name}</strong>
              <ChevronRight size={18} />
            </summary>
            <p>{p.deliverable}</p>
            <p>
              <strong>验收：</strong>
              {p.checks}
            </p>
            {p.articleId && <a className="inline-link" href={`#article/${p.articleId.split('#')[0]}?section=${p.articleId.split('#')[1]}`}>打开项目与实验资料</a>}
            <div className="textbook-links">
              {p.books.map((id) => {
                const b = catalog.books.find((b) => b.id === id);
                return (
                  b && (
                    <button key={id} onClick={() => openBook(b)}>
                      {id} · {b.name}
                    </button>
                  )
                );
              })}
            </div>
          </details>
        ))}
      </section>}
      <section className="textbook-extras">
        <h2>专题与自建课程</h2>
        <p className="muted">原有课程、笔记与阅读进度仍然保留。</p>
        {extra.map((s) => (
          <a href={`#shelf/${s.id}`} key={s.id}>
            {s.title}
            <ArrowRight size={16} />
          </a>
        ))}
        <button className="button quiet" onClick={onCreate}>
          新建课程
        </button>
      </section>
    </div>
  );
}
export function TextbookContents({
  book: source,
  articles,
}: {
  book: Book;
  articles: Article[];
}) {
  const book = useInstalledBook(source, articles);
  const finished = book.chapters.filter((c) =>
    articles.some((a) => a.id === c.id && a.progress === 100),
  ).length;
  const resume = [...articles]
    .filter(
      (a) =>
        book.chapters.some((c) => c.id === a.id) &&
        a.progress < 100 &&
        a.lastReadAt,
    )
    .sort((a, b) => b.lastReadAt - a.lastReadAt)[0];
  const first =
    resume?.id ||
    book.chapters.find(
      (c) => !articles.some((a) => a.id === c.id && a.progress === 100),
    )?.id ||
    book.chapters[0]?.id;
  return (
    <div className="textbook-detail">
      <a href="#courses" className="textbook-back">
        课本书库 / {book.group}
      </a>
      <header className="textbook-book-head">
        <span className="textbook-volume">{book.id}</span>
        <span className="eyebrow">
          {book.chapters.length ? "正文与实践" : "课程规划 · 正文待编写"}
        </span>
        <h1>{book.name}</h1>
        <p>{book.objective}</p>
        <div className="textbook-book-actions">
          <a className="button primary" href={`#original/${book.shelfId}`}>
            阅读原版整册 <BookOpen size={17} />
          </a>
          {first && (
            <a
              className="button quiet"
              href={`#article/${first}${resume ? "?resume=1" : ""}`}
            >
              {resume ? "继续分章阅读" : "分章阅读"}
              <ArrowRight size={17} />
            </a>
          )}
          <a className="button quiet" href={`#article/${book.overviewId}`}>
            导读与实验资料
          </a>
        </div>
        <p className="textbook-reading-modes">原版整册保留手机书库的连续正文和完整目录；分章阅读可记录学习笔记。</p>
      </header>
      {book.reading_contract && <section className="textbook-prerequisites">
        <span>{book.reading_contract.role}</span>
        <p><strong>应能交付：</strong>{book.reading_contract.deliverable}</p>
        <p><strong>阅读取舍：</strong>{book.reading_contract.defer}</p>
      </section>}
      {book.prerequisites.length > 0 && (
        <section className="textbook-prerequisites">
          <span>建议先修</span>
          <div className="textbook-links">
            {book.prerequisites.map((id) => {
              const b = catalog.books.find((b) => b.id === id);
              return (
                b && (
                  <button key={id} onClick={() => openBook(b)}>
                    {b.id} · {b.name}
                    <ChevronRight size={14} />
                  </button>
                )
              );
            })}
          </div>
        </section>
      )}
      {book.chapters.length > 0 && (
        <section className="textbook-chapters">
          <div className="section-heading">
            <h2>正文目录</h2>
            <span>
              {finished} / {book.chapters.length} 已读
            </span>
          </div>
          <p className="textbook-content-count">
            {book.modules.length} 个学习模块，{book.chapters.length} 篇正文（含路线与附录）。
            展开各篇小节可直接进入对应讲解。
          </p>
          {book.chapters.map((c) => {
            const a = articles.find((a) => a.id === c.id);
            return (
              <Fragment key={c.id}>
              <a href={`#article/${c.id}`}>
                <span className="textbook-chapter-no">
                  {String(c.order).padStart(2, "0")}
                </span>
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {a?.progress === 100
                      ? "已读完"
                      : a?.progress
                        ? `已读 ${a.progress}%`
                        : "图解 · 示例 · 实践"}
                  </small>
                </span>
                {a?.progress === 100 ? (
                  <Check size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </a>
              {!!c.sections?.length && <details className="textbook-chapter-sections">
                <summary>查看 {c.sections.length} 个小节</summary>
                {c.sections.map((section) => <a key={section.anchor}
                  href={`#article/${c.id}?section=${encodeURIComponent(section.anchor)}`}>
                  {section.title}
                </a>)}
              </details>}
              </Fragment>
            );
          })}
        </section>
      )}
      <section className="textbook-outline">
        <h2>{book.chapters.length ? "模块任务与验收" : "本册将学什么"}</h2>
        <p className="muted">
          {book.chapters.length
            ? "模块目标与修订正文对应；已读、独立实践和实机验收分别记录。"
            : "以下为待编写模块，可查看知识范围与实践任务。"}
        </p>
        {book.modules.map((m) => (
          <details key={m.id}>
            <summary>
              <span>{m.id}</span>
              {m.title}
            </summary>
            <p>{m.topics}</p>
            <p>
              <strong>实践：</strong>
              {m.lab}
            </p>
            <p>
              <strong>验收：</strong>
              {m.acceptance}
            </p>
            {m.articleId && <a className="inline-link" href={`#article/${m.articleId}`}>阅读本模块完整正文 <ArrowRight size={15} /></a>}
          </details>
        ))}
      </section>
    </div>
  );
}
