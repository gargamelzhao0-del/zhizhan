import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Cpu,
  FileText,
  FolderOpen,
  GraduationCap,
  NotebookPen,
  Plus,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { kindNames, type Article, type Shelf, type ShelfKind } from "./model";
import { SelectionGroup } from "./motion";
import { getTextbook, BookCard } from "./Textbooks";
const navigate = (route: string) => {
  location.hash = route;
};

/** Original offline vector artwork shared by covers and continuation cards. */
export function CoverArt({
  shelf,
  compact = false,
}: {
  shelf?: Shelf;
  compact?: boolean;
}) {
  const variant =
    shelf?.id === "cpp"
      ? "cpp"
      : shelf?.id === "linux"
        ? "linux"
        : shelf?.kind === "project"
          ? "project"
          : shelf?.kind === "course"
            ? "course"
            : "notes";
  const Icon =
    variant === "cpp"
      ? Code2
      : variant === "linux"
        ? Terminal
        : variant === "project"
          ? Cpu
          : variant === "course"
            ? GraduationCap
            : NotebookPen;
  return (
    <div
      className={`cover-art cover-${variant} ${compact ? "cover-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="cover-letter">
        <span>
          {variant === "cpp"
            ? "C++"
            : variant === "linux"
              ? "Linux"
              : variant === "project"
                ? "Build"
                : variant === "course"
                  ? "Learn"
                  : "Notes"}
        </span>
        <small>
          {variant === "cpp"
            ? "语言 · 资源 · 工程"
            : variant === "linux"
              ? "内核 · 系统 · 设备"
              : variant === "project"
                ? "从设计到实现"
                : variant === "course"
                  ? "从理解到实践"
                  : "让经验成为方法"}
        </small>
      </div>
      <svg className="cover-drawing" viewBox="0 0 180 150" fill="none">
        {variant === "linux" ? (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="32" y="15" width="120" height="30" rx="7" />
            <rect
              x="32"
              y="61"
              width="120"
              height="30"
              rx="7"
              fill="currentColor"
              fillOpacity=".1"
            />
            <rect x="32" y="107" width="120" height="30" rx="7" />
            <path d="M92 45v16m0 30v16M48 30h18m-18 46h32m-32 46h50" />
            <circle cx="138" cy="30" r="3" />
            <circle cx="138" cy="76" r="3" />
            <circle cx="138" cy="122" r="3" />
          </g>
        ) : variant === "notes" ? (
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="35" y="28" width="100" height="108" rx="8" opacity=".4" />
            <rect
              x="48"
              y="15"
              width="100"
              height="108"
              rx="8"
              fill="currentColor"
              fillOpacity=".08"
            />
            <path d="M66 42h35m-35 18h64m-64 18h64m-64 18h40" />
          </g>
        ) : (
          <>
            <path
              d="M90 12 158 50 90 88 22 50Z"
              fill="currentColor"
              opacity=".12"
            />
            <path
              d="m22 74 68 38 68-38M22 98l68 38 68-38M90 88v48M22 50v48M158 50v48"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity=".45"
            />
            <path
              d="M90 12 158 50 90 88 22 50Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="90" cy="136" r="4" fill="currentColor" />
            <circle cx="158" cy="50" r="4" fill="currentColor" />
          </>
        )}
      </svg>
      <Icon className="cover-symbol" size={28} strokeWidth={1.5} />
      <span className="cover-edition">知栈 · 技术文库</span>
    </div>
  );
}
export function ShelfCard({ s, articles }: { s: Shelf; articles: Article[] }) {
  const textbook = getTextbook(s.id);
  if (textbook) return <BookCard book={textbook} articles={articles} />;
  const done = articles.filter((a) => a.progress === 100).length;
  return (
    <button
      className={`shelf-card ${s.kind}`}
      data-shelf={s.id}
      onClick={() => navigate(`shelf/${s.id}`)}
    >
      <CoverArt shelf={s} />
      <div className="shelf-card-copy">
        <div className="shelf-category">
          <span>{kindNames[s.kind]}</span>
          <ChevronRight size={17} />
        </div>
        <h3>{s.title}</h3>
        <p>{s.description}</p>
        <div className="shelf-bottom">
          <span>{articles.length} 篇内容</span>
          <span>{done ? `${done} 篇已读` : "开始探索"}</span>
        </div>
        {s.kind === "course" && (
          <progress
            aria-label={`${s.title}阅读进度`}
            value={done}
            max={articles.length || 1}
          />
        )}
      </div>
    </button>
  );
}
export function LearningHome({
  shelves,
  articles,
  recent,
  current,
  due,
  onNew,
}: {
  shelves: Shelf[];
  articles: Article[];
  recent: Article[];
  current?: Article;
  due: number;
  onNew: () => void;
}) {
  const currentShelf = shelves.find((s) => s.id === current?.shelfId);
  const returning = !!current?.lastReadAt;
  return (
    <>
      <div className="page-heading home-heading">
        <div>
          <h1>学习</h1>
        </div>
        <button className="button quiet create-entry" onClick={onNew}>
          <Plus size={19} />
          <span>记录新知识</span>
        </button>
      </div>
      <section className="continue-card" aria-label="继续学习">
        <div className="continue-copy">
          <span className="eyebrow">
            <BookOpen size={14} />
            {returning ? "继续阅读" : "推荐起点"}
          </span>
          <h2>{current?.title || "记录第一份知识"}</h2>
          <p>{currentShelf?.title || "把实践中的发现留在这里"}</p>
          <button
            className="button primary"
            onClick={() =>
              current
                ? navigate(
                    `article/${current.id}${current.progress > 0 && current.progress < 100 ? "?resume=1" : ""}`,
                  )
                : onNew()
            }
          >
            {returning ? "继续阅读" : current ? "开始阅读" : "开始记录"}
            <ArrowRight size={18} />
          </button>
          {returning && (
            <span className="continue-progress">
              {current?.progress === 100
                ? "已读完，可再次回顾"
                : `已读 ${current?.progress}%`}
            </span>
          )}
        </div>
        <CoverArt shelf={currentShelf} compact />
      </section>
      <div className="section-heading">
        <h2>技术课程</h2>
        <button className="text-button" onClick={() => navigate("courses")}>
          全部课程
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="shelf-grid home-courses">
        {shelves
          .filter((s) => s.kind === "course")
          .sort(
            (a, b) =>
              (["course-b00", "course-b05", "course-b23", "book-b00", "book-b23"].includes(a.id) ? -1 : 0) -
              (["course-b00", "course-b05", "course-b23", "book-b00", "book-b23"].includes(b.id) ? -1 : 0),
          )
          .slice(0, 2)
          .map((s) => (
            <ShelfCard
              key={s.id}
              s={s}
              articles={articles.filter((a) => a.shelfId === s.id)}
            />
          ))}
      </div>
      {!shelves.some((s) => s.kind === "course") && (
        <p className="muted">在资料库中创建课程，按自己的节奏开始学习。</p>
      )}
      <button className="review-strip" onClick={() => navigate("review")}>
        <span className="review-strip-icon">
          <RotateCcw size={22} />
        </span>
        <span>
          <strong>{due ? `${due} 篇待复习` : "复习清单"}</strong>
          <small>{due ? "现在回顾" : "温故知新"}</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <div className="section-heading">
        <h2>核心硬件机制 · 交互推演</h2>
        <button className="text-button" onClick={() => navigate("courses")}>
          27 册全库
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="home-demo-grid" aria-label="交互原理解析直达">
        {[
          {
            id: "course-b05-m01",
            vol: "B05",
            title: "STM32 时钟树与 PLL",
            sub: "HSE · Flash 2WS · 72MHz 波形",
          },
          {
            id: "course-b05-m02",
            vol: "B05",
            title: "GPIO 推挽与开漏电路",
            sub: "P/N-MOS 通断与 I²C 线与路径",
          },
          {
            id: "course-b05-m03",
            vol: "B05",
            title: "NVIC 压栈与咬尾中断",
            sub: "8 寄存器硬件入栈 · 6周期切换",
          },
          {
            id: "course-b05-m06",
            vol: "B05",
            title: "DMA 环形乒乓缓冲",
            sub: "HT 半满 / TC 全满双指针追逐",
          },
          {
            id: "course-b07-m04",
            vol: "B07",
            title: "CAN 总线逐位仲裁",
            sub: "双绞差分显隐电平与无损退避",
          },
          {
            id: "course-b06-m01",
            vol: "B06",
            title: "RTOS 优先级继承",
            sub: "抢占调度与 Mutex 防反转机制",
          },
        ].map((item) => (
          <button
            key={item.id}
            className="home-demo-card"
            onClick={() => navigate(`article/${item.id}`)}
          >
            <span className="home-demo-vol">{item.vol}</span>
            <strong>{item.title}</strong>
            <small>{item.sub}</small>
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>{recent.length ? "最近读过" : "精选必读章节"}</h2>
        <button className="text-button" onClick={() => navigate("library")}>
          资料库
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="recent-list">
        {(recent.length
          ? recent
          : ["course-learning-path", "course-b05-m01", "course-projects"]
              .map((id) => articles.find((a) => a.id === id))
              .filter((a): a is Article => !!a)
        )
          .slice(0, 3)
          .map((a) => (
            <button key={a.id} onClick={() => navigate(`article/${a.id}`)}>
              <FileText size={20} />
              <span>
                <strong>{a.title}</strong>
                <small>{shelves.find((s) => s.id === a.shelfId)?.title}</small>
              </span>
              {a.progress === 100 ? (
                <CheckCircle2 size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          ))}
      </div>
    </>
  );
}
export function LibraryView({
  shelves,
  articles,
  onShelf,
  onNew,
}: {
  shelves: Shelf[];
  articles: Article[];
  onShelf: (kind?: ShelfKind) => void;
  onNew: () => void;
}) {
  const [kind, setKind] = useState<ShelfKind | "all">("all");
  const list = shelves.filter((s) => kind === "all" || s.kind === kind);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>资料库</h1>
          <p>
            {shelves.length} 个知识库 · {articles.length} 篇积累
          </p>
        </div>
        <button className="button quiet" onClick={onNew}>
          <Plus size={18} />
          记录新知识
        </button>
      </div>
      <div className="library-shortcuts">
        <button onClick={() => navigate("favorites")}>
          <Bookmark size={20} />
          <span>我的收藏</span>
          <small>{articles.filter((a) => a.favorite).length}</small>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onShelf(kind === "all" ? "project" : kind)}>
          <FolderOpen size={20} />
          <span>新建知识库</span>
          <Plus size={18} />
        </button>
      </div>
      <SelectionGroup
        className="filter-bar library-filters"
        label="资料分类"
        value={kind}
      >
        {(
          [
            ["all", "全部"],
            ["project", "项目"],
            ["course", "课程"],
            ["experience", "经验"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={kind === key}
            className={kind === key ? "selected" : ""}
            onClick={() => setKind(key)}
          >
            {label}
          </button>
        ))}
      </SelectionGroup>
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
        <div className="empty">
          <NotebookPen size={32} />
          <h3>这里还没有内容</h3>
          <p>为下一次实践，留一个整理的位置。</p>
          <button
            className="button primary"
            onClick={() => onShelf(kind === "all" ? "project" : kind)}
          >
            新建知识库
          </button>
        </div>
      )}
    </>
  );
}
