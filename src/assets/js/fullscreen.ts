/**
 * 全站共用：右上角全屏按钮 + F 快捷键 + 首次访问的一次性提示气泡。
 * Fullscreen API 只能由用户手势触发；iPhone Safari 不支持网页元素全屏，那里按钮保持隐藏
 * （iPhone 走「添加到主屏幕」，manifest 里 display=fullscreen）。
 */
type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = document as FsDoc;
const root = document.documentElement as FsEl;
const btn = document.querySelector<HTMLButtonElement>('[data-fullscreen-toggle]');
const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
// 已经从主屏图标以全屏 / 独立窗口打开时，按钮没意义
const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

const isFull = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

function toggle(): void {
  try {
    if (isFull()) void (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
    else void (root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.());
  } catch {
    /* 被浏览器拒绝（比如不在用户手势里），什么都不做 */
  }
}

function sync(): void {
  const on = isFull();
  root.classList.toggle('is-fullscreen', on);
  if (!btn) return;
  const label = on ? '退出全屏' : '全屏浏览，更沉浸（F）';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.setAttribute('aria-pressed', String(on));
}

/* ---------- 首次访问：几秒后在按钮旁冒一个小气泡，自动淡出，只出现一次 ---------- */
const HINT_KEY = 'fs-hint';
let hint: HTMLElement | null = null;
let hintTimer = 0;

function seen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true; // 不能记住就干脆不打扰
  }
}

function scheduleHint(): void {
  if (seen()) return;
  hintTimer = window.setTimeout(showHint, 3500);
}

function showHint(): void {
  if (!btn || isFull() || btn.offsetParent === null) return;
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* 隐私模式 */
  }
  hint = document.createElement('div');
  hint.className = 'fs-hint';
  hint.setAttribute('role', 'status');
  hint.textContent = '试试全屏浏览，更沉浸';
  document.body.append(hint);
  const r = btn.getBoundingClientRect();
  hint.style.top = `${r.bottom + 12}px`;
  hint.style.right = `${Math.max(8, window.innerWidth - r.right - 6)}px`;
  requestAnimationFrame(() => hint?.classList.add('show'));
  hintTimer = window.setTimeout(hideHint, 4500);
}

function hideHint(): void {
  clearTimeout(hintTimer);
  const h = hint;
  hint = null;
  if (!h) {
    // 用户在气泡出现前就用过全屏：以后也不用提示了
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* 隐私模式 */
    }
    return;
  }
  h.classList.remove('show');
  setTimeout(() => h.remove(), 400);
}

if (btn && supported && !installed) {
  btn.hidden = false;
  sync();
  btn.addEventListener('click', () => {
    hideHint();
    toggle();
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('[data-search]:not([hidden])')) return;
    e.preventDefault();
    hideHint();
    toggle();
  });

  scheduleHint();
}
