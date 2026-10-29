import { useEffect, useState, type RefObject } from 'react';

export function CourseDisclosures({ container, body }: {
  container: RefObject<HTMLDivElement | null>; body: string;
}) {
  const [state, setState] = useState({ count: 0, closed: 0 });
  useEffect(() => {
    const root = container.current;
    function update() {
      const items = [...root?.querySelectorAll<HTMLDetailsElement>('details') || []];
      setState({ count: items.length, closed: items.filter(item => !item.open).length });
    }
    update();
    root?.addEventListener('toggle', update, true);
    return () => root?.removeEventListener('toggle', update, true);
  }, [container, body]);
  if (!state.count) return null;
  return <div className="course-disclosures">
    <span>本篇含 {state.count} 处补充讲解、答案或自评</span>
    <button className="text-button" aria-label={state.closed ? '展开本篇全部折叠内容' : '收起本篇全部折叠内容'}
      onClick={() => {
        const open = state.closed > 0;
        container.current?.querySelectorAll<HTMLDetailsElement>('details').forEach(item => { item.open = open; });
        setState({ ...state, closed: open ? 0 : state.count });
      }}>{state.closed ? '展开全部' : '收起全部'}</button>
  </div>;
}
