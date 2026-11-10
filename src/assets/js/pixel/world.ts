/**
 * 像素世界：页面纵向滚动 -> 世界横向前进。这个文件只做编排：
 * 画布与尺寸、主题、滚动进度和相机、内容面板、隐藏页，以及每帧按顺序调用各模块，再把绘制清单交给渲染器。
 *
 *   sim/         模拟：只算状态、往绘制清单里写，不碰画布（可以在 Node 里测）
 *     biomes.ts    群系数据表、地形高度、配色、布景生成（纯函数）
 *     terrain.ts   远景三层和前景地面
 *     sky.ts       太阳、月亮、星星
 *     lights.ts    自发光像素、光晕、营火
 *     particles.ts 天气、灰尘、火星
 *     eggs.ts      路牌 / 女孩 / 彩狸猫三个彩蛋
 *     hero.ts      主角
 *   drawlist.ts  模拟和渲染器之间的约定：图层、命令格式、各层怎么合成
 *   render/      渲染器：只读绘制清单
 *   input.ts     滚轮、触屏、键盘、点击
 *
 * 每帧写清单的顺序：天空 -> 远景 -> 布景、地面 -> 角色 -> 主角 -> 光晕 -> 气泡、粒子（随机数的取用顺序也按这个）。
 */
import { BIOMES, GROUND, OFF, SECTION, SLOT, biomeNum, heightAt, paletteAt, setPieces, slotItem, weights, type Item } from './sim/biomes.js';
import { buildScenery, CAMPFIRE_FLAME, COTTAGE, LAMP_BULB } from './sim/scenery.js';
import { drawGround, drawLayer } from './sim/terrain.js';
import { drawSky, makeStars } from './sim/sky.js';
import { Particles } from './sim/particles.js';
import { drawGlows, emit, type Glow } from './sim/lights.js';
import { Eggs, inside } from './sim/eggs.js';
import { CHAR_H, Hero } from './sim/hero.js';
import { Fireworks, isBirthday } from './sim/festive.js';
import { Lanterns } from './sim/lanterns.js';
import { clamp, easeInOut, mix } from './sim/util.js';
import type { Frame } from './sim/frame.js';
import { DrawList, type Renderer } from './drawlist.js';
import { pickRenderer } from './render/index.js';
import { drawFront } from './sim/front.js';
import { UiBridge } from './ui-bridge.js';
import { bindInput } from './input.js';

const STRIP_GROUND = 10; // 阅读时世界下沉，只露出这么高的地面
const SECRET_DUR = 0.55; // 进出隐藏页的时长，和浏览器平滑滚动一致
const MIN_RUN = 15; // 相机速度（逻辑像素/秒）低于这个就算停下

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  sections: HTMLElement[];
  panels: HTMLElement[];
  slots: HTMLElement[];
  /** 起点左边藏着的一页（双击路牌翻过来才能进） */
  secretPanel?: HTMLElement | null;
}

function overlayCanvas(id: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.id = id;
  c.setAttribute('aria-hidden', 'true');
  return c;
}

/**
 * 四张画布：天空在世界和卡片后面；世界跟着相机做亚像素平移；主角始终在屏幕正中、不做平移；前景压在卡片上面。
 */
export function startWorld({ canvas, sections, panels, slots, secretPanel }: WorldOptions) {
  const skyCanvas = overlayCanvas('sky');
  const heroCanvas = overlayCanvas('hero');
  const frontCanvas = overlayCanvas('front');
  canvas.before(skyCanvas);
  canvas.after(heroCanvas);
  document.body.append(frontCanvas); // 压在卡片上面（home.css 里 z-index 最高、点击穿透）
  const all = [canvas, skyCanvas, heroCanvas, frontCanvas];
  const renderer: Renderer = pickRenderer({ sky: skyCanvas, world: canvas, hero: heroCanvas, front: frontCanvas });
  const ui = new UiBridge(canvas);
  const dl = new DrawList();
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const N = sections.length;
  const sc = buildScenery();
  const particles = new Particles();
  const eggs = new Eggs();
  const hero = new Hero();
  const birthday = isBirthday();
  hero.hat = birthday;
  const fireworks = birthday ? new Fireworks() : null;
  const lanterns = new Lanterns();
  let fireX: number | null = null; // 画面里营火的世界坐标（烟花从这里升起）

  const fr: Frame = {
    dl, W: 0, H: 0, S: 4, HALF: 0, camX: 0, camLeft: 0, frac: 0, p: 0,
    dark: false, bg: '#eef1f5', time: 0, reduced: reducedMq.matches, running: false, visH: 0,
  };
  let stars = makeStars(1, 1);

  /*
   * 手机地址栏随滚动收起、展开，视口高度会变几十像素。这时不重算像素大小和卡片缩放（否则 S 可能 3<->4 跳一下，
   * 整个世界缩放、卡片重排），画布按这个宽度下见过的最大高度分配，并贴着屏幕底边（见 home.css）：
   * 地址栏展开时画布顶上一截在屏幕外，收起时露出来，不用重建画布。只有宽度变了或高度变化超过 BAR（转屏、弹出键盘）才整体重算。
   */
  const coarse = window.matchMedia('(pointer: coarse)');
  const BAR = 160;
  let layoutW = -1;
  let layoutH = 0;
  let tallH = 0;
  function resize() {
    const vw = root.clientWidth;
    const ih = window.innerHeight;
    const barOnly = coarse.matches && vw === layoutW && Math.abs(ih - layoutH) <= BAR;
    if (barOnly) {
      if (ih <= tallH) return;
      tallH = ih;
    } else {
      layoutW = vw;
      layoutH = ih;
      // 触屏上预留一截地址栏的高度，第一次收起地址栏时也不用重建画布
      tallH = ih + (coarse.matches ? 120 : 0);
    }
    const vh = layoutH;
    let S = Math.max(2, Math.round(vh / 190));
    if (vw / S < 96) S = Math.max(2, Math.floor(vw / 96));
    fr.S = S;
    fr.HALF = Math.ceil(vw / S) / 2;
    fr.W = Math.ceil(vw / S) + 1; // 比视口多 1 列，亚像素平移时右边缘不露底
    fr.H = Math.ceil(tallH / S);
    // 画布的 CSS 尺寸在这里定，实际分辨率由渲染器定（见 Renderer.resize）
    for (const c of all) {
      c.style.width = `${fr.W * S}px`;
      c.style.height = `${fr.H * S}px`;
    }
    renderer.resize(fr.W, fr.H, S);
    stars = makeStars(fr.W, fr.H);
    root.style.setProperty('--px', `${S}px`);
    // 大屏上世界的像素按屏高放大，卡片也跟着放大（以 1440x900 为基准），比例才协调
    root.style.setProperty('--ui', clamp(Math.min(vw / 1440, vh / 900), 1, 2).toFixed(3));
    // 面板底边留出：地面 + 小人 + 一点余量
    root.style.setProperty('--stage', `${(GROUND + CHAR_H + 14) * S}px`);
    root.style.setProperty('--ground', `${GROUND * S}px`);
    root.style.setProperty('--strip', `${(STRIP_GROUND + CHAR_H + 8) * S}px`);
    root.style.setProperty('--sink', `${(GROUND - STRIP_GROUND) * S}px`);
  }
  resize();
  window.addEventListener('resize', resize);

  /* 主题：雾色 = 页面底色 + 一点群系色调 */
  function readTheme() {
    fr.dark = root.dataset.theme === 'dark';
    fr.bg = getComputedStyle(root).getPropertyValue('--bg').trim() || (fr.dark ? '#15181d' : '#eef1f5');
  }
  readTheme();
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /**
   * 滚动进度：按各板块的实际位置算，而不是 scrollY / 一屏高度：手机地址栏收起展开时 100dvh 会变，
   * 用固定除数会让停稳的板块算成 2.03 之类，卡片就偏到一边。离整数很近时直接取整。
   */
  function progress(): number {
    const y = window.scrollY;
    let i = 0;
    while (i < N - 1 && sections[i + 1].offsetTop <= y) i++;
    const top = sections[i].offsetTop;
    const next = i < N - 1 ? sections[i + 1].offsetTop : top + (sections[i].offsetHeight || window.innerHeight);
    const v = clamp(i + (y - top) / Math.max(1, next - top), 0, N - 1);
    return Math.abs(v - Math.round(v)) < 0.015 ? Math.round(v) : v;
  }

  fr.p = progress();
  fr.camX = fr.p * SECTION;
  let lastCam = fr.camX;
  hero.y = fr.H - Math.round(heightAt(fr.camX));
  let runTimer = 0;
  let activeIdx = -1;
  let lastTint = '';
  let reading = root.classList.contains('reading');
  let readStart = 0; // 进入阅读后先全速跑一会（小人坐下、世界下沉），再降帧
  let lastDraw = 0;
  let secret = false; // 正在隐藏页里
  /**
   * 进出隐藏页的过渡进度 0..1。别的板块之间是浏览器平滑滚动再叠一层相机跟随；
   * 隐藏页不靠滚动，按同样的时长和缓动走，速度就一致了
   */
  let secretMix = 0;
  const camTarget = () => (fr.p + (-1 - fr.p) * easeInOut(secretMix)) * SECTION;

  function enterSecret() {
    secret = true;
    root.classList.add('secret-open');
  }
  function exitSecret() {
    secret = false;
    eggs.signOpen = false; // 走出来就翻回去，想再进得重新双击
    root.classList.remove('secret-open');
  }

  /* ---------- 面板与快捷栏 ---------- */

  function place(panel: HTMLElement, i: number) {
    const d = i - fr.camX / SECTION; // 跟着相机走，进出隐藏页也是平滑的
    const op = clamp(1 - Math.abs(d) * 1.6);
    panel.style.transform = `translate3d(${(d * SECTION * fr.S).toFixed(1)}px,0,0)`;
    panel.style.opacity = op.toFixed(3);
    panel.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
  }

  function updatePanels() {
    if (secretPanel) {
      place(secretPanel, -1);
      secretPanel.toggleAttribute('inert', !secret || reading);
    }
    panels.forEach(place);
    const idx = secret ? -1 : Math.round(fr.p);
    if (idx === activeIdx) return;
    activeIdx = idx;
    // 地址栏跟着当前板块走（触屏原生滑动、键盘、快捷栏都一样）：起点不带锚点，其他板块是 #posts 这种
    if (idx >= 0 && !reading && location.pathname === '/') {
      const want = idx === 0 ? '' : `#${sections[idx].id}`;
      if (location.hash !== want) history.replaceState(history.state, '', want || location.pathname + location.search);
    }
    panels.forEach((panel, i) => {
      const on = i === idx;
      panel.toggleAttribute('inert', !on);
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    slots.forEach((s, i) => {
      s.classList.toggle('is-active', i === idx);
      if (i === idx) s.setAttribute('aria-current', 'true');
      else s.removeAttribute('aria-current');
    });
  }

  function goTo(i: number) {
    if (secret) exitSecret();
    const target = sections[clamp(i, 0, N - 1)];
    target.scrollIntoView({ behavior: reducedMq.matches ? 'auto' : 'smooth' });
  }

  slots.forEach((s, i) =>
    s.addEventListener('click', (ev) => {
      ev.preventDefault();
      goTo(i);
    }),
  );

  /* ---------- 翻页与输入 ---------- */

  let stepLock = 0;
  function step(dir: -1 | 1, wheel = false) {
    const now = performance.now();
    if (!wheel && now < stepLock) return;
    stepLock = now + 650; // 一次横扫只走一格，惯性滚动不会连跳
    // 隐藏页：路牌翻过来以后，在起点往回走一步就进去；从里面往前走就出来
    if (secret) {
      if (dir > 0) exitSecret();
      return;
    }
    if (dir < 0 && Math.round(fr.p) === 0 && eggs.signOpen) {
      enterSecret();
      return;
    }
    goTo(Math.round(fr.p) + dir);
  }

  // 画布贴底、可能比视口高（见 resize），屏幕坐标先减去画布顶边
  const canvasTop = () => window.innerHeight - fr.H * fr.S;
  const toLogical = (x: number, y: number) => [x / fr.S + fr.frac, (y - canvasTop()) / fr.S] as const;
  bindInput({
    step,
    goTo,
    sections: N,
    reading: () => reading,
    inSecret: () => secret,
    tap(x, y, double) {
      const [lx, ly] = toLogical(x, y);
      const lantern = lanterns.hitAt(lx, ly);
      if (lantern) {
        showTip(lantern, 4000);
        return true;
      }
      return eggs.tap(lx, ly, double, Math.round(fr.p) === 0 && !secret);
    },
    hoverable(x, y) {
      const [lx, ly] = toLogical(x, y);
      const lantern = lanterns.hitAt(lx, ly);
      if (lantern) showTip(lantern, 0);
      else if (!tipHold) hideTip();
      return !!lantern || eggs.spots.some((sp) => inside(sp, lx, ly));
    },
  });

  /* 留言灯笼的提示：DOM 浮层（中文得用真字体），跟着灯笼的屏幕位置 */
  const tip = document.createElement('div');
  tip.className = 'lantern-tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  document.body.append(tip);
  let tipHold = 0;
  let tipFor: unknown = null;
  function showTip(h: { note: { a: string; t: string; d: string }; x0: number; x1: number; y0: number }, holdMs: number) {
    if (tipFor !== h.note) {
      tipFor = h.note;
      tip.replaceChildren();
      const who = document.createElement('b');
      who.textContent = h.note.a;
      const when = document.createElement('span');
      when.textContent = h.note.d;
      const text = document.createElement('p');
      text.textContent = h.note.t;
      tip.append(who, when, text);
    }
    tip.style.left = `${((h.x0 + h.x1) / 2 - fr.frac) * fr.S}px`;
    tip.style.top = `${h.y0 * fr.S + canvasTop()}px`;
    tip.hidden = false;
    clearTimeout(tipHold);
    tipHold = holdMs ? window.setTimeout(() => ((tipHold = 0), hideTip()), holdMs) : 0;
  }
  function hideTip() {
    tip.hidden = true;
    tipFor = null;
  }

  /*
   * 手机上惯性滚动偶尔停在两屏之间（scroll-snap 没吸附到位），卡片就偏到一边、露不全。
   * 滚动停下 160ms 后如果还不在整屏上，就自己吸到最近的一屏。
   */
  let settleTimer = 0;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (reading) return;
        const v = progress();
        const k = Math.round(v);
        if (v !== k) sections[k].scrollIntoView({ behavior: reducedMq.matches ? 'auto' : 'smooth' });
      }, 160);
    },
    { passive: true },
  );

  /* ---------- 布景 ---------- */

  const glows: Glow[] = [];

  function drawItems() {
    const { W, H, camLeft } = fr;
    glows.length = 0;
    const items: Item[] = [];
    for (let s = Math.floor((camLeft - 60) / SLOT), s1 = Math.ceil((camLeft + W + 60) / SLOT); s <= s1; s++) {
      const it = slotItem(s, sc);
      if (it) items.push(it);
    }
    const sec0 = Math.floor((camLeft - 160) / SECTION);
    const sec1 = Math.ceil((camLeft + W + 160) / SECTION);
    for (let s = Math.max(-OFF, sec0); s <= Math.min(N - 1, sec1); s++) items.push(...setPieces(s, sc));
    items.sort((p, q) => p.z - q.z || p.wx - q.wx);
    for (const it of items) {
      const sp = it.sprite;
      const x = Math.round(it.wx - sp.width / 2 - camLeft);
      if (x > W || x + sp.width < 0) continue;
      // 底边陷进地面 1-2 像素，坡上取两端较低处，避免悬空
      const ground = Math.max(heightAt(it.wx - sp.width * 0.25), heightAt(it.wx + sp.width * 0.25));
      const base = H - Math.round(Math.min(ground, heightAt(it.wx))) + (it.z === 0 ? 2 : 1) - (it.lift ?? 0);
      const y = base - sp.height;
      if (!it.egg || !eggs.drawItem(fr, it, x, y, base)) {
        dl.sprite('fg', sp, x, y);
        emit(fr, sp, x, y);
      }
      if (it.glow === 'lamp') glows.push({ x: x + LAMP_BULB[0], y: y + LAMP_BULB[1], kind: 'lamp', wx: it.wx });
      if (it.glow === 'fire') glows.push({ x: x + CAMPFIRE_FLAME[0], y: y + CAMPFIRE_FLAME[1], kind: 'fire', wx: it.wx });
      if (it.glow === 'window') {
        glows.push({ x: x + COTTAGE.window[0], y: y + COTTAGE.window[1], kind: 'window', wx: it.wx });
        glows.push({ x: x + COTTAGE.lantern[0], y: y + COTTAGE.lantern[1], kind: 'lamp', wx: it.wx + 7 });
        // 炊烟
        if (!fr.reduced && Math.random() < 0.06) {
          const cx = it.wx - sp.width / 2 + COTTAGE.chimney[0];
          particles.spawn({ x: cx + (Math.random() - 0.5) * 2, y: y + COTTAGE.chimney[1], vx: 0.05 + Math.random() * 0.06, vy: -0.12 - Math.random() * 0.08, life: 0, max: 140 + Math.random() * 60, color: fr.dark ? '#7d8494' : '#c9ced8', size: Math.random() < 0.4 ? 2 : 1, kind: 'smoke' });
        }
      }
    }
    fireX = glows.find((gl) => gl.kind === 'fire')?.wx ?? null;
  }

  /* ---------- 主循环 ---------- */

  /** 推进相机、小人和时间 */
  function update(dt: number) {
    fr.time += dt;
    fr.reduced = reducedMq.matches;
    fr.p = progress();
    secretMix = fr.reduced ? (secret ? 1 : 0) : clamp(secretMix + (secret ? dt : -dt) / SECRET_DUR);
    const target = camTarget();
    if (fr.reduced) fr.camX = target;
    else fr.camX += (target - fr.camX) * Math.min(1, dt * 10);
    if (Math.abs(target - fr.camX) < 0.05) fr.camX = target;

    const v = fr.camX - lastCam;
    lastCam = fr.camX;
    // 相机是指数缓动，快到站时速度会拖很久的小尾巴。按跑过的距离推进跑步帧的话，这段尾巴里
    // 一帧要停零点几秒，看着像慢动作抬脚又放下。所以：速度低于 MIN_RUN 就算停下（换回站立），
    // 跑步帧按速度推进、但每秒至少 6 帧、至多 14 帧（画师原稿是每帧 0.125 秒）
    const speed = dt > 0 ? Math.abs(v) / dt : 0;
    if (speed > MIN_RUN) {
      runTimer = 0.12;
      hero.facing = v > 0 ? 1 : -1;
      hero.stride += dt * clamp(speed / 5, 6, 14) * 5;
    } else runTimer -= dt;
    fr.running = runTimer > 0 && !fr.reduced;

    const left = fr.camX - fr.HALF;
    fr.camLeft = Math.floor(left);
    fr.frac = fr.reduced ? 0 : left - fr.camLeft;
    canvas.style.translate = `${(-fr.frac * fr.S).toFixed(2)}px 0`;
    const groundY = fr.H - Math.round(heightAt(fr.camX));
    hero.y = fr.reduced ? groundY : hero.y + (groundY - hero.y) * Math.min(1, dt * 18);

    if (fr.running && Math.random() < 0.5) {
      const pal = paletteAt(fr.camX);
      particles.spawn({ x: fr.camX - hero.facing * 4, y: hero.y - 1, vx: -hero.facing * (0.2 + Math.random() * 0.3), vy: -0.2 - Math.random() * 0.2, life: 0, max: 22, color: pal.rim, size: 1, kind: 'dust' });
    }

    const [i, j, t] = weights(fr.camX);
    const tint = mix(BIOMES[i].tint, BIOMES[j].tint, t);
    if (tint !== lastTint) {
      lastTint = tint;
      root.style.setProperty('--tint', tint);
    }
    dl.env = { tint, rays: biomeNum(fr.camX, (b) => b.rays) };
  }

  /** 写这一帧的绘制清单，交给渲染器（各层怎么合成见 drawlist.ts 的 COMPOSE） */
  function render(dt: number) {
    const { dark } = fr;
    dl.clear(); // 环境（dl.env）在 update 里按相机位置算好，不随清单清掉
    fr.visH = Math.ceil(window.innerHeight / fr.S);
    drawSky(fr, stars);
    lanterns.draw(fr);
    fireworks?.draw(fr, dt, fireX);
    drawLayer(fr, 'far', 0.18, dark ? 0.55 : 0.62);
    drawLayer(fr, 'mid', 0.42, dark ? 0.32 : 0.36);
    drawLayer(fr, 'near', 0.7, 0.14);
    eggs.beginFrame();
    drawItems();
    drawGround(fr);
    eggs.drawActors(fr, dt);
    hero.draw(fr, fr.running, reading && !fr.running && Math.abs(camTarget() - fr.camX) < 1.5);
    drawGlows(fr, glows, particles);
    eggs.drawBubbles(fr, dt);
    particles.weather(fr, dt);
    particles.draw(fr, dt);
    drawFront(fr, sc);
    // 毛玻璃要量卡片这一帧的位置，所以面板先摆好（frame 里 updatePanels 在 render 之前）
    renderer.draw(dl, dark, ui.view(dt, fr.reduced));
  }

  /**
   * 一帧出错（比如某个模块的边界情况）不能让整个世界冻住：记一次日志，下一帧照常（清单每帧重写）。
   * 同一个错误反复出现时只在控制台报前几次。
   */
  let errors = 0;
  function guard(fn: () => void) {
    try {
      fn();
    } catch (err) {
      if (errors++ < 3) console.error('[world] frame error', err);
    }
  }

  let last = performance.now();
  function frame(now: number) {
    requestAnimationFrame(frame); // 先排下一帧，这一帧怎么出错都不会断
    // 阅读时世界只露出一条，降到约 20 帧省电；相机还在赶路时照常全速
    if (reading && fr.time - readStart > 1.5 && fr.camX === camTarget() && now - lastDraw < 50) return;
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    guard(() => update(dt));
    guard(updatePanels);
    guard(() => render(dt));
  }
  requestAnimationFrame(frame);
  updatePanels();
  // 卡片摆好位置了，可以淡入（home.css 在这之前把它们藏着，免得叠在一起）
  root.classList.add('world-on');

  return {
    goTo,
    /** 进入 / 离开阅读状态：小人到地方后坐下看书，世界降帧 */
    setReading(on: boolean) {
      reading = on;
      readStart = fr.time;
      hero.resetReading(fr.time);
    },
    /** 留言板等隐藏页里的面板页：相机停在秋林 */
    enterSecret() {
      if (!secret) enterSecret();
      if (fr.time < 0.2) {
        // 直接打开留言板这类隐藏页里的页面：相机直接就位，不从起点走过去
        secretMix = 1;
        fr.camX = lastCam = -SECTION;
      }
    },
    get inSecret() {
      return secret;
    },
  };
}

export type World = ReturnType<typeof startWorld>;
