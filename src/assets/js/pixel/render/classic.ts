/**
 * Canvas 2D 渲染器：按 COMPOSE 把绘制清单合成到三张画布上，和改用绘制清单之前的画法逐像素一致。
 * 只认 fade / night / darkOnly，光效开关（lit / depth / bloom）、前景画布、毛玻璃都不管。
 * 只在迁移到 WebGPU 期间保留，用来证明 sim/ 的改动没有改变画面；WebGPU 渲染器默认启用后删掉。
 */
import { loadAtlas } from '../atlas.js';
import { COMPOSE, ERASE, FLIP, NIGHT, SOLID, STRIDE, type Canvases, type Commands, type DrawList, type Group, type Renderer } from '../drawlist.js';
import { FADE_STOPS } from '../sim/util.js';

const NIGHT_CSS = `rgba(${NIGHT[0]}, ${NIGHT[1]}, ${NIGHT[2]}, ${NIGHT[3]})`;

export function createClassicRenderer(c: Canvases): Renderer {
  const sk = c.sky.getContext('2d')!;
  const g = c.world.getContext('2d')!;
  const hc = c.hero.getContext('2d')!;
  // 要单独盖夜色、又不是直接画在目标画布上的组，先画到离屏画布上
  const scratch = document.createElement('canvas').getContext('2d')!;
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

  /** 在 ctx 上已经画好的东西上整体做一次合成操作（淡出、夜色） */
  function apply(ctx: CanvasRenderingContext2D, op: GlobalCompositeOperation, style: string | CanvasGradient) {
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = style;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * 一张画布的各组按顺序合成。要整体处理的组（淡出、夜色、自发光层里还有擦除命令）得单独画，
   * 否则会连带影响下面已经画好的组；画布上还空着的时候（第一组）可以直接画在画布上
   */
  function compose(target: CanvasRenderingContext2D, groups: Group[], dl: DrawList, dark: boolean) {
    target.clearRect(0, 0, W, H);
    groups.forEach((gr, i) => {
      if ((gr.darkOnly && !dark) || gr.gpuOnly) return;
      const night = gr.night && dark;
      const own = gr.fade || gr.night || gr.darkOnly;
      const ctx = own && i > 0 ? scratch : target;
      if (ctx !== target) ctx.clearRect(0, 0, W, H);
      for (const l of gr.layers) run(ctx, dl.layers[l]);
      if (gr.fade) apply(ctx, 'destination-in', fade!);
      if (night) apply(ctx, 'source-atop', NIGHT_CSS);
      if (ctx !== target) target.drawImage(ctx.canvas, 0, 0);
    });
  }

  return {
    depthOfField: false,
    resize(w, h) {
      W = w;
      H = h;
      for (const cv of [c.sky, c.world, c.hero, scratch.canvas]) {
        cv.width = w;
        cv.height = h;
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
