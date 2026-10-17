/**
 * 服务器等轴测地图查看器（/server/map/）。
 *
 * 瓦片由 mc-ops 每天渲染，发布在同域的 /mc-map/（另一个仓库的 Pages）：
 * - 第 0 级：每方块 8px，只在玩家常待的区域有；
 * - 第 1 级：每方块 4px，全图都有；
 * - 第 2 级起：逐级缩小一半。
 * 坐标统一用第 0 级的画面像素：SX = 4(x - z)，SY = 2(x + z) - 4(y + 1)。
 *
 * canvas 自绘：放大时最近邻（像素保持锐利），缩小时平滑；没加载好的瓦片先用上一级的放大顶着。
 */

interface Manifest {
  generated_at: string | null;
  tile: number;
  levels: number;
  full_level: number;
  spawn: [number, number, number] | null;
  tiles: Record<string, [number, number][]>;
}

const BASE = '/mc-map/';
const MAX_SCALE = 6; // 屏幕像素 / 第 0 级像素
const CACHE_LIMIT = 400;
/** 开图时的缩放（屏幕像素 / 第 0 级像素），对应第 1 级 */
const HOME_K = 0.5;
/**
 * 垫底用的预览：倒数第二级（约 1/64），一张约 30KB、覆盖整个开图视野。
 * 再细几级的瓦片同样是 512² 的整张、内容密的地方 60-100KB，拿来垫底并不省流量，所以直接跳到这一级。
 */
const previewLevel = (m: Manifest) => Math.max(m.full_level, m.levels - 2);

const tileUrl = (m: Manifest, key: string) => `${BASE}tiles/${key}.webp?v=${encodeURIComponent(m.generated_at ?? '')}`;
const homeCenter = (m: Manifest): [number, number] => {
  const sp = m.spawn;
  return sp ? [4 * (sp[0] - sp[2]), 2 * (sp[0] + sp[2]) - 4 * (sp[1] + 1)] : [0, 0];
};

/**
 * manifest 一次只取一份，预热和真正打开共用；超过 5 分钟才重新取，保证看到当天新渲染的。
 * 每天只变一次，不需要每次打开都绕开缓存再等一轮。
 */
let manifestReq: { at: number; p: Promise<Manifest> } | null = null;
function getManifest(signal?: AbortSignal): Promise<Manifest> {
  if (!manifestReq || Date.now() - manifestReq.at > 5 * 60_000) {
    const p = fetch(`${BASE}manifest.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Manifest>;
    });
    p.catch(() => (manifestReq = null));
    manifestReq = { at: Date.now(), p };
  }
  const p = manifestReq.p;
  if (!signal) return p;
  return new Promise((ok, fail) => {
    signal.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')), { once: true });
    p.then(ok, fail);
  });
}

const warmed = new Map<string, HTMLImageElement>();
/** 取回出生点附近、第 z 级、覆盖 hw×hh（屏幕像素的一半）视野的瓦片 */
function warmLevel(m: Manifest, z: number, hw: number, hh: number) {
  const span = m.tile * 2 ** z;
  const [cx, cy] = homeCenter(m);
  const set = new Set((m.tiles[String(z)] ?? []).map(([x, y]) => `${x}_${y}`));
  for (let ty = Math.floor((cy - hh / HOME_K) / span); ty <= Math.floor((cy + hh / HOME_K) / span); ty++)
    for (let tx = Math.floor((cx - hw / HOME_K) / span); tx <= Math.floor((cx + hw / HOME_K) / span); tx++) {
      const key = `${z}/${tx}_${ty}`;
      if (!set.has(`${tx}_${ty}`) || warmed.has(key)) continue;
      const im = new Image();
      im.src = tileUrl(m, key);
      warmed.set(key, im);
    }
}

/**
 * 预热地图。
 * - 首页空闲时（full=false）：只取 manifest（约 20KB，查看器脚本由调用方顺带加载）；
 * - 访客停到服务器板块、或指向「世界地图」按钮时（full=true）：再取开图视野里的预览级和清晰瓦片
 *   （合计约 300-400KB），点开时直接就是清晰的。只在可能要看的时候才花这份流量。
 */
export function warmMap(full = false): void {
  getManifest()
    .then((m) => {
      if (!m.levels || !full) return;
      // 地图在面板里大约占窗口宽的 55%、高的 65%
      const hw = (innerWidth * 0.55) / 2;
      const hh = (innerHeight * 0.65) / 2;
      warmLevel(m, previewLevel(m), hw, hh);
      warmLevel(m, m.full_level, hw, hh);
    })
    .catch(() => {});
}

export function bindMap(root: ParentNode): () => void {
  const box = root.querySelector<HTMLElement>('[data-mc-map]');
  if (!box) return () => {};
  const canvas = box.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const status = box.querySelector<HTMLElement>('[data-map-status]');
  const stamp = root.querySelector<HTMLElement>('[data-map-stamp]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  let man: Manifest | null = null;
  let have: Set<string>[] = [];
  const cache = new Map<string, HTMLImageElement>();
  let cx = 0;
  let cy = 0;
  let k = 0.5;
  let minK = 0.02;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let anim = 0;
  let alive = true;
  let bounds = [0, 0, 0, 0]; // 全图范围（第 0 级像素）：x0, y0, x1, y1

  const say = (text: string | null) => {
    if (!status) return;
    status.hidden = !text;
    if (text) status.textContent = text;
  };

  /* ---------- 瓦片 ---------- */

  function img(z: number, tx: number, ty: number): HTMLImageElement | null {
    const key = `${z}/${tx}_${ty}`;
    if (!have[z]?.has(`${tx}_${ty}`)) return null;
    let im = cache.get(key);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.onload = () => schedule();
      im.src = tileUrl(man!, key);
      cache.set(key, im);
      if (cache.size > CACHE_LIMIT) {
        const first = cache.keys().next().value as string;
        cache.delete(first);
      }
    } else {
      cache.delete(key); // LRU：挪到最后
      cache.set(key, im);
    }
    return im;
  }

  const ready = (im: HTMLImageElement | null): im is HTMLImageElement => !!im && im.complete && im.naturalWidth > 0;

  /** 画一张第 z 级瓦片；没加载好就从更粗的一级裁一块放大顶着（往上 3 级，再不行用预览级） */
  function drawTile(z: number, tx: number, ty: number, levels: number) {
    const T = man!.tile;
    const span = T * 2 ** z; // 这张瓦片覆盖多少第 0 级像素
    const sx = (tx * span - cx) * k + w / 2;
    const sy = (ty * span - cy) * k + h / 2;
    const size = span * k;
    const im = img(z, tx, ty);
    if (ready(im)) {
      ctx.drawImage(im, sx, sy, size, size);
      return;
    }
    // 往上找最多 3 级；再往上直接用预览级（放大倍数大，这时用平滑插值，糊一点比马赛克好看）
    const pre = previewLevel(man!);
    const ups = [1, 2, 3].filter((u) => z + u < levels);
    if (pre - z > 3) ups.push(pre - z);
    for (const up of ups) {
      const pz = z + up;
      const f = 2 ** up;
      const px = Math.floor(tx / f);
      const py = Math.floor(ty / f);
      const pim = cache.get(`${pz}/${px}_${py}`) ?? null;
      if (ready(pim)) {
        const sub = T / f;
        const smooth = ctx.imageSmoothingEnabled;
        if (up > 3) ctx.imageSmoothingEnabled = true;
        ctx.drawImage(pim, (tx - px * f) * sub, (ty - py * f) * sub, sub, sub, sx, sy, size, size);
        ctx.imageSmoothingEnabled = smooth;
        img(pz, px, py);
        return;
      }
    }
  }

  function drawLevel(z: number) {
    const T = man!.tile;
    const span = T * 2 ** z;
    const x0 = Math.floor((cx - w / 2 / k) / span);
    const x1 = Math.floor((cx + w / 2 / k) / span);
    const y0 = Math.floor((cy - h / 2 / k) / span);
    const y1 = Math.floor((cy + h / 2 / k) / span);
    // 先排预览级的请求：一两张小图最先到，整屏先有一个糊的轮廓，清晰的瓦片再逐张换上
    const zc = previewLevel(man!);
    if (zc > z) {
      const f = 2 ** (zc - z);
      for (let ty = Math.floor(y0 / f); ty <= Math.floor(y1 / f); ty++)
        for (let tx = Math.floor(x0 / f); tx <= Math.floor(x1 / f); tx++) img(zc, tx, ty);
    }
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) drawTile(z, tx, ty, man!.levels);
  }

  function draw() {
    raf = 0;
    if (!man) return;
    // 视野中心不能离开地图：拖得再远，地图也至少留在画面中间
    cx = Math.max(bounds[0], Math.min(bounds[2], cx));
    cy = Math.max(bounds[1], Math.min(bounds[3], cy));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const z = Math.max(0, Math.min(man.levels - 1, Math.floor(-Math.log2(k) + 1e-6)));
    ctx.imageSmoothingEnabled = k * 2 ** z < 1; // 放大最近邻，缩小平滑
    if (z === 0) {
      // 高清只覆盖一部分：先铺全图那一级，再叠高清
      const save = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      drawLevel(man.full_level);
      ctx.imageSmoothingEnabled = save;
    }
    drawLevel(z);
    drawSpawn();
  }

  function drawSpawn() {
    const sp = man?.spawn;
    if (!sp) return;
    const [x, y, z] = sp;
    const px = Math.round((4 * (x - z) - cx) * k + w / 2);
    const py = Math.round((2 * (x + z) - 4 * (y + 1) - cy) * k + h / 2);
    // 像素风小旗：竖杆 + 三角旗
    const u = 3;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgb(0 0 0 / 0.35)';
    ctx.fillRect(px - u, py, u * 2, u);
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(px - 1, py - u * 8, u - 1, u * 8);
    ctx.fillStyle = '#e8483b';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 1, py - u * 8 + i * u, u * (4 - i), u);
  }

  const schedule = () => {
    if (!raf && alive) raf = requestAnimationFrame(draw);
  };

  /* ---------- 视图 ---------- */

  const clampK = (v: number) => Math.max(minK, Math.min(MAX_SCALE, v));

  /** 以屏幕点 (mx, my) 为中心缩放到 nk */
  function zoomAt(nk: number, mx: number, my: number) {
    nk = clampK(nk);
    const wx = cx + (mx - w / 2) / k;
    const wy = cy + (my - h / 2) / k;
    k = nk;
    cx = wx - (mx - w / 2) / k;
    cy = wy - (my - h / 2) / k;
    schedule();
  }

  function animateTo(nk: number, mx: number, my: number) {
    cancelAnimationFrame(anim);
    if (reduced.matches) return zoomAt(nk, mx, my);
    const from = k;
    const to = clampK(nk);
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 220);
      const e = 1 - (1 - p) ** 3;
      zoomAt(from * (to / from) ** e, mx, my);
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function home() {
    if (man) [cx, cy] = homeCenter(man);
    k = clampK(HOME_K);
    schedule();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (man) {
      // 最小缩放：整张图能完整放进视口
      const T = man.tile * 2 ** (man.levels - 1);
      minK = Math.min(0.5, Math.min(w, h) / (T * 2.2));
      k = clampK(k);
    }
    schedule();
  }

  /* ---------- 交互 ---------- */

  const pts = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      cancelAnimationFrame(anim);
      box.classList.add('dragging');
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    },
    sig,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      if (pts.size === 1) {
        cx -= (cur.x - prev.x) / k;
        cy -= (cur.y - prev.y) / k;
        schedule();
      } else if (pts.size === 2) {
        pts.set(e.pointerId, cur);
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        // 先按两指中点的移动平移，再以中点缩放
        cx -= (cur.x - prev.x) / 2 / k;
        cy -= (cur.y - prev.y) / 2 / k;
        if (pinch > 0) zoomAt(k * (d / pinch), mx, my);
        pinch = d;
        return;
      }
      pts.set(e.pointerId, cur);
    },
    sig,
  );
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!pts.size) box.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', up, sig);
  canvas.addEventListener('pointercancel', up, sig);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const p = local(e);
      // 滚轮缩放（和常见地图一致）；触控板双指捏合会带 ctrlKey，步长更细；按行滚动的鼠标放大步长
      const unit = e.deltaMode === 1 ? 16 : 1;
      cancelAnimationFrame(anim);
      zoomAt(k * Math.exp((-e.deltaY * unit) / (e.ctrlKey ? 100 : 300)), p.x, p.y);
    },
    { passive: false, signal: ac.signal },
  );
  canvas.addEventListener(
    'dblclick',
    (e) => {
      const p = local(e);
      animateTo(k * (e.shiftKey ? 0.5 : 2), p.x, p.y);
    },
    sig,
  );
  box.addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-map-act]');
      if (!b) return;
      const act = b.dataset.mapAct;
      if (act === 'in') animateTo(k * 2, w / 2, h / 2);
      else if (act === 'out') animateTo(k / 2, w / 2, h / 2);
      else home();
    },
    sig,
  );
  canvas.addEventListener(
    'keydown',
    (e) => {
      const step = 80 / k;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => (cx -= step),
        ArrowRight: () => (cx += step),
        ArrowUp: () => (cy -= step),
        ArrowDown: () => (cy += step),
        '+': () => animateTo(k * 2, w / 2, h / 2),
        '=': () => animateTo(k * 2, w / 2, h / 2),
        '-': () => animateTo(k / 2, w / 2, h / 2),
        '0': home,
      };
      const f = keys[e.key];
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      f();
      schedule();
    },
    sig,
  );
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ---------- 数据 ---------- */

  say('正在读取地图…');
  getManifest(ac.signal)
    .then((m) => {
      if (!alive) return;
      if (!m.levels || !m.tiles?.[String(m.full_level)]?.length) {
        say('第一张地图正在生成（全图首次渲染约需一小时），稍后刷新再来看看。');
        return;
      }
      man = m;
      const span = m.tile * 2 ** m.full_level;
      const full = m.tiles[String(m.full_level)];
      bounds = [
        Math.min(...full.map(([x]) => x)) * span,
        Math.min(...full.map(([, y]) => y)) * span,
        (Math.max(...full.map(([x]) => x)) + 1) * span,
        (Math.max(...full.map(([, y]) => y)) + 1) * span,
      ];
      have = Array.from({ length: m.levels }, (_, z) => new Set((m.tiles[String(z)] ?? []).map(([x, y]) => `${x}_${y}`)));
      if (stamp && m.generated_at) {
        const d = new Date(m.generated_at);
        stamp.textContent = `渲染于 ${d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        stamp.hidden = false;
      }
      say(null);
      resize();
      home();
    })
    .catch((err: unknown) => {
      if (alive && !(err instanceof DOMException && err.name === 'AbortError')) say(`地图读取失败（${String(err)}）`);
    });

  return () => {
    alive = false;
    ac.abort();
    ro.disconnect();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(anim);
    cache.clear();
  };
}
