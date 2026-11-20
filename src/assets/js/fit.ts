/**
 * 首页卡片不出滚动条：卡片的高度由屏幕决定（.panel 固定在顶栏和快捷栏之间），内容放不下时自动少放几条，
 * 完整内容在面板页里。不再按屏幕高度手写一条条 media query，改了字体、内容也不用重新调。
 *
 *   data-fit       可以裁的列表：从末尾一条条藏起来，每次藏条数最多的那个列表的；至少留 data-fit 的值那么多条（默认 1）
 *   data-fit-drop  次要内容（起点的操作提示、游戏板块的小标题、关于的简介）：列表都裁到最少还放不下时才藏，后面的先藏
 *
 * 藏起来的元素带 data-fit-out（home.css 里 display: none）。屏幕尺寸、卡片缩放变了，字体加载完，都重新量一遍。
 */
const OUT = 'data-fit-out';

const overflowing = (card: HTMLElement) => card.scrollHeight > card.clientHeight + 1;

/** 量一张卡片：先全部放出来，再按规则藏到放得下为止 */
export function fitCard(card: HTMLElement): void {
  card.querySelectorAll(`[${OUT}]`).forEach((el) => el.removeAttribute(OUT));
  if (!overflowing(card)) return;
  const lists = [...card.querySelectorAll<HTMLElement>('[data-fit]')];
  for (;;) {
    let last: Element | null = null;
    let most = 0;
    for (const l of lists) {
      const shown = [...l.children].filter((c) => !c.hasAttribute(OUT));
      if (shown.length > Math.max(1, Number(l.dataset.fit) || 1) && shown.length > most) {
        most = shown.length;
        last = shown[shown.length - 1];
      }
    }
    if (!last) break;
    last.setAttribute(OUT, '');
    if (!overflowing(card)) return;
  }
  for (const el of [...card.querySelectorAll<HTMLElement>('[data-fit-drop]')].reverse()) {
    el.setAttribute(OUT, '');
    if (!overflowing(card)) return;
  }
}

/** 首页所有世界卡片：现在量一遍，之后尺寸变了、字体加载完再量 */
export function fitCards(): void {
  const cards = [...document.querySelectorAll<HTMLElement>('.panel > .card')];
  const all = () => cards.forEach(fitCard);
  all();
  // 卡片自己的尺寸量完就定下来了（藏完以后和上一次一样），不会反复触发
  const ro = new ResizeObserver(all);
  cards.forEach((c) => {
    ro.observe(c);
    ro.observe(c.parentElement!);
  });
  void document.fonts?.ready.then(all);
}
