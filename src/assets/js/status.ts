/**
 * MC 状态：mc-ops 每 10 分钟推到 mc-status 仓库的 Pages（同域 /mc-status/status.json）。
 * 页面上可以有多处状态卡片（首页服务器板块、地图页侧栏），都标 [data-mc-status]；
 * 数据只取一份，阅读面板换了内容后调用 paintStatus() 把最新数据画到新卡片上。
 */

interface Status {
  online: boolean;
  players_online: number | null;
  players_max: number | null;
  version: string | null;
  uptime_s: number | null;
  since: string | null;
  updated_at: string | null;
  history?: [string, number][];
}

let last: Status | null = null;
let error: string | null = null;
let started = false;

const hours = (sec: number) => `${Math.floor(sec / 3600)} 小时 ${Math.floor((sec % 3600) / 60)} 分`;

function apply(box: HTMLElement) {
  const set = (k: string, v: string) => {
    box.querySelectorAll(`[data-k="${k}"]`).forEach((el) => (el.textContent = v));
  };
  if (!last) {
    if (error) {
      set('state', '暂时读不到');
      set('updated', `状态数据读取失败（${error}），稍后会自动重试`);
    }
    return;
  }
  const s = last;
  const min = Math.round((Date.now() - new Date(s.updated_at!).getTime()) / 60000);
  const stale = min > 30; // 正常 10 分钟推一次，超过半小时说明小主机或网络断了
  set('state', stale ? '失联' : s.online ? '在线' : '离线');
  box.dataset.online = !stale && s.online ? '1' : '0';
  set('players', s.online && !stale ? `${s.players_online ?? 0} / ${s.players_max ?? '?'}` : '-');
  set('version', s.version ?? '-');
  // 「已开服」从开服日期算起，重启不清零；本次连续运行时长放在悬停提示里
  if (s.since) {
    const days = Math.floor((Date.now() - new Date(`${s.since}T00:00:00+08:00`).getTime()) / 86400e3) + 1;
    set('uptime', `${days} 天`);
    box.querySelectorAll<HTMLElement>('[data-k="uptime"]').forEach((el) => {
      el.title = `${s.since} 开服${s.online && !stale && s.uptime_s ? `，本次已连续运行 ${hours(Number(s.uptime_s))}` : ''}`;
    });
  } else set('uptime', s.online && !stale && s.uptime_s ? hours(Number(s.uptime_s)) : '-');
  set('updated', stale ? `数据已 ${min} 分钟未更新，小主机可能离线` : `${Math.max(0, min)} 分钟前更新 · 每 10 分钟一次`);
  box.querySelectorAll<SVGSVGElement>('[data-spark]').forEach((svg) => drawSpark(svg, s.history ?? []));
}

/** 把已有数据画到 root 里所有状态卡片上（没有数据时什么也不做，等请求回来） */
export function paintStatus(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-mc-status]').forEach(apply);
  if (!started && root.querySelector('[data-mc-status]')) startStatus();
}

function load(attempt = 0): void {
  fetch(`/mc-status/status.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((s: Status) => {
      if (!s.updated_at) throw new Error('尚无数据'); // 仓库刚建好、mc-ops 还没推过
      last = s;
      error = null;
      paintStatus();
    })
    .catch((err: unknown) => {
      // 偶发的网络错误：隔几秒重试两次；一直失败才显示原因
      if (attempt < 2) {
        setTimeout(() => load(attempt + 1), 3000 * (attempt + 1));
        return;
      }
      error = err instanceof Error ? err.message : String(err);
      paintStatus();
    });
}

export function startStatus() {
  if (started) return;
  started = true;
  load();
  // 页面一直开着时，每 5 分钟刷新一次
  setInterval(() => document.visibilityState === 'visible' && load(), 5 * 60e3);
}

/** 最近 24 小时在线人数的小折线（数据来自 status.json 的 history） */
function drawSpark(svg: SVGSVGElement, history: [string, number][]) {
  if (history.length < 2) return;
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

// QQ 群号：点击复制（事件委托，阅读面板里新插进来的按钮也生效）
document.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!b) return;
  // 提示默认在按钮里；data-copy-tip 指向别处的元素时（如 Switch 好友代码浮层）写到那里
  const far = b.dataset.copyTip ? document.getElementById(b.dataset.copyTip) : null;
  const tip = far ?? b.querySelector('.qq-copied');
  try {
    await navigator.clipboard.writeText(b.dataset.copy ?? '');
    if (tip) tip.textContent = far ? '已复制到剪贴板' : '已复制';
  } catch {
    if (tip) tip.textContent = '复制失败，请手动记下';
  }
  if (far) return; // 浮层里的提示常驻，不需要淡出
  tip?.classList.add('on');
  setTimeout(() => tip?.classList.remove('on'), 1600);
});
