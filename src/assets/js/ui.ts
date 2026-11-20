/**
 * 页面级的界面状态和按键，各模块共用这一处：
 *
 *   状态    阅读、只看风景、搜索、隐藏页这些「整页处在什么状态」。照旧写成 <html> 上的 class（CSS 按它切换样式），
 *           但 JS 只经过 setState / isOn / onState 读写：哪个模块改了状态，订阅的模块马上知道，
 *           不用每帧去读 class，也不用 MutationObserver 盯着 <html>。
 *   浮层    按 Esc 能关掉的东西（阅读面板、搜索、目录、时间弹窗、只看风景）打开时 pushLayer 登记，关掉时撤销。
 *           Esc 只关最上面那一层：后打开的在上面，所以「搜索开在文章上面」时 Esc 先关搜索，不用各模块排先后。
 *   快捷键  hotkeyOff：在输入框里打字、按着修饰键、搜索开着时，单字母和数字快捷键都不响应。
 *   动效    reducedMotion()：系统的「减少动态效果」，整站共用一个。
 * 导入时不碰 DOM（pixel/input.ts 里的纯逻辑要在 Node 里单测），用到时才取。
 */
const root = () => document.documentElement;

export type State = 'reading' | 'scenic' | 'searching' | 'secret-open';

const subs = new Map<State, Set<(on: boolean) => void>>();

export const isOn = (s: State): boolean => root().classList.contains(s);

/** 改状态：<html> 的 class 跟着变，订阅这个状态的模块按顺序收到通知 */
export function setState(s: State, on: boolean): void {
  if (isOn(s) === on) return;
  root().classList.toggle(s, on);
  subs.get(s)?.forEach((fn) => fn(on));
}

/** 订阅状态的变化，返回取消订阅的函数 */
export function onState(s: State, fn: (on: boolean) => void): () => void {
  let set = subs.get(s);
  if (!set) subs.set(s, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

/* ---------- 浮层和 Esc ---------- */

const layers: (() => void)[] = [];
let listening = false;

/**
 * 登记一个按 Esc 能关掉的浮层（close 负责真正关掉它），返回撤销登记的函数：浮层用别的方式关掉时调用。
 * 同一个浮层关了又开，要重新登记，它就又到了最上面
 */
export function pushLayer(close: () => void): () => void {
  if (!listening) {
    listening = true;
    window.addEventListener('keydown', onEscape);
  }
  const entry = () => close();
  layers.push(entry);
  return () => {
    const i = layers.lastIndexOf(entry);
    if (i >= 0) layers.splice(i, 1);
  };
}

function onEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !layers.length || e.defaultPrevented) return;
  // 原生 popover（关于页的二维码浮层）开着时，Esc 交给浏览器关它
  try {
    if (document.querySelector(':popover-open')) return;
  } catch {
    /* 不支持 popover 的浏览器 */
  }
  e.preventDefault();
  layers.pop()!();
}

/* ---------- 快捷键 ---------- */

/** 焦点在可以打字的地方 */
export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/**
 * 单键快捷键（H、F、1-6、方向键）这一下不该响应：在打字、按着修饰键，或者搜索开着。
 * 长按连发默认也不响应（开关类的键）；方向键这类可以按住连续走的，传 allowRepeat
 */
export function hotkeyOff(e: KeyboardEvent, allowRepeat = false): boolean {
  return e.altKey || e.ctrlKey || e.metaKey || (e.repeat && !allowRepeat) || isTyping(e) || isOn('searching');
}

/* ---------- 动效 ---------- */

let reduced: MediaQueryList | null = null;
/** 系统现在是不是开着「减少动态效果」 */
export function reducedMotion(): boolean {
  reduced ??= matchMedia('(prefers-reduced-motion: reduce)');
  return reduced.matches;
}
