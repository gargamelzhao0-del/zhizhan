import { describe, it, expect } from 'vitest';
import { bundledTarget } from '../src/bundledTargets';
import { articleDefaults } from '../src/model';
describe('course links after a protected content upgrade', () => {
  const old = { ...articleDefaults('course-b03'), id: 'course-b03-m01', body: '旧文与我的修改' };
  const current = { ...old, id: 'installed-copy', body: '完整新版正文' };
  const state = { articles: { [old.id]: { targetId: current.id } } };
  it('opens the installed edition without changing the protected original', () => {
    expect(bundledTarget(old.id, state, [old, current])).toBe(current.id);
    expect(old.body).toBe('旧文与我的修改');
    expect(bundledTarget(old.id, undefined, [old])).toBe(old.id);
  });
  it('does not route into another shelf or resurrect a trashed installed copy', () => {
    expect(bundledTarget(old.id, state, [old, { ...current, shelfId: 'personal' }])).toBe(old.id);
    // The caller can show the missing/deleted destination instead of presenting
    // an obsolete protected article as if it were the new course edition.
    expect(bundledTarget(old.id, state, [old, { ...current, deletedAt: 1 }])).toBe(current.id);
  });
});
