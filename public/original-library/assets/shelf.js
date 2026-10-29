/* shelf.js — 书架搜索过滤 */
(() => {
  const input = document.getElementById('shelfSearch');
  const main = document.getElementById('shelfMain');
  const empty = document.getElementById('shelfEmpty');
  if (!input || !main) return;
  const cards = [...main.querySelectorAll('.card')];
  const groups = [...main.querySelectorAll('.shelf-group')];

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(c => {
      const hay = (c.dataset.id + ' ' + c.dataset.name).toLowerCase();
      const ok = !q || hay.includes(q);
      c.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });
    groups.forEach(g => {
      const any = [...g.querySelectorAll('.card')].some(c => c.style.display !== 'none');
      g.style.display = any ? '' : 'none';
    });
    if (empty) empty.hidden = visible !== 0;
  });
})();
