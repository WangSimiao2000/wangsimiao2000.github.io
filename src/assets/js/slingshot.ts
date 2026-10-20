/**
 * 弹弓：鼠标停在快捷栏里「当前所在」的那一格上（手机上长按），它正上方会冒出一把弹弓，停留几秒。
 * 把石子往反方向拉，松手后石子沿抛物线飞出去（左右都行），落在哪个板块上就直接冲过去。
 * 拉得越远飞得越远，拉满能从第一格打到最后一格；拉的时候只用一串方块标出发射方向，落在哪要自己掂量。
 */
const GRAVITY = 1700; // px/s²
const MAX_PULL = 78;
let POWER = 9.5; // 每拉 1px 给的初速度（px/s）；按快捷栏宽度算，见 place()
const SHOW_MS = 3500; // 鼠标离开后弹弓还留多久

interface Options {
  slots: HTMLElement[];
  goTo: (i: number) => void;
}

const PX = 3; // 像素风：1 个逻辑像素 = 3 个 CSS 像素，和世界一样粗的像素颗粒
// 弹弓盒子 48x60（16x20 个逻辑像素）。皮筋层向四周多留 90px，拉远了也画得下
const BAND_PAD = 90;
const snap = (v: number) => Math.round(v / PX) * PX; // 石子按像素格移动

const MARKUP = `
<canvas class="ss-fork" width="16" height="20" aria-hidden="true"></canvas>
<canvas class="ss-bands" aria-hidden="true"></canvas>
<svg class="ss-aim" aria-hidden="true" shape-rendering="crispEdges"></svg>
<canvas class="ss-ball" width="4" height="4" role="button" tabindex="-1" aria-label="弹弓石子：拖动后松手发射"></canvas>`;

/** 木叉：两条斜臂汇到中间，再一根立柱；左侧受光、右侧背光，顶端缠着皮绳 */
function drawFork(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  const put = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const light = '#b98a62';
  const mid = '#8a5f40';
  const dark = '#5e3d28';
  for (let y = 1; y <= 10; y++) {
    const off = Math.round((y - 1) * 0.6);
    put(1 + off, y, light);
    put(2 + off, y, mid);
    put(13 - off, y, mid);
    put(14 - off, y, dark);
  }
  for (let y = 10; y < 20; y++) {
    put(7, y, light);
    put(8, y, mid);
    put(9, y, dark);
  }
  // 皮绳缠绕的顶端
  for (const x of [1, 2, 13, 14]) {
    put(x, 0, '#6b3b2a');
    put(x, 2, '#6b3b2a');
  }
}

/** 石子：4x4 像素的小灰石，左上高光 */
function drawStone(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  const rows = ['.ab.', 'abbc', 'bbcc', '.cc.'];
  const pal: Record<string, string> = { a: '#d6d9df', b: '#9aa0ab', c: '#656b78' };
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (pal[ch]) {
      g.fillStyle = pal[ch];
      g.fillRect(x, y, 1, 1);
    }
  }));
}


export function startSlingshot({ slots, goTo }: Options) {
  if (!slots.length || !window.PointerEvent) return;
  let origin = slots[0]; // 弹弓立在哪一格：当前所在的板块
  const current = () => slots.findIndex((s) => s.classList.contains('is-active'));
  const box = document.createElement('div');
  box.className = 'slingshot';
  box.hidden = true;
  box.innerHTML = MARKUP;
  drawFork(box.querySelector<HTMLCanvasElement>('.ss-fork')!);
  drawStone(box.querySelector<HTMLCanvasElement>('.ss-ball')!);
  const bandCanvas = box.querySelector<HTMLCanvasElement>('.ss-bands')!;
  bandCanvas.width = Math.round((48 + BAND_PAD * 2) / PX);
  bandCanvas.height = Math.round((60 + BAND_PAD * 2) / PX);
  const bg = bandCanvas.getContext('2d')!;
  document.body.append(box);
  const ball = box.querySelector<HTMLElement>('.ss-ball')!;
  const aim = box.querySelector<SVGSVGElement>('.ss-aim')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let hideTimer = 0;
  let outTimer = 0; // 收起动画结束后再真正隐藏
  let dragging = false;
  let flying = false;
  let pull = { x: 0, y: 0 };
  let suppressClick = false;

  /** 弹弓立在「起点」格子正上方；返回皮兜（石子静止处）的屏幕坐标 */
  function place() {
    const r = origin.getBoundingClientRect();
    box.style.left = `${r.left + r.width / 2 - 24}px`;
    const bar = origin.closest('.hotbar')?.getBoundingClientRect();
    const barTop = bar?.top ?? r.top;
    // 射程：45° 拉满时水平射程 ≈ v²/g，取快捷栏宽的 1.05 倍，从最左一格拉满打得到最右一格（反过来也一样）
    if (bar) POWER = Math.sqrt(GRAVITY * bar.width * 1.05) / MAX_PULL;
    box.style.top = `${barTop - 58}px`; // 叉子底端正好立在快捷栏的上沿
    const b = box.getBoundingClientRect();
    return { x: b.left + 24, y: b.top + 22 };
  }

  function show() {
    if (document.documentElement.classList.contains('reading')) return;
    clearTimeout(hideTimer);
    if (box.classList.contains('ss-out')) {
      // 正在收起时又悬停回来：取消收起，原地弹回
      clearTimeout(outTimer);
      box.classList.remove('ss-out');
    }
    if (box.hidden) {
      box.hidden = false;
      place();
      resetBall();
      box.classList.remove('ss-out');
      void box.offsetWidth;
      box.classList.add('ss-in');
    }
  }
  function scheduleHide(ms = SHOW_MS) {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (dragging || flying) return scheduleHide(800);
      box.classList.add('ss-out');
      outTimer = window.setTimeout(() => {
        box.hidden = true;
        box.classList.remove('ss-in', 'ss-out');
        clearTargets();
      }, 220);
    }, ms);
  }

  /*
   * 石子的位置用独立的 translate 属性，不用 transform：落地时的 ss-pop 动画改的是 scale，
   * 而 CSS 里 scale 是叠在 transform 外面的，会把 transform 里的位移一起缩小——石子就会边缩边「飞回」皮兜。
   * translate 在 scale 之前生效，缩放只发生在石子自己身上。
   */
  /** reload：石子打出去就没了，皮兜里重新冒出一颗新的（淡入），而不是原来那颗瞬移回来 */
  function resetBall(reload = false) {
    pull = { x: 0, y: 0 };
    ball.style.translate = '0px 0px';
    ball.classList.remove('ss-fly', 'ss-reload');
    if (reload) {
      void ball.offsetWidth;
      ball.classList.add('ss-reload');
    }
    drawBands();
    aim.innerHTML = '';
  }

  /** 两根皮筋：从叉子顶端连到石子 */
  function drawBands() {
    // 像素皮筋：在逻辑像素格上画 Bresenham 直线
    bg.clearRect(0, 0, bandCanvas.width, bandCanvas.height);
    const o = BAND_PAD / PX;
    const bx = Math.round(o + (24 + pull.x) / PX);
    const by = Math.round(o + (22 + pull.y) / PX);
    bg.fillStyle = '#6b3b2a';
    for (const [x0, y0] of [[o + 2, o + 1], [o + 13, o + 1]]) {
      let x = Math.round(x0);
      let y = Math.round(y0);
      const dx = Math.abs(bx - x);
      const dy = -Math.abs(by - y);
      const sx = x < bx ? 1 : -1;
      const sy = y < by ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        bg.fillRect(x, y, 1, 1);
        if (x === bx && y === by) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
    }
  }

  function clearTargets() {
    slots.forEach((s) => s.classList.remove('ss-target', 'ss-hit'));
  }

  /** 预测落点：解 y(t) = 落地高度 */
  function landing(start: { x: number; y: number }, vx: number, vy: number) {
    const r = slots[0].getBoundingClientRect();
    const landY = r.top + r.height / 2;
    // landY = y0 + vy t + g t² / 2
    const a = GRAVITY / 2;
    const b = vy;
    const c = start.y - landY;
    const disc = b * b - 4 * a * c;
    const t = disc < 0 ? 0 : (-b + Math.sqrt(disc)) / (2 * a);
    return { x: start.x + vx * t, y: landY, t };
  }

  function slotAt(x: number) {
    const last = slots.length - 1;
    return slots.findIndex((s, i) => {
      const r = s.getBoundingClientRect();
      // 两端的格子往外多算半格：拉满稍微飞过头也算打中最边上那一格
      const pad = r.width * 0.6;
      return x >= r.left - (i === 0 ? pad : 4) && x <= r.right + (i === last ? pad : 4);
    });
  }

  function velocity() {
    return { vx: -pull.x * POWER, vy: -pull.y * POWER };
  }

  /** 只标方向：沿发射方向画几颗方块，越拉越长，但不画抛物线、不提示落点 */
  function preview() {
    const { vx, vy } = velocity();
    const v = Math.hypot(vx, vy) || 1;
    const n = 3 + Math.round((Math.hypot(pull.x, pull.y) / MAX_PULL) * 4);
    let dots = '';
    for (let k = 1; k <= n; k++) {
      const d = 14 + k * 9;
      const x = 24 + (vx / v) * d; // 从叉口往外排，不从石子起
      const y = 22 + (vy / v) * d;
      const size = k === n ? PX * 2 : PX;
      dots += `<rect x="${Math.round(x / PX) * PX - size / 2}" y="${Math.round(y / PX) * PX - size / 2}" width="${size}" height="${size}" style="opacity:${(0.85 * (1 - (k - 1) / (n + 1))).toFixed(2)}" />`;
    }
    aim.innerHTML = dots;
  }

  function launch() {
    const start = place();
    const sx = start.x + pull.x;
    const sy = start.y + pull.y;
    const { vx, vy } = velocity();
    const land = landing({ x: sx, y: sy }, vx, vy);
    const target = slotAt(land.x);
    const from = slots.indexOf(origin);
    ball.classList.remove('ss-reload');
    aim.innerHTML = '';
    pull = { x: 0, y: 0 };
    drawBands(); // 皮筋弹回
    flying = true;
    const b = box.getBoundingClientRect();
    const fx = sx - (b.left + 24);
    const fy = sy - (b.top + 22);
    const t0 = performance.now();
    const dur = reduced.matches ? 0 : land.t;
    const step = (now: number) => {
      const t = Math.min(dur, (now - t0) / 1000);
      const x = fx + vx * t;
      const y = fy + vy * t + (GRAVITY * t * t) / 2;
      ball.style.translate = `${snap(x)}px ${snap(y)}px`;
      if (t < dur) {
        requestAnimationFrame(step);
        return;
      }
      // 落地
      flying = false;
      clearTargets();
      if (target >= 0 && target !== from) {
        slots[target].classList.add('ss-hit');
        ball.classList.add('ss-pop');
        window.setTimeout(() => {
          goTo(target);
          slots[target].classList.remove('ss-hit');
        }, 260);
      } else ball.classList.add('ss-miss');
      window.setTimeout(() => {
        ball.classList.remove('ss-pop', 'ss-miss');
        resetBall(true);
        scheduleHide(900);
      }, 520);
    };
    requestAnimationFrame(step);
  }

  // 桌面：悬停当前那一格出现；手机：长按当前那一格出现。只对当前格生效
  const isOrigin = (el: HTMLElement) => slots.indexOf(el) === current();
  for (const slot of slots) {
    slot.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !isOrigin(slot) || dragging || flying) return;
      if (origin !== slot) box.hidden = true; // 换了一格：重新在这格上方弹出
      origin = slot;
      show();
    });
    slot.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && slot === origin) scheduleHide();
    });
  }
  box.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  box.addEventListener('pointerleave', () => !dragging && scheduleHide());
  let press = 0;
  const cancelPress = () => clearTimeout(press);
  for (const slot of slots) {
    slot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !isOrigin(slot)) return;
      press = window.setTimeout(() => {
        suppressClick = true;
        if (origin !== slot) box.hidden = true;
        origin = slot;
        show();
        scheduleHide(6000);
      }, 450);
    });
    slot.addEventListener('pointerup', cancelPress);
    slot.addEventListener('pointercancel', cancelPress);
    slot.addEventListener('contextmenu', (e) => suppressClick && e.preventDefault());
    // 长按出弹弓后，松手不要顺带触发这一格的跳转
    slot.addEventListener(
      'click',
      (e) => {
        if (suppressClick) {
          e.preventDefault();
          e.stopImmediatePropagation();
          suppressClick = false;
        }
      },
      true,
    );
  }

  // 拖石子
  let grab = { x: 0, y: 0 };
  ball.addEventListener('pointerdown', (e) => {
    if (flying) return;
    e.preventDefault();
    dragging = true;
    clearTimeout(hideTimer);
    ball.setPointerCapture(e.pointerId);
    grab = { x: e.clientX - pull.x, y: e.clientY - pull.y };
    box.classList.add('ss-drag');
  });
  ball.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let x = e.clientX - grab.x;
    let y = e.clientY - grab.y;
    const len = Math.hypot(x, y);
    if (len > MAX_PULL) {
      x = (x / len) * MAX_PULL;
      y = (y / len) * MAX_PULL;
    }
    pull = { x, y };
    ball.style.translate = `${snap(x)}px ${snap(y)}px`;
    drawBands();
    if (len > 10) preview();
    else aim.innerHTML = '';
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('ss-drag');
    // 只是点了一下、几乎没拉开：原地不动。其余情况一律照物理发射——拉得短就弹得近，
    // 竖直拉就往上蹦再落下，落回自己这一格或快捷栏外面就掉下去消失，不会再「弹回」皮兜
    if (Math.hypot(pull.x, pull.y) < 4) {
      resetBall();
      clearTargets();
      scheduleHide();
      return;
    }
    launch();
  };
  ball.addEventListener('pointerup', release);
  ball.addEventListener('pointercancel', release);
  window.addEventListener('resize', () => !box.hidden && place());
}
