// daycycle.ts：深浅色切换的时刻正好是晨昏的中间；首帧内联脚本和 theme.ts 用同一套规则
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUNRISE, SUNSET, TOD_KEY, initScript, themeOf } from '../../src/assets/js/daycycle.ts';
import { nightAt } from '../../src/assets/js/pixel/sim/daytime.ts';

test('界面在晨昏正中间切深浅色：那一刻夜色正好一半', () => {
  assert.equal(nightAt(SUNSET), 0.5);
  assert.equal(nightAt(SUNRISE), 0.5);
  assert.equal(themeOf(SUNSET - 0.01), 'light');
  assert.equal(themeOf(SUNSET), 'dark');
  assert.equal(themeOf(SUNRISE - 0.01), 'dark');
  assert.equal(themeOf(SUNRISE), 'light');
});

test('首帧内联脚本算出的深浅色和 themeOf 一致（按网址 ?tod=）', () => {
  for (let h = 0; h <= 24; h += 0.25) {
    const el = { classList: { add() {} }, dataset: {} as Record<string, string> };
    const run = new Function('document', 'location', 'localStorage', initScript());
    run({ documentElement: el }, { search: `?${TOD_KEY}=${h}` }, { getItem: () => null });
    assert.equal(el.dataset.theme, themeOf(h), `${h} 点`);
    assert.equal(parseFloat(el.dataset.hour), Math.round(h * 100) / 100);
  }
});
