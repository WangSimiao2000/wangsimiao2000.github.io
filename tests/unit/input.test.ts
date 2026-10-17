import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapTracker, WheelGesture, classifySwipe } from '../../src/assets/js/pixel/input.ts';

/** 一次带惯性的触控板手势：count 个逐渐减弱的事件，间隔 16ms */
function inertia(w: WheelGesture, start: number, count = 40, peak = 120, dir = 1) {
  let steps = 0;
  for (let i = 0; i < count; i++) {
    const mag = peak * Math.pow(0.9, i) + 1;
    if (w.feed(dir * mag, mag, start + i * 16)) steps++;
  }
  return steps;
}

test('一次带惯性的手势只翻一页', () => {
  assert.equal(inertia(new WheelGesture(), 0), 1);
});

test('停顿超过 220ms 后的下一次手势再翻一页', () => {
  const w = new WheelGesture();
  assert.equal(inertia(w, 0), 1);
  assert.equal(inertia(w, 40 * 16 + 300), 1);
});

test('惯性还没完又用力扫一下，算新手势', () => {
  const w = new WheelGesture();
  let steps = inertia(w, 0, 32);
  // 500ms 后惯性还在（每 16ms 一个小事件），突然来一个大的
  if (w.feed(200, 200, 32 * 16 + 20)) steps++;
  assert.equal(steps, 2);
});

test('方向跟着 delta 走；小幅抖动不翻页', () => {
  assert.equal(new WheelGesture().feed(-50, 50, 0), -1);
  const w = new WheelGesture();
  assert.equal(w.feed(10, 10, 0), 0);
  assert.equal(w.feed(-10, 10, 16), 0);
});

test('classifySwipe：快且明显才算，方向正确', () => {
  assert.equal(classifySwipe(-80, 5, 200), 'left');
  assert.equal(classifySwipe(80, -5, 200), 'right');
  assert.equal(classifySwipe(4, -90, 200), 'up');
  assert.equal(classifySwipe(4, 90, 200), 'down');
  assert.equal(classifySwipe(-80, 5, 900), null, '太慢');
  assert.equal(classifySwipe(-30, 0, 100), null, '太短');
  assert.equal(classifySwipe(-60, 55, 100), null, '斜着划');
});

test('TapTracker：近处快速两下是双击，第三下重新算', () => {
  const t = new TapTracker();
  assert.equal(t.tap(100, 100, 0), false);
  assert.equal(t.tap(105, 102, 200), true);
  assert.equal(t.tap(105, 102, 300), false);
  assert.equal(t.tap(300, 100, 400), false, '离得太远');
  assert.equal(t.tap(300, 100, 900), false, '隔得太久');
});
