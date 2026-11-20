/**
 * 只看风景：右上角按钮或 H 键把板块卡片和快捷栏藏起来，沉浸地看像素世界；再按一次、H 或 Esc 恢复。
 * 藏起来时世界照常能翻页（滚轮、方向键、1-6、滑动）和点彩蛋。打开阅读面板时自动退出。
 * 不记住状态：下次进站卡片照常显示，免得访客以为页面坏了。
 */
import { hotkeyOff, isOn as stateOn, onState, pushLayer, setState } from './ui.js';

const btn = document.querySelector<HTMLButtonElement>('[data-scenic-toggle]');
const LABEL_OFF = '隐藏卡片，只看风景（H）';
const LABEL_ON = '显示卡片（H 或 Esc）';

const isOn = () => stateOn('scenic');
let unlayer = () => {};

let hinted = false;
function hint(): void {
  if (hinted || !btn) return;
  hinted = true;
  const el = document.createElement('div');
  el.className = 'fs-hint';
  el.setAttribute('role', 'status');
  el.textContent = matchMedia('(pointer: coarse)').matches ? '再点一下这个按钮，卡片就回来' : '按 H 或 Esc 恢复卡片';
  document.body.append(el);
  const r = btn.getBoundingClientRect();
  el.style.top = `${r.bottom + 12}px`;
  el.style.right = `${Math.max(8, window.innerWidth - r.right - 6)}px`;
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2600);
}

function set(on: boolean): void {
  if (on === isOn()) return;
  setState('scenic', on);
  unlayer();
  unlayer = on ? pushLayer(() => set(false)) : () => {};
  if (btn) {
    const label = on ? LABEL_ON : LABEL_OFF;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.setAttribute('aria-pressed', String(on));
  }
  if (on) {
    // 焦点留在藏起来的卡片或快捷栏里，键盘操作会落到看不见的地方
    const a = document.activeElement as HTMLElement | null;
    if (a?.closest('.panel, .hotbar')) a.blur();
    hint();
  }
}

if (btn) {
  btn.hidden = false;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => set(!isOn()));

  // Esc 由 ui.ts 的浮层统一处理
  window.addEventListener('keydown', (e) => {
    if (hotkeyOff(e) || stateOn('reading')) return;
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      set(!isOn());
    }
  });

  // 站内跳到文章（前进后退、点了彩蛋里的链接）时，退出只看风景
  onState('reading', (on) => on && set(false));
}
