/**
 * 弹弓：鼠标停在快捷栏里「当前所在」的那一格上（手机上长按），它正上方会冒出一把弹弓，停留几秒。
 * 把石子往反方向拉，松手后石子沿抛物线飞出去（左右都行），落在哪个板块上就直接冲过去。
 * 拉得越远飞得越远；拉的时候有一串虚线点预告落点，对应的板块会亮起来。
 */
const GRAVITY = 1700; // px/s²
const POWER = 9.5; // 每拉 1px 给的初速度（px/s）
const MAX_PULL = 78;
const SHOW_MS = 3500; // 鼠标离开后弹弓还留多久

interface Options {
  slots: HTMLElement[];
  goTo: (i: number) => void;
}

const SVG = `
<svg class="ss-fork" viewBox="0 0 48 60" aria-hidden="true" shape-rendering="crispEdges">
  <path d="M22 58h4V34h-4z" fill="#7a5034"/><path d="M25 58h1V34h-1z" fill="#5e3d28"/>
  <path d="M22 36 8 14l3-2 13 21z" fill="#8a5f40"/><path d="M26 36 40 14l-3-2-13 21z" fill="#6e4a31"/>
  <path d="M6 10h7v6H6zM35 10h7v6h-7z" fill="#9a6a47"/><path d="M6 10h7v2H6zM35 10h7v2h-7z" fill="#b98a62"/>
</svg>
<svg class="ss-bands" aria-hidden="true"><path class="ss-band" /><path class="ss-band" /></svg>
<svg class="ss-aim" aria-hidden="true"></svg>
<span class="ss-ball" role="button" tabindex="-1" aria-label="弹弓石子：拖动后松手发射"></span>`;

export function startSlingshot({ slots, goTo }: Options) {
  if (!slots.length || !window.PointerEvent) return;
  let origin = slots[0]; // 弹弓立在哪一格：当前所在的板块
  const current = () => slots.findIndex((s) => s.classList.contains('is-active'));
  const box = document.createElement('div');
  box.className = 'slingshot';
  box.hidden = true;
  box.innerHTML = SVG;
  document.body.append(box);
  const ball = box.querySelector<HTMLElement>('.ss-ball')!;
  const bands = [...box.querySelectorAll<SVGPathElement>('.ss-band')];
  const aim = box.querySelector<SVGSVGElement>('.ss-aim')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let hideTimer = 0;
  let dragging = false;
  let flying = false;
  let pull = { x: 0, y: 0 };
  let suppressClick = false;

  /** 弹弓立在「起点」格子正上方；返回皮兜（石子静止处）的屏幕坐标 */
  function place() {
    const r = origin.getBoundingClientRect();
    box.style.left = `${r.left + r.width / 2 - 24}px`;
    const barTop = origin.closest('.hotbar')?.getBoundingClientRect().top ?? r.top;
    box.style.top = `${barTop - 58}px`; // 叉子底端正好立在快捷栏的上沿
    const b = box.getBoundingClientRect();
    return { x: b.left + 24, y: b.top + 22 };
  }

  function show() {
    if (document.documentElement.classList.contains('reading')) return;
    clearTimeout(hideTimer);
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
      window.setTimeout(() => {
        box.hidden = true;
        box.classList.remove('ss-in', 'ss-out');
        clearTargets();
      }, 220);
    }, ms);
  }

  function resetBall() {
    pull = { x: 0, y: 0 };
    ball.style.transform = 'translate(0px, 0px)';
    ball.classList.remove('ss-fly');
    drawBands();
    aim.innerHTML = '';
  }

  /** 两根皮筋：从叉子顶端连到石子 */
  function drawBands() {
    const bx = 24 + pull.x;
    const by = 22 + pull.y;
    bands[0].setAttribute('d', `M9 13 L${bx} ${by}`);
    bands[1].setAttribute('d', `M39 13 L${bx} ${by}`);
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
    return slots.findIndex((s) => {
      const r = s.getBoundingClientRect();
      return x >= r.left - 4 && x <= r.right + 4;
    });
  }

  function velocity() {
    return { vx: -pull.x * POWER, vy: -pull.y * POWER };
  }

  function preview() {
    const start = place();
    const sx = start.x + pull.x;
    const sy = start.y + pull.y;
    const { vx, vy } = velocity();
    const land = landing({ x: sx, y: sy }, vx, vy);
    const i = slotAt(land.x);
    const from = slots.indexOf(origin);
    slots.forEach((s, k) => s.classList.toggle('ss-target', k === i && k !== from));
    // 虚线点：相对弹弓盒子画
    const b = box.getBoundingClientRect();
    let dots = '';
    for (let k = 1; k <= 14; k++) {
      const t = (land.t * k) / 14;
      const x = sx + vx * t - b.left;
      const y = sy + vy * t + (GRAVITY * t * t) / 2 - b.top;
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === 14 ? 3.5 : 2.2}" />`;
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
      ball.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
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
        resetBall();
        scheduleHide(600);
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
    ball.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    drawBands();
    if (len > 10) preview();
    else {
      aim.innerHTML = '';
      clearTargets();
    }
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('ss-drag');
    // 拉得太短、或者几乎是竖直地拉（弹不出去）：石子回位
    if (Math.hypot(pull.x, pull.y) < 12 || Math.abs(pull.x) < 4) {
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
