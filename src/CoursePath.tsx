import { ArrowRight, ChevronDown, CheckCircle2, BookOpen } from "lucide-react";
import curriculum from "../content/curriculum.json";
import type { Article } from "./model";

export const hasCoursePath = (id: string) =>
  Object.prototype.hasOwnProperty.call(curriculum, id);

export function CoursePath({
  id,
  articles,
}: {
  id: string;
  articles: Article[];
}) {
  const course = hasCoursePath(id)
    ? curriculum[id as keyof typeof curriculum]
    : undefined;
  if (!course) return null;
  const index = new Map(
    articles
      .filter((a) => !a.deletedAt)
      .map((article) => [article.id, article]),
  );
  const visible = course.modules
    .flatMap((module) => module.lessons)
    .filter((key) => index.has(key));
  const next =
    visible.find((key) => index.get(key)?.progress !== 100) || visible[0];
  const completed = visible.filter(
    (key) => index.get(key)?.progress === 100,
  ).length;
  const activeModule = course.modules.findIndex((module) =>
    module.lessons.includes(next),
  );
  return (
    <section className="course-path" aria-label="分阶段学习路径">
      <div className="course-start">
        <div>
          <strong>{course.modules.length} 个阶段，循序渐进</strong>
          <span>
            {completed} / {visible.length} 篇已读
          </span>
        </div>
        {next && (
          <a className="button primary" href={`#article/${next}`}>
            <BookOpen size={17} />
            {completed === visible.length
              ? "重新回顾"
              : completed
                ? "继续学习"
                : "开始学习"}
            <ArrowRight size={16} />
          </a>
        )}
      </div>
      <progress
        className="course-meter"
        aria-label="课程已读进度"
        value={completed}
        max={visible.length || 1}
      />
      <div className="course-modules">
        {course.modules.map((module, number) => {
          const lessons = module.lessons
            .map((key) => index.get(key))
            .filter((a): a is Article => !!a && !a.deletedAt);
          if (!lessons.length) return null;
          const done = lessons.filter((a) => a.progress === 100).length;
          return (
            <details
              key={module.title}
              className="course-module"
              open={number === activeModule}
            >
              <summary>
                <span className="module-number">
                  {String(number + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{module.title}</strong>
                  <small>
                    {done}/{lessons.length} 篇已读
                  </small>
                </span>
                <ChevronDown size={18} />
              </summary>
              <ol>
                {lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <a
                      href={`#article/${lesson.id}`}
                      className={lesson.id === next ? "next-lesson" : undefined}
                    >
                      <span className="lesson-index" aria-hidden="true">
                        {String(visible.indexOf(lesson.id) + 1).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <span className="lesson-title">{lesson.title}</span>
                      {lesson.progress === 100 ? (
                        <CheckCircle2 size={17} aria-label="已读" />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="module-outcome">本阶段目标：{module.outcome}</p>
            </details>
          );
        })}
      </div>
      <details className="course-goals">
        <summary>
          课程目标与学习建议 <ChevronDown size={15} />
        </summary>
        <p>
          <strong>{course.title}</strong>
        </p>
        <p>{course.intro}</p>
      </details>
      <p className="muted">
        已读进度不代表实验验收通过。完成每课练习后，将运行证据记入学习笔记。
      </p>
    </section>
  );
}
