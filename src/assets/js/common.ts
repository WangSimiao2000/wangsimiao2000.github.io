/**
 * 全站共用的小工具，各模块不再各写一份：
 *   store     localStorage 读写（隐私模式下读写会抛错，这里吞掉：读不到当作没有，写不了就算了）
 *   hintNear  在按钮下面冒一个提示气泡，几秒后淡出（全屏、只看风景的提示，样式是 base.css 的 .fs-hint）
 *   复制      带 data-copy 的按钮点一下复制（QQ 群号、Switch 好友代码），导入这个模块就生效
 */

export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* 隐私模式下不可写，忽略 */
    }
  },
};

/** 在 anchor 下面冒一个提示气泡，ms 毫秒后淡出；返回提前收起的函数 */
export function hintNear(anchor: HTMLElement, text: string, ms: number): () => void {
  const el = document.createElement('div');
  el.className = 'fs-hint';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  el.style.top = `${r.bottom + 12}px`;
  el.style.right = `${Math.max(8, window.innerWidth - r.right - 6)}px`;
  requestAnimationFrame(() => el.classList.add('show'));
  let done = false;
  const hide = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  };
  const timer = window.setTimeout(hide, ms);
  return hide;
}

// 点击复制（事件委托，阅读面板里新插进来的按钮也生效）。
// 提示默认在按钮里的 .qq-copied；data-copy-tip 指向别处的元素时（如 Switch 好友代码浮层）写到那里
document.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!b) return;
  const far = b.dataset.copyTip ? document.getElementById(b.dataset.copyTip) : null;
  const tip = far ?? b.querySelector('.qq-copied');
  try {
    await navigator.clipboard.writeText(b.dataset.copy ?? '');
    if (tip) tip.textContent = far ? '已复制到剪贴板' : '已复制';
  } catch {
    if (tip) tip.textContent = '复制失败，请手动记下';
  }
  if (far) return; // 浮层里的提示常驻，不需要淡出
  tip?.classList.add('on');
  setTimeout(() => tip?.classList.remove('on'), 1600);
});
