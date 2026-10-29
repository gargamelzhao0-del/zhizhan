import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  FilePlus,
  Paperclip,
  Save,
  Type,
  Code2,
  List,
  Table2,
} from "lucide-react";
import { articleDefaults, uid, type Article, type Shelf } from "./model";
import { db, readDraft, saveArticle } from "./db";
import { Markdown } from "./Markdown";
import { message } from "./platform";
import { copyTitle } from "./links";
import { useEnterMotion } from "./motion";
export function Editor({
  article,
  shelves,
  onDone,
  onAsset,
}: {
  article: Article;
  shelves: Shelf[];
  onDone: (id: string) => void;
  onAsset: (id: string) => void;
}) {
  const recovered = useRef(readDraft(article.id));
  const [draft, setDraft] = useState<Article>(recovered.current || article);
  const [tagInput, setTagInput] = useState(draft.tags.join(", "));
  const ref = useRef(draft),
    version = useRef((recovered.current || article).version),
    dirty = useRef(!!recovered.current),
    saving = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState(
      recovered.current ? "已恢复未保存草稿" : "所有修改已保存",
    ),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const selection = useRef({ start: 0, end: 0, top: 0 });
  const wasPreview = useRef(false);
  useEnterMotion(surface, preview ? "preview" : "editing");
  function togglePreview() {
    if (!preview && area.current)
      selection.current = {
        start: area.current.selectionStart,
        end: area.current.selectionEnd,
        top: area.current.scrollTop,
      };
    setPreview(!preview);
  }
  useLayoutEffect(() => {
    if (wasPreview.current && !preview && area.current) {
      area.current.focus({ preventScroll: true });
      area.current.setSelectionRange(
        selection.current.start,
        selection.current.end,
      );
      area.current.scrollTop = selection.current.top;
    }
    wasPreview.current = preview;
  }, [preview]);
  function change(patch: Partial<Article>) {
    const next = { ...ref.current, ...patch };
    ref.current = next;
    dirty.current = true;
    setDraft(next);
    setError("");
    setStatus("正在保存…");
    try {
      localStorage.setItem(`draft:${article.id}`, JSON.stringify(next));
    } catch {
      setStatus("正在写入数据库…");
    }
  }
  async function persist(): Promise<boolean> {
    if (saving.current) {
      const ok = await saving.current;
      if (!ok) return false;
      return dirty.current ? persist() : true;
    }
    if (!dirty.current) return true;
    const value = ref.current;
    setStatus("正在保存…");
    saving.current = (async () => {
      try {
        const saved = await saveArticle(value, version.current);
        version.current = saved.version;
        if (ref.current === value) {
          ref.current = saved;
          setDraft(saved);
          dirty.current = false;
          try {
            const stored = readDraft(article.id);
            if (
              stored?.body === value.body &&
              stored?.title === value.title &&
              JSON.stringify(stored?.tags) === JSON.stringify(value.tags)
            )
              localStorage.removeItem(`draft:${article.id}`);
          } catch {
            /* Content has already been committed to IndexedDB. */
          }
          setStatus("所有修改已保存");
        } else {
          ref.current = { ...ref.current, version: saved.version };
          setDraft(ref.current);
          try {
            localStorage.setItem(
              `draft:${article.id}`,
              JSON.stringify(ref.current),
            );
          } catch {
            /* Current content remains in memory. */
          }
        }
        setError("");
        return true;
      } catch (e) {
        setError(message(e));
        setStatus("尚未保存");
        return false;
      }
    })();
    const ok = await saving.current;
    saving.current = null;
    return ok && dirty.current ? persist() : ok;
  }
  useEffect(() => {
    const timer = setTimeout(() => void persist(), 500);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(
    () => () => {
      void persist();
    },
    [],
  );
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") void persist();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
        void persist();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  useEffect(() => {
    const back = (event: Event) => {
      // A media viewer owns back while it is open, regardless of listener order.
      if (event.defaultPrevented || document.querySelector("dialog.reader-dialog[open]")) return;
      event.preventDefault();
      void persist().then((ok) => {
        if (ok) onDone(article.id);
      });
    };
    window.addEventListener("zhizhan:back", back);
    return () => window.removeEventListener("zhizhan:back", back);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void persist();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  function insert(text: string) {
    const el = area.current;
    const start = el?.selectionStart ?? ref.current.body.length,
      end = el?.selectionEnd ?? start;
    change({
      body:
        ref.current.body.slice(0, start) + text + ref.current.body.slice(end),
    });
    setPreview(false);
    setTimeout(() => {
      area.current?.focus();
      area.current?.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }
  async function attach(files: FileList | null) {
    if (!files) return;
    try {
      for (const f of Array.from(files)) {
        if (f.size > 20 * 1024 * 1024) throw new Error("单个附件最大 20 MiB");
        const id = uid();
        const mime = f.type || "application/octet-stream";
        await db.attachments.add({
          id,
          name: f.name,
          mime,
          data: f,
          size: f.size,
        });
        const safeName = f.name.replace(/[\[\]\\\r\n]/g, "_");
        insert(
          `\n${/^image\/(png|jpeg|webp|gif)$/.test(mime) ? "!" : ""}[${safeName}](asset:${id})\n`,
        );
      }
    } catch (e) {
      setError(message(e));
    }
  }
  async function copy() {
    try {
      const a = {
        ...ref.current,
        ...{
          id: uid(),
          title: copyTitle(ref.current.title, "（草稿副本）"),
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
      await db.articles.add(a);
      localStorage.removeItem(`draft:${article.id}`);
      dirty.current = false;
      onDone(a.id);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <section className="editor-view">
      <div className="reader-toolbar">
        <button
          className="button quiet"
          onClick={async () => {
            if (await persist()) onDone(article.id);
          }}
        >
          <ArrowLeft size={18} />
          返回阅读
        </button>
        <span className={`save-state ${error ? "error" : ""}`} role="status">
          {!dirty.current && <Check size={14} />} {status}
        </span>
        <button className="button primary" onClick={() => void persist()}>
          <Save size={16} />
          保存
        </button>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="button" onClick={() => void copy()}>
            <FilePlus size={16} />
            另存草稿副本
          </button>
        </div>
      )}
      <div className="editor-meta">
        <label>
          知识库
          <select
            aria-label="所属知识库"
            value={draft.shelfId}
            onChange={(e) => change({ shelfId: e.target.value })}
          >
            {shelves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          标签
          <input
            aria-label="标签，以逗号分隔"
            placeholder="标签，以逗号分隔"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              change({
                tags: [
                  ...new Set(
                    e.target.value
                      .split(/[,，]/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                ],
              });
            }}
          />
        </label>
      </div>
      <input
        className="title-input"
        aria-label="文章标题"
        placeholder="为这篇文章起一个标题"
        maxLength={300}
        value={draft.title}
        onChange={(e) => change({ title: e.target.value })}
      />
      <div className="format-toolbar">
        <button title="插入标题" onClick={() => insert("\n## 小节标题\n\n")}>
          <Type size={18} />
        </button>
        <button
          title="插入代码"
          onClick={() => insert("\n```cpp\n// 在这里输入代码\n```\n")}
        >
          <Code2 size={18} />
        </button>
        <button
          title="插入列表"
          onClick={() => insert("\n- 第一项\n- 第二项\n")}
        >
          <List size={18} />
        </button>
        <button
          title="插入表格"
          onClick={() =>
            insert("\n| 名称 | 说明 |\n| --- | --- |\n| 项目 | 内容 |\n")
          }
        >
          <Table2 size={18} />
        </button>
        <button title="添加图片或附件" onClick={() => picker.current?.click()}>
          <Paperclip size={18} />
        </button>
        <span className="toolbar-spacer" />
        <button
          className={preview ? "selected" : ""}
          aria-pressed={preview}
          onClick={togglePreview}
        >
          <Eye size={17} />
          {preview ? "继续编辑" : "预览"}
        </button>
      </div>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void attach(e.target.files);
          e.target.value = "";
        }}
      />
      <div ref={surface} className="editor-surface">
        {preview ? (
          <div className="editor-preview">
            <Markdown body={draft.body} onAsset={onAsset} />
          </div>
        ) : (
          <textarea
            ref={area}
            className="body-editor"
            aria-label="文章正文"
            placeholder="从一个问题、一段代码或一次开发经历开始记录…\n\n支持 Markdown，可用上方工具栏插入代码、图片和表格。"
            value={draft.body}
            onChange={(e) => change({ body: e.target.value })}
          />
        )}
      </div>
      <div className="editor-footer">
        <span>Markdown · 本地自动保存</span>
        <span>{draft.body.length.toLocaleString()} 字符</span>
      </div>
    </section>
  );
}
