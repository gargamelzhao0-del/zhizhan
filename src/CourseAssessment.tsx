import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { assessmentState, type CourseBlock } from "./courseBlocks";

export function CourseAssessment({ value }: { value: Extract<CourseBlock, { kind: "assessment" }> }) {
  const key = `course-assessment:${value.id}`;
  const record = useLiveQuery(() => db.settings.get(key).then(row => row || null), [key]);
  const saved = assessmentState(record?.value, value.criterion);
  const [pending, setPending] = useState<string[] | null>(null);
  const checks = pending ?? saved;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    // Show the click immediately, then accept the committed record (including changes from another window).
    setPending(null);
  }, [record, value.criterion]);
  async function toggle(id: string, checked: boolean) {
    setBusy(true); setError("");
    setPending(checked ? [...new Set([...checks, id])] : checks.filter(item => item !== id));
    try {
      await db.transaction("rw", db.settings, async () => {
        const current = assessmentState((await db.settings.get(key))?.value, value.criterion);
        const next = checked ? [...new Set([...current, id])] : current.filter(item => item !== id);
        await db.settings.put({ key, value: { criterion: value.criterion, checks: next } });
      });
    } catch { setPending(null); setError("保存失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <details className="course-assessment" aria-busy={busy}>
    <summary>本章验收自评 <span>{checks.length} / 3 {busy ? "保存中…" : "已记录"}</span></summary>
    <p><strong>本章判据：</strong>{value.criterion}</p>
    {value.items.map(item => <label key={item.id}>
      <input type="checkbox" checked={checks.includes(item.id)} disabled={busy || record === undefined}
        onChange={event => void toggle(item.id, event.target.checked)} />{item.label}
    </label>)}
    <p className="muted">自评与已阅读进度分别保存；目标板测量需按本章条件另行验收。</p>
    {error && <p role="alert">{error}</p>}
  </details>;
}
