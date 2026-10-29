/** 整站入口：像素世界 + 站内路由（阅读面板）+ MC 状态 */
import { startWorld } from './pixel/world.js';
import { startRouter } from './router.js';
import { startSlingshot } from './slingshot.js';
import './search.js';
import './scenic.js';
import { paintStatus } from './status.js';
import { removeLegacyServiceWorker } from './legacy-sw.js';
import { isBirthday } from './pixel/festive.js';

void removeLegacyServiceWorker();

// 站长生日（访客本地日期）：起点卡片上加一行小字，世界里放烟花、主角戴帽子（见 world.ts）
if (isBirthday()) {
  document.documentElement.classList.add('birthday');
  const meta = document.querySelector('.hero .hero-meta');
  if (meta) {
    const note = document.createElement('p');
    note.className = 'bday-note';
    note.textContent = '🎂 今天是 MickeyMiao 的生日';
    meta.after(note);
  }
}

const canvas = document.getElementById('world') as HTMLCanvasElement;
const sections = [...document.querySelectorAll<HTMLElement>('.stage')];
const reader = document.querySelector<HTMLElement>('[data-reader]')!;
history.scrollRestoration = 'manual';

// 直接打开文章等页面：世界一开始就停在对应板块，不从起点跑过去；
// 首页带着 #posts 这类锚点打开或刷新时，也停在那个板块（地址栏和画面保持一致）
const initial = reader.querySelector<HTMLElement>('.reader-card')?.dataset.section;
const hashId = decodeURIComponent(location.hash.slice(1));
const start = initial ?? (sections.some((s) => s.id === hashId) ? hashId : undefined);
if (!initial && location.hash && !start) history.replaceState(history.state, '', location.pathname + location.search); // 不认识的锚点去掉
if (start) {
  const idx = Math.max(0, sections.findIndex((s) => s.id === start));
  window.scrollTo({ top: idx * (sections[0]?.offsetHeight || window.innerHeight), behavior: 'instant' });
}

const world = startWorld({
  canvas,
  sections,
  panels: [...document.querySelectorAll<HTMLElement>('.stages .panel')],
  slots: [...document.querySelectorAll<HTMLElement>('.hb-slot')],
  secretPanel: document.querySelector<HTMLElement>('[data-secret-panel]'),
});
if (initial === 'secret') world.enterSecret();
startRouter({ world, sections, reader });
startSlingshot({ slots: [...document.querySelectorAll<HTMLElement>('.hb-slot')], goTo: world.goTo });

// MC 状态（首页服务器板块、地图页侧栏）
paintStatus();
