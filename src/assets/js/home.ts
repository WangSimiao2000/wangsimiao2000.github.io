/** 整站入口：像素世界 + 站内路由（阅读面板）+ MC 状态 */
import { startWorld } from './pixel/world.js';
import { startRouter } from './router.js';
import './search.js';

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
  const hours = (sec: number) => `${Math.floor(sec / 3600)} 小时 ${Math.floor((sec % 3600) / 60)} 分`;
  fetch('/mc-status/status.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((s) => {
      if (!s.updated_at) throw new Error('尚无数据'); // 仓库刚建好、mc-ops 还没推过
      const min = Math.round((Date.now() - new Date(s.updated_at).getTime()) / 60000);
      const stale = min > 30; // 正常 10 分钟推一次，超过半小时说明小主机或网络断了
      set('state', stale ? '失联' : s.online ? '在线' : '离线');
      box.dataset.online = !stale && s.online ? '1' : '0';
      set('players', s.online && !stale ? `${s.players_online ?? 0} / ${s.players_max ?? '?'}` : '-');
      set('version', s.version ?? '-');
      set('uptime', s.online && !stale && s.uptime_s ? hours(Number(s.uptime_s)) : '-');
      set('updated', stale ? `数据已 ${min} 分钟未更新，小主机可能离线` : `${Math.max(0, min)} 分钟前更新 · 每 10 分钟一次`);
      drawSpark(box.querySelector<SVGSVGElement>('[data-spark]'), s.history ?? []);
    })
    .catch(() => {
      set('state', '数据接入中');
      set('updated', '状态数据还没上线（mc-status）');
    });
}

/** 最近 24 小时在线人数的小折线（数据来自 status.json 的 history） */
function drawSpark(svg: SVGSVGElement | null, history: [string, number][]) {
  if (!svg || history.length < 2) return;
  const W = 240;
  const H = 36;
  const t0 = Date.now() - 24 * 3600e3;
  const max = Math.max(1, ...history.map(([, n]) => n));
  const pts = history.map(([ts, n]) => {
    const x = Math.max(0, Math.min(W, ((new Date(ts).getTime() - t0) / (24 * 3600e3)) * W));
    return `${x.toFixed(1)},${(H - 3 - (n / max) * (H - 6)).toFixed(1)}`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />`;
  svg.parentElement?.removeAttribute('hidden');
}
