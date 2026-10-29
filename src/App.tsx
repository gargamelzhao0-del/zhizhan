import { ReaderDialog } from "./ReaderDialog";
import {
  captureReadingPosition,
  restoreReadingPosition,
} from "./readingPosition";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextbookLibrary, TextbookContents, getTextbook } from "./Textbooks";
import { OriginalBookReader } from "./OriginalBookReader";
import { bundledTarget } from "./bundledTargets";
import { retiredShelfIds } from "./retiredTutorials";
import { useLiveQuery } from "dexie-react-hooks";
import { App as NativeApp } from "@capacitor/app";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  GraduationCap,
  HardDrive,
  History,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  db,
  patchArticle,
  saveArticle,
  saveNote as persistNote,
  advanceProgress,
} from "./db";
import { readNoteDraft, writeNoteDraft, clearNoteDraft } from "./drafts";
import { copyTitle } from "./links";
import { headingSlug, scrollToHeading } from "./headings";
import {
  articleDefaults,
  kindNames,
  nextReview,
  searchArticles,
  templates,
  uid,
  type Article,
  type Attachment,
  type Revision,
  type Shelf,
  type ShelfKind,
} from "./model";
import {
  exportArchive,
  importArchive,
  inspectArchive,
  type ImportData,
} from "./archive";
import { Markdown } from "./Markdown";
import { CourseDisclosures } from "./CourseDisclosures";
import { Glossary, getTerm } from "./Glossary";
import { CoursePath, hasCoursePath } from "./CoursePath";
import { LearningHome, LibraryView, ShelfCard, CoverArt } from "./LibraryViews";
import { Editor } from "./Editor";
import { message, native, saveFile } from "./platform";
import { importMarkdown } from "./importMarkdown";
import { version } from "../package.json";
import { updateBundledContent } from "./seed";
import { UpdateNotice, UpdateSettings } from "./UpdateUI";
import { GlassMaterial } from "./GlassMaterial";
import { prepareChromeMorph } from "./chromeAnimation";
import {
  Reveal,
  scrollBehavior,
  useEnterMotion,
  useModalClose,
  SelectionGroup,
  useChromeMotion,
} from "./motion";

const go = (path: string) => {
  window.location.hash = path;
};
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "home");
  useEffect(() => {
    const fn = () => {
      setRoute(location.hash.slice(1) || "home");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}
const date = (n: number) =>
  new Date(n).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
const size = (n: number) =>
  n < 1024 * 1024
    ? `${(n / 1024).toFixed(1)} KiB`
    : `${(n / 1048576).toFixed(1)} MiB`;
function Modal({
  title,
  children,
  onClose,
  returnFocus,
  variant,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  returnFocus: HTMLElement | null;
  variant?: "term";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const requestClose = useModalClose(backdrop, onClose);
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    const previous = returnFocus;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const el = ref.current;
    el?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          el?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || [],
        ).filter(
          (item) =>
            item.tabIndex >= 0 &&
            item.getClientRects().length &&
            !item.closest("[inert]"),
        );
        if (!items.length) {
          e.preventDefault();
          el?.focus();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el?.addEventListener("keydown", key);
    return () => {
      el?.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={backdrop}
      className={`modal-backdrop${variant === "term" ? " term-backdrop" : ""}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={requestClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
  icon: Icon = BookOpen,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Icon size={30} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function ArticleRow({
  a,
  shelf,
  onFavorite,
}: {
  a: Article;
  shelf?: Shelf;
  onFavorite: () => void;
}) {
  return (
    <div className="article-row">
      <button
        className="article-row-main"
        onClick={() => go(`article/${a.id}`)}
      >
        <span className="file-icon">
          <FileText size={20} />
        </span>
        <span className="row-content">
          <strong>{a.title}</strong>
          <small>
            {shelf?.title}
            {a.tags.length > 0 && ` · ${a.tags.slice(0, 3).join(" / ")}`}
          </small>
        </span>
        <span className="row-date">
          {a.progress === 100 ? <CheckCircle2 size={16} /> : date(a.updatedAt)}
        </span>
      </button>
      <button
        className={`icon-button favorite ${a.favorite ? "active" : ""}`}
        aria-label={a.favorite ? "取消收藏" : "收藏文章"}
        aria-pressed={a.favorite}
        onClick={onFavorite}
      >
        <Bookmark size={17} fill={a.favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
function Reading({
  article,
  shelf,
  siblings,
  onEdit,
  onAsset,
  onToast,
  onHistory,
  onTerm,
  section,
  resume,
}: {
  article: Article;
  shelf?: Shelf;
  siblings: Article[];
  onEdit: () => void;
  onAsset: (id: string) => void;
  onToast: (s: string) => void;
  onHistory: () => void;
  onTerm: (id: string) => void;
  section: string;
  resume: boolean;
}) {
  const recoveredNote = useRef(readNoteDraft(article.id));
  const content = useRef<HTMLDivElement>(null),
    [note, setNote] = useState(recoveredNote.current?.value ?? article.note),
    [noteState, setNoteState] = useState(""),
    [noteError, setNoteError] = useState(false),
    [showNote, setShowNote] = useState(!!recoveredNote.current),
    [toc, setToc] = useState(false),
    [tocItems, setTocItems] = useState<string[]>([]);
  const noteRef = useRef(note),
    noteDirty = useRef(!!recoveredNote.current),
    noteBase = useRef<string | null>(
      recoveredNote.current ? recoveredNote.current.base : article.note,
    ),
    noteSaving = useRef(false);
  const position = useRef(article.progress);
  const initialProgress = useRef(article.progress);
  const [preferences, setPreferences] = useState(false);
  const [details, setDetails] = useState(false);
  const [activeHeading, setActiveHeading] = useState(0);
  const positionSnapshot = useRef<unknown>(null);
  const [savedPosition, setSavedPosition] = useState<unknown>(null);
  const spacing = useLiveQuery(() => db.settings.get("readerSpacing"), []);
  useEffect(() => {
    let cancelled = false;
    void db.settings
      .get(`reading-position:${article.id}`)
      .then((value) => {
        if (!cancelled) {
          positionSnapshot.current = value?.value;
          setSavedPosition(value?.value);
        }
      })
      .catch(() => {
        if (!cancelled) setSavedPosition(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [article.id]);
  function resumePosition() {
    const el = content.current;
    if (!el || restoreReadingPosition(el, savedPosition)) return;
    window.scrollTo({
      top:
        el.getBoundingClientRect().top +
        window.scrollY +
        (article.progress / 100) * Math.max(0, el.clientHeight - innerHeight),
      behavior: "instant",
    });
  }
  function jumpToHeading(i: number) {
    setToc(false);
    setActiveHeading(i);
    requestAnimationFrame(() =>
      scrollToHeading(content.current, `section-${i}`),
    );
  }
  const readerSettings = useLiveQuery(() => db.settings.get("fontSize"), []);
  const restored = useRef(false);
  useEffect(() => {
    if (!resume || section || restored.current || savedPosition === null)
      return;
    const frame = requestAnimationFrame(() => {
      restored.current = true;
      resumePosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [article.id, resume, section, savedPosition]);
  useEffect(() => {
    const headings = Array.from(
      content.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") || [],
    ).filter((el) => el.textContent?.trim());
    const used = new Set<string>();
    headings?.forEach((el, i) => {
      el.id = `section-${i}`;
      const base = headingSlug(el.textContent || "");
      let slug = base,
        suffix = 0;
      while (used.has(slug)) slug = `${base}-${++suffix}`;
      used.add(slug);
      el.dataset.anchor = slug;
    });
    setTocItems(Array.from(headings || [], (el) => el.textContent || ""));
    if (section) scrollToHeading(content.current, section);
  }, [article.body, section]);
  const index = siblings.findIndex((a) => a.id === article.id),
    next = siblings[index + 1];
  useEffect(() => {
    void patchArticle(article.id, { lastReadAt: Date.now() });

    let timer: ReturnType<typeof setTimeout>;
    let moved = false;
    const savePosition = () => {
      const el = content.current;
      if (!moved || document.querySelector("dialog[open]")) return;
      const snapshot = el
        ? captureReadingPosition(el)
        : positionSnapshot.current;
      if (snapshot) {
        positionSnapshot.current = snapshot;
        void db.settings
          .put({ key: `reading-position:${article.id}`, value: snapshot })
          .catch(() => {});
      }
    };
    const hide = () => {
      if (document.visibilityState === "hidden") savePosition();
    };
    const scroll = () => {
      moved = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = content.current;
        if (!el || document.querySelector("dialog[open]")) return;
        savePosition();
        const headings = Array.from(
          el.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"),
        ).filter((el) => el.textContent?.trim());
        let current = 0;
        for (let i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top <= 120) current = i;
          else break;
        }
        setActiveHeading(current);
        const top = el.getBoundingClientRect().top + window.scrollY;
        const p = Math.round(
          Math.min(
            99,
            Math.max(
              0,
              ((window.scrollY - top) /
                Math.max(1, el.clientHeight - window.innerHeight)) *
                100,
            ),
          ),
        );
        if (p > position.current) {
          position.current = p;
          void advanceProgress(article.id, p).catch((e) => onToast(message(e)));
        }
      }, 800);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", savePosition);
    return () => {
      savePosition();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", savePosition);
      clearTimeout(timer);
      window.removeEventListener("scroll", scroll);
    };
  }, [article.id]);
  async function saveNote() {
    if (!noteDirty.current || noteSaving.current) return;
    const value = noteRef.current;
    noteSaving.current = true;
    let ok = false;
    try {
      await persistNote(article.id, value, noteBase.current);
      noteBase.current = value;
      ok = true;
      if (noteRef.current === value) {
        noteDirty.current = false;
        clearNoteDraft(article.id, value);
        setNoteState("笔记已保存");
      } else writeNoteDraft(article.id, noteRef.current, value);
      setNoteError(false);
    } catch (e) {
      setNoteState(`保存失败：${message(e)}`);
      setNoteError(true);
    } finally {
      noteSaving.current = false;
    }
    if (ok && noteDirty.current) void saveNote();
  }
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") void saveNote();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      void saveNote();
      document.removeEventListener("visibilitychange", hide);
    };
  }, [article.id]);
  useEffect(() => {
    if (!noteDirty.current && !noteSaving.current) {
      noteBase.current = article.note;
      noteRef.current = article.note;
      setNote(article.note);
    }
  }, [article.note]);
  useEffect(() => {
    position.current = article.progress;
  }, [article.progress]);
  useEffect(() => {
    const t = setTimeout(() => void saveNote(), 500);
    return () => clearTimeout(t);
  }, [note]);
  return (
    <section
      className="reader"
      style={
        {
          "--reader-leading": Number(spacing?.value || 1.8),
        } as React.CSSProperties
      }
    >
      <div className="reader-toolbar">
        <button
          className="button quiet"
          onClick={() => go(`shelf/${article.shelfId}`)}
        >
          <ArrowLeft size={17} />
          <span>{shelf?.title || "返回知识库"}</span>
        </button>
        <div className="toolbar-actions">
          <button
            className="icon-button reader-type-button"
            aria-label="阅读字号"
            aria-expanded={preferences}

            onClick={() => setPreferences(!preferences)}
          >
            <span aria-hidden="true">Aa</span>
          </button>
          <button
            className={`icon-button favorite ${article.favorite ? "active" : ""}`}
            title="收藏"
            aria-label="切换收藏"
            aria-pressed={article.favorite}
            onClick={() =>
              void patchArticle(article.id, { favorite: !article.favorite })
            }
          >
            <Bookmark
              size={18}
              fill={article.favorite ? "currentColor" : "none"}
            />
          </button>
          <button
            className="icon-button"
            aria-label="文章更多操作"
            onClick={() => setDetails(true)}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>
      {preferences && (
        <ReaderDialog title="阅读设置" onClose={() => setPreferences(false)}>
          <div className="reader-preferences">
            <label htmlFor="reader-size">阅读字号</label>
            <select
              id="reader-size"
              value={Number(readerSettings?.value || 18)}
              onChange={(e) =>
                void db.settings.put({
                  key: "fontSize",
                  value: Number(e.target.value),
                })
              }
            >
              {[16, 18, 20, 22, 26, 30, 36].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => setPreferences(false)}
            >
              完成
            </button>
          </div>
          <label className="reader-setting-row">
            行间距
            <select
              aria-label="行间距"
              value={Number(spacing?.value || 1.8)}
              onChange={(e) =>
                void db.settings.put({
                  key: "readerSpacing",
                  value: Number(e.target.value),
                })
              }
            >
              <option value={1.6}>紧凑</option>
              <option value={1.8}>标准</option>
              <option value={2}>宽松</option>
            </select>
          </label>
          <p
            className="reader-settings-preview"
            style={{
              fontSize: Number(readerSettings?.value || 18),
              lineHeight: Number(spacing?.value || 1.8),
            }}
          >
            读懂一个原理，再用一次实践巩固它。
          </p>
        </ReaderDialog>
      )}
      {details && (
        <ReaderDialog title="文章信息" onClose={() => setDetails(false)}>
          <p>
            {date(article.updatedAt)} 更新 · {article.tags.join(" / ")}
          </p>
          {article.sourcePath && (
            <p className="reader-source">
              资料来源：{article.sourcePath}。历史版本与实测边界以章节说明为准。
            </p>
          )}
          <div className="button-row">
            <button
              className="button"
              onClick={() => {
                setDetails(false);
                onHistory();
              }}
            >
              <History size={18} />
              版本历史
            </button>
            <button
              className="button"
              onClick={() => {
                setDetails(false);
                onEdit();
              }}
            >
              <Edit3 size={18} />
              编辑
            </button>
          </div>
        </ReaderDialog>
      )}
      <div className="reading-layout">
        <article
          className={`reading-paper${article.shelfId === "handbook" ? " technical-paper" : ""}`}
        >
          <div className="eyebrow article-kicker">
            {shelf ? kindNames[shelf.kind] : "知识内容"} <span>/</span>{" "}
            {tocItems.length > 0 ? `${tocItems.length} 个小节` : "正文阅读"}
          </div>
          <h1>{article.title}</h1>
          {initialProgress.current > 0 && initialProgress.current < 100 && (
            <button className="resume-link" onClick={resumePosition}>
              跳到上次阅读位置 · {article.progress}%{" "}
              <ArrowDownToLine size={14} />
            </button>
          )}
          {tocItems.length <= 3 && (
            <button
              className="mobile-toc button quiet"
              aria-expanded={toc}

              onClick={() => setToc(!toc)}
            >
              <Menu size={16} />
              本篇目录
            </button>
          )}
          {toc && (
            <ReaderDialog title="本篇目录" onClose={() => setToc(false)}>
              <nav className="reader-toc" aria-label="章节目录">
                {tocItems.map((h, i) => (
                  <button
                    key={i}
                    aria-current={i === activeHeading ? "location" : undefined}
                    onClick={() => jumpToHeading(i)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {h}
                  </button>
                ))}
              </nav>
            </ReaderDialog>
          )}
          {tocItems.length > 3 && (
            <div className="reader-section-nav" aria-label="小节导航">
              <button
                aria-label="上一小节"
                disabled={activeHeading === 0}
                onClick={() => jumpToHeading(activeHeading - 1)}
              >
                <ArrowLeft size={17} />
              </button>
              <button onClick={() => setToc(true)}>
                <span>
                  {activeHeading + 1} / {tocItems.length}
                </span>
                <strong>{tocItems[activeHeading]}</strong>
              </button>
              <button
                aria-label="下一小节"
                disabled={activeHeading >= tocItems.length - 1}
                onClick={() => jumpToHeading(activeHeading + 1)}
              >
                <ArrowRight size={17} />
              </button>
            </div>
          )}
          <CourseDisclosures container={content} body={article.body} />
          <div ref={content}>
            <Markdown body={article.body} onAsset={onAsset} onTerm={onTerm} />
          </div>
          <div className="reading-end">
            <span className="eyebrow">读懂，也记下来</span>
            <h3>让这一次阅读，成为下一次的经验。</h3>
            <div className="button-row">
              <button
                className={`button ${article.progress === 100 ? "" : "primary"}`}
                onClick={() => {
                  position.current = article.progress === 100 ? 0 : 100;
                  void patchArticle(article.id, {
                    progress: article.progress === 100 ? 0 : 100,
                  });
                  onToast(
                    article.progress === 100
                      ? "已重新标记为未完成"
                      : "已完成这篇内容",
                  );
                }}
              >
                <CheckCircle2 size={17} />
                {article.progress === 100 ? "已读完 · 重新学习" : "标记已读完"}
              </button>
              <button
                className="button"
                onClick={() => {
                  void patchArticle(article.id, {
                    reviewAt: article.reviewAt ? 0 : Date.now(),
                    reviewLevel: 0,
                  });
                  onToast(
                    article.reviewAt ? "已移出复习列表" : "已加入复习列表",
                  );
                }}
              >
                <RotateCcw size={17} />
                {article.reviewAt ? "移出复习" : "加入复习"}
              </button>
            </div>
          </div>
          <div className="note-panel">
            <button
              className="note-toggle"
              aria-expanded={showNote}
              aria-controls={`note-${article.id}`}
              onClick={() => setShowNote(!showNote)}
            >
              <Edit3 size={17} />
              <strong>我的学习笔记</strong>
              <span>
                {showNote ? "收起" : note ? "查看笔记" : "写下自己的理解"}
              </span>
            </button>
            <Reveal open={showNote} id={`note-${article.id}`}>
              <textarea
                aria-label="学习笔记"
                placeholder="试着用自己的话解释这个知识点，或者记下一次实际应用。"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  noteRef.current = e.target.value;
                  noteDirty.current = true;
                  setNoteState("正在保存…");
                  writeNoteDraft(article.id, e.target.value, noteBase.current);
                }}
                onBlur={() => void saveNote()}
              />
              <small role="status">{noteState || "笔记仅保存在本机"}</small>
              {noteError && (
                <div className="button-row">
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const copy = {
                          ...articleDefaults(
                            article.shelfId,
                            copyTitle(article.title, "（笔记草稿）"),
                          ),
                          body: noteRef.current,
                        };
                        if (copy.body.length > 2 * 1024 * 1024)
                          throw new Error("草稿过长，请先复制到其他文件保存");
                        await db.articles.add(copy);
                        clearNoteDraft(article.id, noteRef.current);
                        noteDirty.current = false;
                        onToast("笔记草稿已另存为文章，原笔记保留");
                        go(`article/${copy.id}`);
                      } catch (e) {
                        onToast(message(e));
                      }
                    }}
                  >
                    草稿另存为文章
                  </button>
                  <button
                    className="button quiet"
                    onClick={async () => {
                      try {
                        const latest = await db.articles.get(article.id);
                        if (!latest) throw new Error("文章不存在");
                        clearNoteDraft(article.id, noteRef.current);
                        noteDirty.current = false;
                        noteBase.current = latest.note;
                        noteRef.current = latest.note;
                        setNote(latest.note);
                        setNoteError(false);
                        setNoteState("已读取保存的笔记");
                      } catch (e) {
                        onToast(message(e));
                      }
                    }}
                  >
                    放弃草稿，读取已保存笔记
                  </button>
                </div>
              )}
            </Reveal>
          </div>
          {next && (
            <button
              className="next-article"
              onClick={() => go(`article/${next.id}`)}
            >
              <span>
                <small>下一篇</small>
                <strong>{next.title}</strong>
              </span>
              <ArrowRight size={22} />
            </button>
          )}
        </article>
        <aside className="reading-aside">
          <p className="eyebrow">本篇目录</p>
          <nav className="toc">
            {tocItems.map((h, i) => (
              <a
                key={i}
                href={`#section-${i}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`section-${i}`)
                    ?.scrollIntoView({ behavior: scrollBehavior() });
                }}
              >
                {h}
              </a>
            ))}
          </nav>
          <div className="aside-note">
            <BookOpen size={21} />
            <p>
              学习的终点，
              <br />
              是能够独立解决问题。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
export default function App() {
  const route = useRoute(),
    [page, id] = route.split("?")[0].split("/");
  const storedShelves = (useLiveQuery(() => db.shelves.toArray(), []) || []).sort(
      (a, b) =>
        ({ project: 0, course: 1, experience: 2 })[a.kind] -
          { project: 0, course: 1, experience: 2 }[b.kind] ||
        b.createdAt - a.createdAt,
    ),
    all = useLiveQuery(() => db.articles.toArray(), []) || [],
    settings = useLiveQuery(() => db.settings.toArray(), []) || [];
  const articles = all.filter((a) => !a.deletedAt);
  const shelves = storedShelves.filter(s => !retiredShelfIds.has(s.id) || articles.some(a => a.shelfId === s.id));
  const [query, setQuery] = useState(""),
    [modal, setModalState] = useState<
      "new" | "shelf" | "import" | "history" | "asset" | "term" | null
    >(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(""),
    [pendingImport, setPendingImport] = useState<ImportData | null>(null),
    [asset, setAsset] = useState<Attachment | null>(null),
    [assetText, setAssetText] = useState(""),
    [history, setHistory] = useState<Revision[]>([]);
  const modalOrigin = useRef<HTMLElement | null>(null);
  const [termId, setTermId] = useState("");
  function openTerm(key: string) {
    if (!getTerm(key)) return;
    setTermId(key);
    setModal("term");
  }
  function setModal(next: typeof modal) {
    if (next && !modal)
      modalOrigin.current = document.activeElement as HTMLElement;
    setModalState(next);
  }
  const main = useRef<HTMLElement>(null);
  useEnterMotion(
    main,
    query.trim() ? "search" : route.split("?")[0],
    shelves.length > 0,
  );
  const [shelfKind, setShelfKind] = useState<ShelfKind>("project"),
    [draftTitle, setDraftTitle] = useState(""),
    [draftDesc, setDraftDesc] = useState(""),
    [selectedShelf, setSelectedShelf] = useState(""),
    [searchOpen, setSearchOpenState] = useState(false),
    [filter, setFilter] = useState("all"),
    [shelfView, setShelfView] = useState<"path" | "all">("path");
  const setSearchOpen = (open: boolean) => {
    if (open !== searchOpen) prepareChromeMorph();
    setSearchOpenState(open);
  };
  const searchInput = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    mdInput = useRef<HTMLInputElement>(null);
  const active = all.find((a) => a.id === id),
    shelf = shelves.find((s) => s.id === id);
  const readingBook = getTextbook(active?.shelfId || '');
  const installedContent = settings.find(s => s.key === 'builtinContent')?.value;
  const readingSiblings = readingBook
    ? [readingBook.overviewId, ...readingBook.chapters.map(c => c.id)]
      .map(key => articles.find(a => a.id === bundledTarget(key, installedContent, all)))
      .filter((a): a is Article => !!a)
    : articles.filter(a => a.shelfId === active?.shelfId).sort((a,b) => a.order - b.order);
  const currentKind =
    page === "shelf"
      ? shelf?.kind
      : page === "article" || page === "edit"
        ? shelves.find((s) => s.id === active?.shelfId)?.kind
        : undefined;
  // Reading chrome follows the document route, independent of its shelf category.
  const reading = page === "article";
  const { readingDockOpen, openReadingDock } = useChromeMotion(
    route,
    searchOpen || !!modal,
    page === "edit",
    reading,
  );
  const activeNav = currentKind
    ? currentKind === "course"
      ? "home"
      : "library"
    : ["projects", "experiences", "favorites", "trash", "library"].includes(
          page,
        )
      ? "library"
      : page === "courses"
        ? "home"
        : page;
  const lastBackup = settings.find((s) => s.key === "lastBackup")?.value as
    number | undefined;
  const theme = String(
    settings.find((s) => s.key === "theme")?.value || "light",
  );
  const fontSize = Number(
    settings.find((s) => s.key === "fontSize")?.value || 18,
  );
  const recent = [...articles]
    .filter((a) => a.lastReadAt > 0)
    .sort((a, b) => b.lastReadAt - a.lastReadAt);
  const continueArticle =
    recent.find((a) => a.progress < 100) ||
    recent[0] ||
    articles.find((a) => a.shelfId === "handbook" && a.order === 0) ||
    articles[0];
  const due = articles.filter(
    (a) => a.reviewAt > 0 && a.reviewAt <= Date.now(),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty(
      "--reading-size",
      `${fontSize}px`,
    );
  }, [theme, fontSize]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setQuery("");
    setSearchOpen(false);
    setFilter("all");
    setShelfView("path");
    setModal(null);
  }, [route]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const backState = useRef({ modal, query, busy, searchOpen });
  backState.current = { modal, query, busy, searchOpen };
  useEffect(() => {
    if (!native) return;
    const listener = NativeApp.addListener("backButton", ({ canGoBack }) => {
      if (backState.current.busy) return;
      if (backState.current.modal) {
        setModal(null);
        return;
      }
      if (backState.current.query || backState.current.searchOpen) {
        setQuery("");
        setSearchOpen(false);
        return;
      }
      const event = new Event("zhizhan:back", { cancelable: true });
      if (!window.dispatchEvent(event)) return;
      if (location.hash && location.hash !== "#home") {
        if (canGoBack) window.history.back();
        else go("home");
      } else void NativeApp.minimizeApp();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, []);
  const actionActive = useRef(false);
  async function run(action: () => Promise<void>) {
    if (actionActive.current) return;
    actionActive.current = true;
    try {
      await action();
    } catch (e) {
      setToast(message(e));
    } finally {
      actionActive.current = false;
      setBusy("");
    }
  }
  function newArticle() {
    setDraftTitle("");
    setSelectedShelf(shelf?.id || shelves[0]?.id || "");
    setModal("new");
  }
  function newShelf(kind: ShelfKind = "project") {
    setDraftTitle("");
    setDraftDesc("");
    setShelfKind(kind);
    setModal("shelf");
  }
  async function openAsset(key: string) {
    await run(async () => {
      const a = await db.attachments.get(key);
      if (!a) throw new Error("附件未找到，请确认导入了完整资料包");
      setAsset(a);
      setAssetText(
        /^(text\/|application\/json)/.test(a.mime) && a.size <= 3 * 1024 * 1024
          ? await a.data.text()
          : "",
      );
      setModal("asset");
    });
  }
  async function backup() {
    setBusy("正在打包文章与附件…");
    await run(async () => {
      const blob = await exportArchive();
      await saveFile(
        `知栈备份-${new Date().toISOString().slice(0, 10)}.zip`,
        blob,
      );
      await db.settings.put({ key: "lastBackup", value: Date.now() });
      setToast(native ? "备份已保存" : "已交给浏览器下载，请确认文件已保存");
    });
  }
  async function selectArchive(file?: File) {
    if (!file) return;
    setBusy("正在校验资料包…");
    await run(async () => {
      setPendingImport(await inspectArchive(file));
      setModal("import");
    });
  }
  async function loadHistory() {
    if (!active) return;
    await run(async () => {
      setHistory(
        (
          await db.revisions
            .where("articleId")
            .equals(active.id)
            .sortBy("savedAt")
        ).reverse(),
      );
      setModal("history");
    });
  }
  const nav = [
    { key: "home", label: "学习", icon: BookOpen },
    { key: "library", label: "资料库", icon: FolderOpen },
    { key: "review", label: "复习", icon: RotateCcw },
    { key: "settings", label: "我的", icon: Settings },
  ];
  function rows(list: Article[]) {
    return (
      <div className="article-list">
        {list.slice(0, 150).map((a) => (
          <ArticleRow
            key={a.id}
            a={a}
            shelf={shelves.find((s) => s.id === a.shelfId)}
            onFavorite={() =>
              void run(async () => {
                await patchArticle(a.id, { favorite: !a.favorite });
              })
            }
          />
        ))}
        {list.length > 150 && (
          <p className="muted">显示前 150 项，请搜索以缩小范围。</p>
        )}
      </div>
    );
  }
  const pageTitle =
    (
      {
        home: "学习",
        library: "资料库",
        projects: "项目档案",
        courses: "技术课程",
        experiences: "问题与经验",
        review: "复习清单",
        favorites: "我的收藏",
        settings: "设置与资料",
        trash: "回收站",
      } as Record<string, string>
    )[page] ||
    shelf?.title ||
    "知识阅读";
  const originalBook = page === 'original' ? getTextbook(id) : undefined;
  if (originalBook) return <OriginalBookReader key={route} book={originalBook} articles={articles}
    section={new URLSearchParams(route.split('?')[1] || '').get('section') || ''} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home">
          <img src="/icon.svg" alt="" />
          <span>
            知栈<small>个人技术知识库</small>
          </span>
        </a>
        <SelectionGroup
          as="nav"
          className="sidebar-navigation"
          label="主导航"
          value={activeNav}
        >
          {nav.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${activeNav === n.key ? "selected" : ""}`}
              aria-current={activeNav === n.key ? "page" : undefined}
              onClick={() => go(n.key)}
            >
              <n.icon size={19} />
              {n.label}
              {n.key === "review" && due.length > 0 && (
                <span className="count">{due.length}</span>
              )}
            </button>
          ))}
        </SelectionGroup>
        <div className="sidebar-divider" />
        <button
          className={`nav-item ${page === "favorites" ? "selected" : ""}`}
          onClick={() => go("favorites")}
        >
          <Bookmark size={18} />
          我的收藏
          <span className="count plain">
            {articles.filter((a) => a.favorite).length}
          </span>
        </button>
        <button
          className={`nav-item ${page === "trash" ? "selected" : ""}`}
          onClick={() => go("trash")}
        >
          <Trash2 size={18} />
          回收站
        </button>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="status-dot" />
            <strong>本地知识，随时可读</strong>
            <p>离线使用 · 资料由你保管</p>
          </div>
        </div>
      </aside>
      <div className="workspace" data-page={page}>
        <header className={`topbar ${searchOpen ? "search-open" : ""}`}>
          <div className="topbar-surface">
            <GlassMaterial />
            <a className="mobile-brand" href="#home" aria-label="知栈首页">
              <img src="/icon.svg" alt="" />
              <span>
                {page === "home"
                  ? "知栈"
                  : page === "article" || page === "edit"
                    ? "阅读与记录"
                    : pageTitle}
              </span>
            </a>
            <span className="breadcrumb">
              我的空间 <ChevronRight size={13} /> <strong>{pageTitle}</strong>
            </span>
            <button
              className="icon-button search-trigger"
              aria-label="打开搜索"
              onClick={() => {
                setSearchOpen(true);
                requestAnimationFrame(() => searchInput.current?.focus());
              }}
            >
              <Search size={21} />
            </button>
            <div className="search-box">
              <Search size={17} />
              <input
                ref={searchInput}
                aria-label="搜索全部知识"
                placeholder="搜索知识、代码、笔记…"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setSearchOpen(false);
                  }
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button aria-label="清除搜索" onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              ) : (
                <kbd>Ctrl K</kbd>
              )}
            </div>
            <button
              className="search-cancel text-button"
              onClick={() => {
                setQuery("");
                setSearchOpen(false);
              }}
            >
              取消
            </button>
            <button
              className="icon-button settings-mobile"
              aria-label="设置与资料"
              onClick={() => go("settings")}
            >
              <Settings size={20} />
            </button>
            <button
              className="avatar"
              title="个人本地空间"
              onClick={() => go("settings")}
            >
              知
            </button>
          </div>
        </header>
        <main
          ref={main}
          className={page === "edit" ? "main editor-main" : "main"}
        >
          {page !== "edit" && <UpdateNotice />}
          {query.trim() ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">搜索整个知识库</span>
                  <h1>找到你需要的知识</h1>
                  <p>
                    “{query}” · {searchArticles(articles, query).length}{" "}
                    条结果，包含正文、标签和笔记
                  </p>
                </div>
              </div>
              {searchArticles(articles, query).length ? (
                rows(searchArticles(articles, query))
              ) : (
                <Empty
                  title="还没有找到相关内容"
                  detail="换一个关键词，或者把这次经验记录下来。"
                />
              )}
            </>
          ) : page === "edit" && active ? (
            <Editor
              key={active.id}
              article={active}
              shelves={shelves}
              onDone={(key) => go(`article/${key}`)}
              onAsset={(key) => void openAsset(key)}
            />
          ) : page === "article" && active && !active.deletedAt ? (
            <Reading
              key={active.id}
              article={active}
              shelf={shelves.find((s) => s.id === active.shelfId)}
              siblings={readingSiblings}
              onEdit={() => go(`edit/${active.id}`)}
              onAsset={(key) => void openAsset(key)}
              onToast={setToast}
              onHistory={() => void loadHistory()}
              onTerm={openTerm}
              resume={
                new URLSearchParams(route.split("?")[1] || "").get("resume") ===
                "1"
              }
              section={
                new URLSearchParams(route.split("?")[1] || "").get("section") ||
                ""
              }
            />
          ) : page === "home" ? (
            <LearningHome
              shelves={shelves}
              articles={articles}
              recent={recent}
              current={continueArticle}
              due={due.length}
              onNew={newArticle}
            />
          ) : page === "library" ? (
            <LibraryView
              shelves={shelves}
              articles={articles}
              onShelf={newShelf}
              onNew={newArticle}
            />
          ) : page === "courses" ? (
            <TextbookLibrary
              articles={articles}
              shelves={shelves}
              onCreate={() => newShelf("course")}
            />
          ) : ["projects", "experiences"].includes(page) ? (
            (() => {
              const kind: ShelfKind =
                page === "projects"
                  ? "project"
                  : page === "courses"
                    ? "course"
                    : "experience";
              const list = shelves.filter((s) => s.kind === kind);
              return (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>{kindNames[kind]}</h1>
                      <p>
                        {kind === "course"
                          ? "从原理到实践"
                          : kind === "project"
                            ? "需求、实现与验证"
                            : "问题、排查与解决"}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => newShelf(kind)}
                    >
                      <Plus size={18} />
                      新建{kind === "course" ? "课程" : "知识库"}
                    </button>
                  </div>
                  <div className="shelf-grid library-shelves">
                    {list.map((s) => (
                      <ShelfCard
                        key={s.id}
                        s={s}
                        articles={articles.filter((a) => a.shelfId === s.id)}
                      />
                    ))}
                  </div>
                  {!list.length && (
                    <Empty
                      title="从第一份记录开始"
                      detail="创建知识库，再添加文章、代码、图片和附件。"
                      action={
                        <button
                          className="button primary"
                          onClick={() => newShelf(kind)}
                        >
                          新建知识库
                        </button>
                      }
                    />
                  )}
                </>
              );
            })()
          ) : page === "shelf" && shelf && getTextbook(shelf.id) ? (
            <TextbookContents
              book={getTextbook(shelf.id)!}
              articles={articles.filter((a) => a.shelfId === shelf.id)}
            />
          ) : page === "shelf" && shelf ? (
            <>
              <div
                className={`page-heading shelf-heading ${shelf.kind === "course" ? "course-heading" : ""}`}
              >
                <CoverArt shelf={shelf} compact />
                <div>
                  <span className="eyebrow">{kindNames[shelf.kind]}</span>
                  <h1>{shelf.title}</h1>
                  <p>{shelf.description}</p>
                </div>
                {shelf.kind !== "course" && (
                  <button className="button primary" onClick={newArticle}>
                    <Plus size={18} />
                    添加内容
                  </button>
                )}
              </div>
              {hasCoursePath(shelf.id) && (
                <SelectionGroup
                  className="shelf-view-tabs"
                  label="课程浏览方式"
                  value={shelfView}
                >
                  <button
                    aria-pressed={shelfView === "path"}
                    onClick={() => setShelfView("path")}
                  >
                    <GraduationCap size={18} />
                    学习路径
                  </button>
                  <button
                    aria-pressed={shelfView === "all"}
                    onClick={() => setShelfView("all")}
                  >
                    <Menu size={18} />
                    全部章节
                  </button>
                </SelectionGroup>
              )}
              {hasCoursePath(shelf.id) && shelfView === "path" && (
                <CoursePath
                  id={shelf.id}
                  articles={articles.filter((a) => a.shelfId === shelf.id)}
                />
              )}
              {!(hasCoursePath(shelf.id) && shelfView === "path") && (
                <>
                  <div className="filter-bar">
                    {[
                      ["all", "全部内容"],
                      ["unread", "尚未读完"],
                      ["done", "已读完成"],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={filter === k ? "selected" : ""}
                        onClick={() => setFilter(k)}
                      >
                        {l}
                      </button>
                    ))}
                    <span>
                      {articles.filter((a) => a.shelfId === shelf.id).length} 篇
                    </span>
                  </div>
                  {rows(
                    articles
                      .filter(
                        (a) =>
                          a.shelfId === shelf.id &&
                          (filter === "all" ||
                            (filter === "done"
                              ? a.progress === 100
                              : a.progress < 100)),
                      )
                      .sort((a, b) => a.order - b.order),
                  )}
                </>
              )}
              {!articles.some((a) => a.shelfId === shelf.id) && (
                <Empty
                  title="知识库已经准备好了"
                  detail="点击添加内容，记录第一篇文章。"
                />
              )}
              <div className="shelf-tools">
                {shelf.kind === "course" && (
                  <button className="text-button" onClick={newArticle}>
                    <Plus size={17} />
                    添加课程内容
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setDraftTitle(shelf.title);
                    setDraftDesc(shelf.description);
                    setShelfKind(shelf.kind);
                    setModal("shelf");
                  }}
                >
                  编辑知识库信息 <Edit3 size={15} />
                </button>
              </div>
            </>
          ) : page === "favorites" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">值得反复翻阅</span>
                  <h1>我的收藏</h1>
                  <p>把常用的知识和重要的经验放在手边。</p>
                </div>
              </div>
              {articles.some((a) => a.favorite) ? (
                rows(articles.filter((a) => a.favorite))
              ) : (
                <Empty
                  title="收藏你的第一篇内容"
                  icon={Bookmark}
                  detail="阅读时点击书签图标，就能在这里快速找到它。"
                />
              )}
            </>
          ) : page === "review" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>复习清单</h1>
                  <p>先回想，再核对。按掌握程度安排下一次回顾。</p>
                </div>
              </div>
              {due.length ? (
                due.map((a) => (
                  <div className="review-item" key={a.id}>
                    <div>
                      <span className="tag">
                        {a.reviewLevel === 0
                          ? "首次回顾"
                          : `第 ${a.reviewLevel + 1} 阶段`}
                      </span>
                      <h3>{a.title}</h3>
                      <p>{shelves.find((s) => s.id === a.shelfId)?.title}</p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button"
                        onClick={() => go(`article/${a.id}`)}
                      >
                        打开原文
                      </button>
                      <button
                        className="button"
                        onClick={() =>
                          void patchArticle(
                            a.id,
                            nextReview(a.reviewLevel, false),
                          )
                        }
                      >
                        再学一次
                      </button>
                      <button
                        className="button primary"
                        onClick={() =>
                          void patchArticle(
                            a.id,
                            nextReview(a.reviewLevel, true),
                          )
                        }
                      >
                        <Check size={15} />
                        已掌握
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="今天没有待复习的内容"
                  icon={RotateCcw}
                  detail="阅读文章时点击“加入复习”，或等到已安排的下一次复习日期。"
                />
              )}
              {articles.some((a) => a.reviewAt > Date.now()) && (
                <>
                  <div className="section-heading">
                    <h2>之后的复习</h2>
                  </div>
                  {articles
                    .filter((a) => a.reviewAt > Date.now())
                    .sort((a, b) => a.reviewAt - b.reviewAt)
                    .map((a) => (
                      <button
                        className="upcoming"
                        key={a.id}
                        onClick={() => go(`article/${a.id}`)}
                      >
                        <span>{a.title}</span>
                        <small>{date(a.reviewAt)}</small>
                      </button>
                    ))}
                </>
              )}
            </>
          ) : page === "trash" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>回收站</h1>
                  <p>
                    移入回收站的文章仍保留笔记、附件与历史版本，可以随时恢复。
                  </p>
                </div>
              </div>
              {all
                .filter((a) => a.deletedAt)
                .map((a) => (
                  <div className="trash-row" key={a.id}>
                    <FileText size={20} />
                    <span>{a.title}</span>
                    <button
                      className="button"
                      onClick={() =>
                        void run(async () => {
                          await patchArticle(a.id, { deletedAt: 0 });
                          setToast("文章已恢复");
                        })
                      }
                    >
                      <RotateCcw size={15} />
                      恢复
                    </button>
                  </div>
                ))}
              {!all.some((a) => a.deletedAt) && (
                <Empty
                  title="回收站是空的"
                  icon={Trash2}
                  detail="你的内容都在各自的知识库中。"
                />
              )}
            </>
          ) : page === "settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>设置与资料</h1>
                  <p>阅读偏好与本地资料</p>
                </div>
              </div>
              <div className="settings-jumps" aria-label="常用设置">
                <button onClick={() => go("favorites")}>
                  <Bookmark size={20} />
                  <span>查看我的收藏</span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => go("trash")}>
                  <Trash2 size={20} />
                  <span>打开回收站</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById("software-update")
                      ?.scrollIntoView({ behavior: scrollBehavior() })
                  }
                >
                  <Download size={20} />
                  <span>软件更新</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById("backup-settings")
                      ?.scrollIntoView({ behavior: scrollBehavior() })
                  }
                >
                  <HardDrive size={20} />
                  <span>备份与导入</span>
                  <ChevronRight size={16} />
                </button>
              </div>
              <section className="settings-card">
                <h2>
                  <BookOpen size={21} />
                  阅读偏好
                </h2>
                <div className="setting-row">
                  <div>
                    <strong>界面主题</strong>
                    <small>选择适合当前环境的阅读颜色</small>
                  </div>
                  <SelectionGroup
                    className="segmented"
                    label="界面主题"
                    value={theme}
                  >
                    {[
                      ["light", "浅色"],
                      ["dark", "深色"],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={theme === k ? "selected" : ""}
                        aria-pressed={theme === k}
                        onClick={() =>
                          void db.settings.put({ key: "theme", value: k })
                        }
                      >
                        {k === "light" ? <Sun size={15} /> : <Moon size={15} />}{" "}
                        {l}
                      </button>
                    ))}
                  </SelectionGroup>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>正文字号</strong>
                    <small>应用于文章和课程内容</small>
                  </div>
                  <select
                    aria-label="正文字号"
                    value={fontSize}
                    onChange={(e) =>
                      void db.settings.put({
                        key: "fontSize",
                        value: Number(e.target.value),
                      })
                    }
                  >
                    {[16, 18, 20, 22, 26, 30, 36].map((n) => (
                      <option key={n} value={n}>
                        {n} px
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="reading-preview"
                  style={{ fontSize }}
                  aria-label="正文字号预览"
                >
                  <span>阅读预览</span>
                  把做过的项目，变成自己的知识。
                </div>
              </section>
              <section id="backup-settings" className="settings-card">
                <h2>
                  <HardDrive size={21} />
                  备份与导入
                </h2>
                <div className="backup-callout">
                  <ShieldCheck size={25} />
                  <div>
                    <strong>
                      {lastBackup
                        ? `上次发起导出：${date(lastBackup)}`
                        : "还没有导出过备份"}
                    </strong>
                    <p>
                      卸载应用或清除浏览器数据会删除本机资料。请定期导出，并确认备份文件已保存到安全的位置。
                    </p>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>完整资料包</strong>
                    <small>包括正文、附件、笔记、学习进度和历史版本</small>
                  </div>
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => void backup()}
                  >
                    <Download size={17} />
                    导出备份
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>导入知栈资料包</strong>
                    <small>支持 ZIP；先校验，内容冲突时保留副本</small>
                  </div>
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={() => importInput.current?.click()}
                  >
                    <Upload size={17} />
                    导入资料包
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>导入 Markdown 与附件</strong>
                    <small>同时选择文章和图片；导入后进入独立知识库</small>
                  </div>
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={() => mdInput.current?.click()}
                  >
                    <FileText size={17} />
                    导入文件
                  </button>
                </div>
                <input
                  type="file"
                  ref={importInput}
                  hidden
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    void selectArchive(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  type="file"
                  ref={mdInput}
                  hidden
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    setBusy("正在导入文件…");
                    void run(async () => {
                      const result = await importMarkdown(files);
                      setToast(`已导入 ${result.count} 篇文章`);
                      go(`shelf/${result.shelfId}`);
                    });
                  }}
                />
              </section>
              <section className="settings-card">
                <h2>
                  <Code2 size={21} />
                  内置学习资料
                </h2>
                <p>
                  课程包含学习路线、完整实验、预期结果与自测答案。阅读完成不代表练习已经通过。
                </p>
                <p className="muted">
                  C++ 示例已在桌面编译运行；Linux
                  实验提供环境要求与验证步骤，尚未在开发板实测。项目实录是有版本边界的工程案例。
                </p>
                <div className="setting-row">
                  <div>
                    <strong>更新随应用提供的课程与案例</strong>
                    <small>
                      笔记和进度保留；改过的文章保留原文，另存“内置新版”；回收站内容不恢复。建议更新前导出备份。
                    </small>
                  </div>
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={() =>
                      void run(async () => {
                        setBusy("正在校验并更新内置资料…");
                        const result = await updateBundledContent();
                        setToast(
                          result.updated + result.added + result.copies
                            ? `内置资料更新完成：更新 ${result.updated} 篇，新增 ${result.added} 篇，新版副本 ${result.copies} 篇`
                            : "内置资料已是本版内容，个人修改保持不变",
                        );
                      })
                    }
                  >
                    <RotateCcw size={17} />
                    更新内置资料
                  </button>
                </div>
              </section>
              <section className="settings-card">
                <h2>
                  <Code2 size={21} />
                  关于知栈
                </h2>
                <p className="muted">版本 {version} · 个人技术知识库</p>
                <button
                  className="text-button"
                  onClick={() =>
                    void run(async () => {
                      const response = await fetch("./NOTICE.txt");
                      if (!response.ok) throw new Error("开源声明读取失败");
                      const text = await response.text();
                      const data = new Blob([text], { type: "text/plain" });
                      setAsset({
                        id: "licenses",
                        name: "开源组件与许可证",
                        mime: "text/plain",
                        size: data.size,
                        data,
                      });
                      setAssetText(text);
                      setModal("asset");
                    })
                  }
                >
                  查看开源组件与许可证 <FileText size={15} />
                </button>
                <p>
                  项目经验、系统课程和自己的思考，都可以在这里持续整理。首版离线使用，无账号、无同步、无
                  AI 服务。
                </p>
                <div className="info-chips">
                  <span>{shelves.length} 个知识库</span>
                  <span>{articles.length} 篇内容</span>
                  <span>资料仅保存在当前设备</span>
                </div>
              </section>
              <UpdateSettings />
            </>
          ) : (
            <Empty
              title="内容暂时无法打开"
              detail="文章可能已移入回收站，或者资料尚未导入。"
              action={
                <button className="button" onClick={() => go("home")}>
                  回到学习空间
                </button>
              }
            />
          )}
          {page === "article" && active && !query && (
            <div className="reader-extra">
              <button
                className="text-button"
                onClick={() =>
                  void run(async () => {
                    await saveFile(
                      `${active.title.replace(/[<>:"/\\|?*]/g, "_")}.md`,
                      new Blob(
                        [
                          `# ${active.title}\n\n${active.body}\n\n## 我的笔记\n\n${active.note}`,
                        ],
                        { type: "text/markdown" },
                      ),
                    );
                  })
                }
              >
                <Download size={15} />
                导出 Markdown
              </button>
              <button
                className="text-button danger"
                onClick={() =>
                  void run(async () => {
                    await patchArticle(active.id, {
                      deletedAt: Date.now(),
                      version: active.version + 1,
                    });
                    go(`shelf/${active.shelfId}`);
                    setToast("已移入回收站，可在回收站恢复");
                  })
                }
              >
                <Trash2 size={15} />
                移入回收站
              </button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>知栈 {version}</span>
          <span>
            <span className="status-dot" />
            离线可用
          </span>
        </footer>
      </div>
      <SelectionGroup
        as="nav"
        className={`bottom-nav${reading ? ` reader-dock ${readingDockOpen ? "is-open" : "is-orb"}` : ""}`}
        label="手机导航"
        value={activeNav}
        accessory={
          <button
            className="reading-nav-orb"
            aria-label="展开阅读导航"
            aria-expanded={readingDockOpen}
            inert={!reading || readingDockOpen}
            onClick={(event) => openReadingDock(event.detail === 0)}
          >
            <MoreHorizontal size={18} strokeWidth={1.8} />
          </button>
        }
      >
        {nav.map((n) => (
          <button
            key={n.key}
            className={`nav-destination${activeNav === n.key ? " selected" : ""}`}
            inert={reading && !readingDockOpen}
            aria-current={activeNav === n.key ? "page" : undefined}
            aria-label={n.label}
            onClick={() => {
              go(n.key);
              window.dispatchEvent(new Event("zhizhan:reveal-chrome"));
            }}
          >
            <span className="nav-glyph">
              <n.icon size={22} strokeWidth={1.8} />
            </span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </SelectionGroup>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      {modal === "new" && (
        <Modal
          returnFocus={modalOrigin.current}
          title="记录新知识"
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!selectedShelf) throw new Error("请先创建知识库");
                const a = articleDefaults(
                  selectedShelf,
                  draftTitle.trim() || "未命名文章",
                );
                a.body =
                  templates[
                    shelves.find((s) => s.id === selectedShelf)?.kind ||
                      "project"
                  ];
                await db.articles.add(a);
                setModal(null);
                go(`edit/${a.id}`);
              });
            }}
          >
            <label>
              文章标题
              <input
                autoFocus
                value={draftTitle}
                maxLength={300}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="例如：一次内存泄漏问题的排查记录"
              />
            </label>
            <label>
              保存到
              <select
                value={selectedShelf}
                onChange={(e) => setSelectedShelf(e.target.value)}
              >
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              根据知识库类型，自动准备项目、课程或问题排查模板。
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button className="button primary" type="submit">
                创建并编辑 <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "shelf" && (
        <Modal
          returnFocus={modalOrigin.current}
          title={page === "shelf" ? "编辑知识库" : "新建知识库"}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!draftTitle.trim()) throw new Error("请输入知识库名称");
                const value: Shelf = {
                  id: page === "shelf" && shelf ? shelf.id : uid(),
                  title: draftTitle.trim(),
                  description: draftDesc.trim(),
                  kind: shelfKind,
                  color: {
                    project: "#386557",
                    course: "#866747",
                    experience: "#7c6395",
                  }[shelfKind],
                  createdAt: shelf?.createdAt || Date.now(),
                };
                await db.shelves.put(value);
                setModal(null);
                go(`shelf/${value.id}`);
              });
            }}
          >
            <label>
              类型
              <select
                value={shelfKind}
                onChange={(e) => setShelfKind(e.target.value as ShelfKind)}
              >
                {Object.entries(kindNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              名称
              <input
                autoFocus
                required
                maxLength={150}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="例如：我的 Linux 驱动开发实践"
              />
            </label>
            <label>
              简介
              <textarea
                maxLength={2000}
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="这个知识库要解决什么问题？"
              />
            </label>
            <div className="modal-actions">
              <button className="button primary" type="submit">
                保存知识库
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "import" && pendingImport && (
        <Modal
          returnFocus={modalOrigin.current}
          title="导入资料包"
          onClose={() => setModal(null)}
        >
          <p>校验已通过。导入包含：</p>
          <div className="import-counts">
            <div>
              <strong>{pendingImport.manifest.shelves.length}</strong>知识库
            </div>
            <div>
              <strong>{pendingImport.manifest.articles.length}</strong>文章
            </div>
            <div>
              <strong>{pendingImport.attachments.length}</strong>附件
            </div>
          </div>
          <p className="muted">
            完全相同的文章会跳过；同 ID
            但内容不同的文章会作为“导入副本”保留。现有内容不会被覆盖。
          </p>
          <div className="modal-actions">
            <button
              className="button"
              disabled={!!busy}
              onClick={() => setModal(null)}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() => {
                setBusy("正在保存导入资料…");
                void run(async () => {
                  const r = await importArchive(pendingImport);
                  setModal(null);
                  setPendingImport(null);
                  setToast(
                    `导入完成：新增 ${r.added} 篇，跳过 ${r.skipped} 篇，其中冲突副本 ${r.copies} 篇`,
                  );
                });
              }}
            >
              确认导入
            </button>
          </div>
        </Modal>
      )}
      {modal === "history" && (
        <Modal
          returnFocus={modalOrigin.current}
          title="文章版本历史"
          onClose={() => setModal(null)}
        >
          <p className="muted">
            保留最近 30 个正文编辑版本。恢复会先保存当前版本。
          </p>
          {history.length ? (
            history.map((r) => (
              <div className="history-row" key={r.id}>
                <div>
                  <strong>{r.article.title}</strong>
                  <small>
                    {new Date(r.savedAt).toLocaleString("zh-CN")} ·{" "}
                    {r.article.body.length} 字符
                  </small>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    void run(async () => {
                      if (!active) return;
                      const current = await db.articles.get(active.id);
                      if (!current) return;
                      await saveArticle(
                        {
                          ...current,
                          title: r.article.title,
                          body: r.article.body,
                          tags: r.article.tags,
                        },
                        current.version,
                      );
                      setModal(null);
                      setToast("历史版本已恢复");
                    })
                  }
                >
                  恢复
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="还没有历史版本"
              detail="编辑保存后，旧版本会出现在这里。"
            />
          )}
        </Modal>
      )}
      {modal === "term" && getTerm(termId) && (
        <Modal
          variant="term"
          returnFocus={modalOrigin.current}
          title={getTerm(termId)!.title}
          onClose={() => setModal(null)}
        >
          <Glossary
            id={termId}
            onTerm={openTerm}
            onRead={(chapter) => {
              setModal(null);
              go(`article/${chapter}`);
            }}
          />
        </Modal>
      )}
      {modal === "asset" && asset && (
        <Modal
          returnFocus={modalOrigin.current}
          title={asset.name}
          onClose={() => setModal(null)}
        >
          <p className="muted">
            {size(asset.size)} · {asset.mime}
          </p>
          {assetText ? (
            <pre className="asset-code">{assetText}</pre>
          ) : (
            <p>附件已保存在本机，可导出后使用对应的应用打开。</p>
          )}
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() =>
                void run(async () => {
                  await saveFile(asset.name, asset.data, asset.mime);
                  setToast("附件已交给系统保存");
                })
              }
            >
              <Download size={17} />
              保存附件
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
