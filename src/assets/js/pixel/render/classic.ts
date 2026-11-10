/**
 * Canvas 2D 渲染器：按 COMPOSE 把绘制清单合成到三张画布上，和改用绘制清单之前的画法逐像素一致。
 * 只在迁移到 WebGPU 期间保留，用来证明 sim/ 的拆分没有改变画面；WebGPU 渲染器默认启用后删掉。
 */
import { loadAtlas } from '../atlas.js';
import { COMPOSE, ERASE, FLIP, NIGHT, SOLID, STRIDE, type Commands, type DrawList, type LayerRule, type Renderer } from '../drawlist.js';
import { FADE_STOPS } from '../sim/util.js';

export interface Canvases {
  sky: HTMLCanvasElement;
  world: HTMLCanvasElement;
  hero: HTMLCanvasElement;
}

const NIGHT_CSS = `rgba(${NIGHT[0]}, ${NIGHT[1]}, ${NIGHT[2]}, ${NIGHT[3]})`;

export function createClassicRenderer(c: Canvases): Renderer {
  const sk = c.sky.getContext('2d')!;
  const g = c.world.getContext('2d')!;
  const hc = c.hero.getContext('2d')!;
  // 要单独盖夜色或单独合成的层先画到离屏画布上
  const off = () => document.createElement('canvas').getContext('2d')!;
  const scratch = { fg: off(), emissive: off(), actors: off() } as Record<string, CanvasRenderingContext2D>;
  let atlas: HTMLImageElement | null = null;
  loadAtlas().then((img) => (atlas = img), (err) => console.error('[world]', err));
  let fade: CanvasGradient | null = null;
  let W = 0;
  let H = 0;

  function run(ctx: CanvasRenderingContext2D, cmds: Commands) {
    const d = cmds.data;
    for (let i = 0; i < cmds.count; i++) {
      const o = i * STRIDE;
      const flags = d[o];
      ctx.globalAlpha = d[o + 1];
      ctx.globalCompositeOperation = flags & ERASE ? 'destination-out' : 'source-over';
      const dx = d[o + 2], dy = d[o + 3], dw = d[o + 4], dh = d[o + 5];
      if (flags & SOLID) {
        ctx.fillStyle = `rgb(${d[o + 10]},${d[o + 11]},${d[o + 12]})`;
        ctx.fillRect(dx, dy, dw, dh);
      } else if (atlas) {
        const sx = d[o + 6], sy = d[o + 7], sw = d[o + 8], sh = d[o + 9];
        if (flags & FLIP) {
          ctx.save();
          ctx.translate(dx + dw, dy);
          ctx.scale(-1, 1);
          ctx.drawImage(atlas, sx, sy, sw, sh, 0, 0, dw, dh);
          ctx.restore();
        } else ctx.drawImage(atlas, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function night(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = NIGHT_CSS;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** 把一张画布的各层按规则合成上去 */
  function compose(target: CanvasRenderingContext2D, rules: LayerRule[], dl: DrawList, dark: boolean) {
    target.clearRect(0, 0, W, H);
    for (const r of rules) {
      if (r.darkOnly && !dark) continue;
      const cmds = dl.layers[r.layer];
      if (r.fade) {
        // 淡出只作用在这一层：目标画布上这时只有它
        run(target, cmds);
        target.globalCompositeOperation = 'destination-in';
        target.fillStyle = fade!;
        target.fillRect(0, 0, W, H);
        target.globalCompositeOperation = 'source-over';
      } else if (r.night || scratch[r.layer]) {
        const s = scratch[r.layer] ?? target;
        if (s !== target) s.clearRect(0, 0, W, H);
        run(s, cmds);
        if (r.night && dark) night(s);
        if (s !== target) target.drawImage(s.canvas, 0, 0);
      } else run(target, cmds);
    }
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
      for (const s of Object.values(scratch)) {
        s.canvas.width = w;
        s.canvas.height = h;
      }
      // 改画布尺寸会重置上下文状态：主画布和主角画布按像素放大，不做平滑
      g.imageSmoothingEnabled = false;
      hc.imageSmoothingEnabled = false;
      fade = g.createLinearGradient(0, 0, 0, H);
      for (const [t, a] of FADE_STOPS) fade.addColorStop(t, `rgba(0,0,0,${a})`);
    },
    draw(dl, dark) {
      compose(sk, COMPOSE.sky, dl, dark);
      compose(g, COMPOSE.world, dl, dark);
      compose(hc, COMPOSE.hero, dl, dark);
    },
  };
}
