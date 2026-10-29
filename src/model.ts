export type ShelfKind = "project" | "course" | "experience";
export interface Shelf {
  id: string;
  title: string;
  description: string;
  kind: ShelfKind;
  color: string;
  createdAt: number;
}
export interface Article {
  id: string;
  shelfId: string;
  title: string;
  body: string;
  tags: string[];
  order: number;
  favorite: boolean;
  progress: number;
  note: string;
  reviewAt: number;
  reviewLevel: number;
  lastReadAt: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  deletedAt: number;
  sourcePath?: string;
}
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  data: Blob;
  size: number;
}
export interface Revision {
  id: string;
  articleId: string;
  savedAt: number;
  article: Article;
}
export interface Setting {
  key: string;
  value: unknown;
}
export interface Seed {
  contentVersion: string;
  legacyHashes?: Record<string, string>;
  shelves: Shelf[];
  articles: Article[];
  attachments: {
    id: string;
    name: string;
    mime: string;
    path: string;
    sha256: string;
  }[];
}
export const kindNames: Record<ShelfKind, string> = {
  project: "项目档案",
  course: "技术课程",
  experience: "问题与经验",
};
export const uid = () => crypto.randomUUID();
export const articleDefaults = (
  shelfId: string,
  title = "未命名文章",
): Article => ({
  id: uid(),
  shelfId,
  title,
  body: "",
  tags: [],
  order: Date.now(),
  favorite: false,
  progress: 0,
  note: "",
  reviewAt: 0,
  reviewLevel: 0,
  lastReadAt: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  deletedAt: 0,
});
export const templates: Record<ShelfKind, string> = {
  project:
    "## 要解决的问题\n\n\n## 环境与版本\n\n\n## 设计与实现\n\n```c\n// 在这里记录关键代码\n```\n\n## 验证方法\n\n\n## 结果与后续改进\n\n",
  course:
    "## 学习目标\n\n\n## 核心原理\n\n\n## 代码示例\n\n```cpp\n// 一个可以运行的小例子\n```\n\n## 动手实验\n\n1. \n\n## 自测与答案\n\n",
  experience:
    "## 问题现象\n\n\n## 环境与复现步骤\n\n\n## 排查过程与证据\n\n\n## 根因\n\n\n## 解决方法\n\n\n## 验证结果\n\n\n## 可以复用的经验\n\n",
};
export function searchArticles(articles: Article[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return articles
    .filter(
      (a) =>
        !a.deletedAt &&
        terms.every((t) =>
          `${a.title}\n${a.tags.join(" ")}\n${a.body}\n${a.note}`
            .toLocaleLowerCase()
            .includes(t),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.title.toLowerCase().includes(query.toLowerCase())) -
          Number(a.title.toLowerCase().includes(query.toLowerCase())) ||
        b.updatedAt - a.updatedAt,
    );
}
export function nextReview(level: number, easy: boolean, now = Date.now()) {
  const n = easy ? Math.min(level + 1, 5) : 0;
  return {
    reviewLevel: n,
    reviewAt: now + [1, 3, 7, 14, 30, 60][n] * 86400000,
  };
}
