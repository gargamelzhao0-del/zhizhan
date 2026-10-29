import type { Article } from './model';

/** The updater may protect an edited article by installing a separate copy. */
export function bundledTarget(id: string, state: unknown, articles: Article[]) {
  if (!state || typeof state !== 'object') return id;
  const target = (state as { articles?: Record<string, { targetId?: unknown }> }).articles?.[id]?.targetId;
  if (typeof target !== 'string' || target === id) return id;
  const original = articles.find(a => a.id === id);
  const replacement = articles.find(a => a.id === target);
  return replacement && (!original || replacement.shelfId === original.shelfId) ? target : id;
}
