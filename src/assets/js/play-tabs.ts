/**
 * 首页「游戏」板块的两页切换：最近在玩 | MC 服务器。
 * 两页在 CSS 里叠在同一格（卡片高度取较高的一页），这里只切换哪页显示；不记住选择，刷新回到「最近在玩」。
 */
export function startPlayTabs() {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.play-tabs [data-tab]')];
  if (!tabs.length) return;
  const panes = [...document.querySelectorAll<HTMLElement>('.play-panes [data-pane]')];
  const select = (name: string, focus = false) => {
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const p of panes) {
      const on = p.dataset.pane === name;
      p.toggleAttribute('data-off', !on);
      p.inert = !on;
    }
  };
  for (const p of panes) p.inert = p.hasAttribute('data-off');
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation(); // 不让方向键同时切换板块
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next.dataset.tab!, true);
    });
  });
}
