export interface NoteDraft {
  value: string;
  base: string | null;
}

// A draft must keep its original base across reloads; a fresh base would hide conflicts.
export function readNoteDraft(id: string): NoteDraft | undefined {
  try {
    const raw = localStorage.getItem(`note:${id}`);
    if (raw === null) return;
    try {
      const data = JSON.parse(raw);
      if (
        data?.format === "zhizhan-note-v1" &&
        typeof data.value === "string" &&
        (typeof data.base === "string" || data.base === null)
      )
        return { value: data.value, base: data.base };
    } catch {
      /* v1.0.0 stored the draft as plain text. */
    }
    return { value: raw, base: null };
  } catch {
    return;
  }
}
export function writeNoteDraft(id: string, value: string, base: string | null) {
  try {
    localStorage.setItem(
      `note:${id}`,
      JSON.stringify({ format: "zhizhan-note-v1", value, base }),
    );
  } catch {
    /* IndexedDB remains the primary save destination. */
  }
}
export function clearNoteDraft(id: string, expectedValue: string) {
  try {
    if (readNoteDraft(id)?.value === expectedValue)
      localStorage.removeItem(`note:${id}`);
  } catch {
    /* A stale recovery draft is preferable to losing another window's draft. */
  }
}
