export interface CourseCell {
  body: string;
  header: boolean;
  rowSpan: number;
  colSpan: number;
}
export type CourseBlock =
  | { kind: "details"; title: string; body: string }
  | { kind: "table"; rows: CourseCell[][] }
  | { kind: "assessment"; id: string; criterion: string; items: { id: string; label: string }[] };

// Structured blocks contain data and Markdown only, never source HTML or scripts.
export function parseCourseBlock(language: string, source: string): CourseBlock | null {
  if (source.length > 2 * 1024 * 1024) return null;
  try {
    const value = JSON.parse(source);
    if (language === "zhizhan-details" && typeof value.title === "string" && typeof value.body === "string")
      return { kind: "details", title: value.title, body: value.body };
    if (language === "zhizhan-table" && Array.isArray(value.rows) && value.rows.length <= 1000 &&
      value.rows.every((row: unknown) => Array.isArray(row) && row.length <= 100 && row.every(cell =>
        cell && typeof cell.body === "string" && typeof cell.header === "boolean" &&
        [cell.rowSpan, cell.colSpan].every(n => Number.isInteger(n) && n >= 1 && n <= 1000))))
      return { kind: "table", rows: value.rows };
    if (language === "zhizhan-assessment" && /^course-[\w-]+$/.test(value.id) &&
      typeof value.criterion === "string" && value.criterion.length < 8000 &&
      Array.isArray(value.items) && value.items.length === 3 &&
      new Set(value.items.map((item: { id: string }) => item?.id)).size === 3 &&
      value.items.every((item: { id: string; label: string }) => item &&
        ["explain", "run", "transfer"].includes(item.id) && typeof item.label === "string"))
      return { kind: "assessment", id: value.id, criterion: value.criterion, items: value.items };
  } catch { /* Malformed edited blocks fall back to readable source. */ }
  return null;
}

export function assessmentState(value: unknown, criterion: string): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as { criterion?: unknown; checks?: unknown };
  return record.criterion === criterion && Array.isArray(record.checks)
    ? record.checks.filter((id): id is string => typeof id === "string" && ["explain", "run", "transfer"].includes(id)) : [];
}

export function isAssessmentSetting(key: unknown, value: unknown) {
  if (typeof key !== "string" || !/^course-assessment:course-[\w-]{1,120}$/.test(key) || !value || typeof value !== "object") return false;
  const record = value as { criterion?: unknown; checks?: unknown };
  return typeof record.criterion === "string" && record.criterion.length < 8000 &&
    Array.isArray(record.checks) && record.checks.length <= 3 &&
    record.checks.every(id => typeof id === "string" && ["explain", "run", "transfer"].includes(id));
}
