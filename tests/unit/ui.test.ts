// ui.ts：页面状态的订阅、Esc 只关最上面那一层浮层
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 最小的 DOM 替身：<html> 的 class 和 window 上的键盘事件
const classes = new Set<string>();
Object.assign(globalThis, {
  window: new EventTarget(),
  document: {
    documentElement: { classList: { contains: (c: string) => classes.has(c), toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } },
    querySelector: () => null,
  },
});
const { isOn, onState, pushLayer, setState, hotkeyOff } = await import('../../src/assets/js/ui.ts');

const esc = () => {
  const e = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
  (globalThis.window as EventTarget).dispatchEvent(e);
  return e.defaultPrevented;
};

test('状态改了才通知，class 跟着变', () => {
  const got: boolean[] = [];
  const off = onState('reading', (on) => got.push(on));
  setState('reading', true);
  setState('reading', true);
  setState('reading', false);
  off();
  setState('reading', true);
  assert.deepEqual(got, [true, false]);
  assert.equal(isOn('reading'), true);
  setState('reading', false);
});

test('Esc 从最上面一层往下关，没有浮层时不拦', () => {
  const closed: string[] = [];
  pushLayer(() => closed.push('reader'));
  const offToc = pushLayer(() => closed.push('toc'));
  pushLayer(() => closed.push('search'));
  assert.equal(esc(), true);
  offToc(); // 目录被别的方式关掉了：撤销登记
  assert.equal(esc(), true);
  assert.equal(esc(), false, '已经没有浮层');
  assert.deepEqual(closed, ['search', 'reader']);
});

test('搜索开着、在打字、按着修饰键时，单键快捷键不响应', () => {
  const key = (o: Partial<KeyboardEvent>) => ({ altKey: false, ctrlKey: false, metaKey: false, repeat: false, target: null, ...o }) as unknown as KeyboardEvent;
  assert.equal(hotkeyOff(key({})), false);
  assert.equal(hotkeyOff(key({ ctrlKey: true })), true);
  assert.equal(hotkeyOff(key({ repeat: true })), true);
  assert.equal(hotkeyOff(key({ repeat: true }), true), false);
  assert.equal(hotkeyOff(key({ target: { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget })), true);
  setState('searching', true);
  assert.equal(hotkeyOff(key({})), true);
  setState('searching', false);
});
