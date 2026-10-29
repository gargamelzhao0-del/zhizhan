import retired from "../content/retired-tutorials.json";
import { db, type VaultDB } from "./db";

export const retiredShelfIds = new Set(retired.shelves);

// Enumerate bundled identities: never retire a user's unrelated course article.
// The recycle bin retains annotations, history and attachment references.
export async function retireOutdatedTutorials(database: VaultDB = db) {
  const key = `retired-tutorials:${retired.version}`;
  return database.transaction("rw", database.articles, database.settings, async () => {
    if (await database.settings.get(key)) return 0;
    const state = (await database.settings.get("builtinContent"))?.value as
      { articles?: Record<string, { targetId: string }> } | undefined;
    const ids = new Set(retired.articles);
    for (const id of retired.articles) {
      const target = state?.articles?.[id]?.targetId;
      if (target) ids.add(target);
    }
    let count = 0;
    for (const id of ids) {
      const article = await database.articles.get(id);
      if (!article || article.deletedAt || !retiredShelfIds.has(article.shelfId)) continue;
      await database.articles.update(id, { deletedAt: Date.now(), version: article.version + 1 });
      count++;
    }
    await database.settings.put({ key, value: { count, at: Date.now() } });
    return count;
  });
}
