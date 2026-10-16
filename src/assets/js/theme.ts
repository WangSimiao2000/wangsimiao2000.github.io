/** 全站共用：深色模式切换。初始主题由 <head> 里的内联脚本在首帧前设置，避免闪烁 */
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const d = document.documentElement;
  const next = d.dataset.theme === 'dark' ? 'light' : 'dark';
  d.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* 隐私模式下不可写，忽略 */
  }
});
