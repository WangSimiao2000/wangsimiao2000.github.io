/** 整站入口：像素世界 + 站内路由（阅读面板）+ MC 状态 */
import { startWorld } from './pixel/world.js';
import { startRouter } from './router.js';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const sections = [...document.querySelectorAll<HTMLElement>('.stage')];
const reader = document.querySelector<HTMLElement>('[data-reader]')!;
history.scrollRestoration = 'manual';

// 直接打开文章等页面：世界一开始就停在对应板块，不从起点跑过去
const initial = reader.querySelector<HTMLElement>('.reader-card')?.dataset.section;
if (initial) {
  const idx = Math.max(0, sections.findIndex((s) => s.id === initial));
  window.scrollTo({ top: idx * (sections[0]?.offsetHeight || window.innerHeight), behavior: 'instant' });
}

const world = startWorld({
  canvas,
  sections,
  panels: [...document.querySelectorAll<HTMLElement>('.panel')],
  slots: [...document.querySelectorAll<HTMLElement>('.hb-slot')],
});
startRouter({ world, sections, reader });

// MC 状态：由 mc-ops 每 10 分钟推到 mc-status 仓库的 Pages（同域）
const box = document.querySelector<HTMLElement>('[data-mc-status]');
if (box) {
  const set = (k: string, v: string) => {
    const el = box.querySelector(`[data-k="${k}"]`);
    if (el) el.textContent = v;
  };
  fetch('/mc-status/status.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((s) => {
      set('state', s.online ? '在线' : '离线');
      box.dataset.online = s.online ? '1' : '0';
      set('players', s.online ? `${s.players_online ?? 0} / ${s.players_max ?? '?'}` : '-');
      set('version', s.version ?? '-');
      const up = Number(s.uptime_s ?? 0);
      set('uptime', s.online && up ? `${Math.floor(up / 3600)} 小时 ${Math.floor((up % 3600) / 60)} 分` : '-');
      if (s.updated_at) {
        const min = Math.round((Date.now() - new Date(s.updated_at).getTime()) / 60000);
        set('updated', min > 30 ? `数据已 ${min} 分钟未更新，小主机可能离线` : `${Math.max(0, min)} 分钟前更新`);
      }
    })
    .catch(() => {
      set('state', '数据接入中');
      set('updated', '状态数据还没上线（mc-status）');
    });
}
