/**
 * 绘制清单：模拟（sim/）和渲染器（render/）之间唯一的约定。
 *
 * sim/ 每帧只往清单里写「在哪一层、哪个位置、画图集里的哪块 / 填什么颜色」，不碰画布；
 * 渲染器只读清单，按 COMPOSE 里写好的顺序和规则把各层合成到画布上，不知道画的是什么。
 * 坐标都是逻辑像素（一格 = 一个像素画像素）。有两种坐标，每一层只用其中一种，混用就会在镜头移动时一格一格地跳：
 *   世界坐标  原点在世界画布左上角（绝大多数层）。世界画布本身由 CSS 做亚像素平移，
 *             所以按整格画在这里、跟着镜头走的东西，在屏幕上是连续移动的
 *   屏幕坐标  原点在屏幕左上角：sky 层，和标了 screen 的光斑。渲染器替它们抵消世界画布的平移；
 *             sky 层整层随视差挪动的小数写在 shift.sky，渲染器合成、辉光、毛玻璃时都按它取样
 * 天上跟着世界走的东西（孔明灯、烟花）放 aloft 层，不能放 sky 层。
 */
import type { Sprite } from './atlas.js';
import { rgb } from './sim/util.js';

/**
 * 图层，按合成顺序排列。每层先单独画好，再合成：
 *   sky      日月星：屏幕坐标，阅读时不跟着下沉
 *   far      远山 \
 *   mid      丘陵  > 远景三层：越远越糊、越往天空的颜色靠（空气透视）
 *   near     树线 /
 *   back     后排树：树线和主平面之间一排真正的树，比主平面走得慢、糊一点
 *   fg       布景和地面，深色模式下变暗
 *   spin     转着画的东西（风车头）：和 fg 一样是布景，但这一层按屏幕分辨率画，转出来的边缘按屏幕像素走
 *   shadow   布景和主角投在地上的影子（被日月压扁、往背光的一边斜过去）
 *   aloft    天上跟着世界走的东西（孔明灯、烟花）：世界坐标，和人物在同一个平面上（不被远山、树线挡住），
 *            不吃夜色（夜里单独一套亮着的颜色），画在布景前面、人物后面
 *   emissive 灯泡、亮着的窗：只在深色模式合成，叠在夜色之上
 *   glow     营火火焰
 *   actors   女孩、猫：画在火焰之后（经过窗前会挡光），深色模式下变暗
 *   over     气泡和粒子，不变暗
 *   hero     主角画布：始终在屏幕正中，不跟世界做亚像素平移
 *   front    镜头前的前景（画面两边的大树和灌木）：单独一张画布，压在卡片上面，糊得很厉害
 */
export const LAYERS = ['sky', 'far', 'mid', 'near', 'back', 'fg', 'spin', 'shadow', 'aloft', 'emissive', 'glow', 'actors', 'over', 'hero', 'front'] as const;
export type LayerName = (typeof LAYERS)[number];

/** 合成组：组里的层按顺序叠好以后，再整体处理（变暗、照亮、调色……），然后叠到画布上 */
export interface Group {
  layers: LayerName[];
  /** 贴着屏幕：不跟世界做亚像素平移、阅读时不跟着下沉（天空） */
  screen?: boolean;
  /** 远景：关掉景深时自下而上淡出（util.ts 的 FADE_STOPS），开着时按深度往天空的颜色靠 */
  fade?: boolean;
  /** 随夜色变暗（夜里乘偏蓝的暗光，晨昏时按夜色的浓淡） */
  night?: boolean;
  /** 只在有夜色时合成（层里的东西自己按夜色的浓淡画） */
  darkOnly?: boolean;
  /** 被点光源照亮：灯光加在环境光上（白天也有，营火旁边比别处亮、偏暖） */
  lit?: boolean;
  /**
   * 自己发光，亮度是本身颜色的几倍（线性空间），白天和夜里各一个数。超过 1 的部分经调色压成发白的芯，
   * 也按这个倍数进辉光
   */
  emit?: { day: number; night: number };
  /**
   * 这组的层按屏幕分辨率画（不是逻辑像素）：转着画的精灵（风车头）边缘按屏幕像素走，转起来是顺的。
   * 精灵本身的像素还是图集里那么大，只是转出来的边不再一格一格地跳
   */
  hires?: boolean;
  /** 每层离对焦的主平面多远（0 = 主平面），开了景深时按这个模糊；镜头前的前景也用正数 */
  depth?: number[];
}
export type CanvasName = 'world' | 'hero' | 'front';
export const COMPOSE: Record<CanvasName, Group[]> = {
  world: [
    { layers: ['sky'], screen: true },
    { layers: ['far', 'mid', 'near'], fade: true, depth: [4, 3.5, 3] },
    { layers: ['back'], night: true, lit: true, depth: [2] },
    { layers: ['fg'], night: true, lit: true },
    { layers: ['spin'], night: true, lit: true, hires: true },
    { layers: ['shadow'] },
    { layers: ['aloft'] },
    { layers: ['emissive'], darkOnly: true },
    { layers: ['glow'], emit: { day: 1.5, night: 2.4 } },
    { layers: ['actors'], night: true, lit: true },
    { layers: ['over'] },
  ],
  hero: [{ layers: ['hero'], night: true, lit: true }],
  front: [{ layers: ['front'], night: true, lit: true, depth: [6] }],
};
/** 夜色：rgba(14, 20, 38, 0.46) */
export const NIGHT = [14, 20, 38, 0.46] as const;

/**
 * 夜里从灯里洒出来的一束光（体积光）：往 dir 方向张开，半张角的余弦是 cos（-1 = 四面八方），照 length 这么远。
 * 人物从光束里走过会挡出一道影子
 */
export interface Beam {
  dir: readonly [number, number];
  cos: number;
  length: number;
  /** 地面在哪一行（屏幕 y）：光束照到地面就停，不照进土层的剖面 */
  floor?: number;
}

/** 点光源：屏幕坐标（逻辑像素）、照多远、多亮、什么颜色，可选一束体积光 */
export interface Light {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  beam?: Beam;
}

/**
 * 一个六边形（光圈形状）的光斑，比如镜头光斑、失焦的光点：紧跟在 layer 所在的合成组后面叠上去，
 * 后面的组照常盖住它（放在 back 层就会被主平面挡住，放在 front 层就压在卡片上）。坐标是逻辑像素，r 是外接圆半径。
 * 默认是世界坐标（跟着世界走、阅读时跟着下沉）；screen 的是屏幕坐标（镜头光斑这种长在镜头上的）
 */
export interface Bokeh {
  layer: LayerName;
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
  screen?: boolean;
}

/** 这一帧的环境：随相机所在的群系插值，渲染器拿来调光效 */
export interface Env {
  /** 群系的地平线色调（日出日落时偏暖），调色时轻轻往这个颜色偏 */
  tint: string;
  /** 日月体积光的强度（0 = 没有） */
  rays: number;
  /** 日月光的颜色：体积光、镜头光斑用 */
  light: string;
  /** 环境光：场景整体乘上这个颜色（日落时偏暖偏暗） */
  ambient: string;
  /** 天空：天顶和地平线的颜色（随时刻变）。WebGPU 渲染器自己画天空渐变，远景往地平线的颜色靠，做空气透视 */
  skyTop: string;
  skyHorizon: string;
  /** 天空渐变从哪一行（屏幕上看得到的顶）到哪一行（地平线） */
  skyY: [number, number];
  /** 投影：多浓（0 = 没有）、压扁成原来高度的几分之几、往背光一侧斜多少 */
  shadow: { alpha: number; squash: number; shear: number };
}

/**
 * 一条命令 14 个 float：
 *   0 flags  1 alpha  2-5 目标 x y w h  6-9 图集里的 x y w h（纯色块时不用）
 *   10-12 纯色块的颜色 r g b（0-255）；ROTATE 的精灵借 10-11 放转轴（相对目标矩形左上角）
 *   13 附加参数：SHADOW 时是影子往右斜多少（每一行往右挪 斜率 × 离顶边的行数），ROTATE 时是转角（弧度，顺时针）
 * 渲染器可以把这段内存直接当实例数据上传。
 */
export const STRIDE = 14;
export const SOLID = 1; // 纯色块（不采样图集）
export const ERASE = 2; // 擦除：按这块的不透明度把已画的东西擦掉（destination-out）
export const FLIP = 4; // 水平翻转图集里那块
export const SHADOW = 8; // 画成影子：上下翻过来、只取轮廓（黑色）、按第 13 位斜过去
export const ROTATE = 16; // 绕转轴（第 10-11 位，默认是目标矩形的中心）转第 13 位那么多：风车头、路牌；按最近邻取像素，转出来还是像素画

export interface SpriteOpts {
  alpha?: number;
  flip?: boolean;
  erase?: boolean;
  /** 只画图集块里的一部分（相对精灵左上角的 x y w h） */
  part?: readonly [number, number, number, number];
  /** 画到目标上的宽高（拉伸），默认和取的那块一样大 */
  w?: number;
  h?: number;
  /** 用精灵的发光遮罩代替本体 */
  glow?: boolean;
  /** 画成影子（只有轮廓、上下翻转），值是往右斜的斜率（负数往左） */
  shadow?: number;
  /** 转多少（弧度，顺时针），角度可以是任意值：转动是连续的，不是一帧帧换图 */
  rotate?: number;
  /** 绕哪里转（相对画出来的那块的左上角），默认是它的中心 */
  pivot?: readonly [number, number];
}

export class Commands {
  data = new Float32Array(STRIDE * 256);
  count = 0;

  push(flags: number, alpha: number, dx: number, dy: number, dw: number, dh: number, sx: number, sy: number, sw: number, sh: number, r: number, g: number, b: number, extra = 0) {
    if ((this.count + 1) * STRIDE > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const d = this.data;
    const o = this.count++ * STRIDE;
    d[o] = flags;
    d[o + 1] = alpha;
    d[o + 2] = dx;
    d[o + 3] = dy;
    d[o + 4] = dw;
    d[o + 5] = dh;
    d[o + 6] = sx;
    d[o + 7] = sy;
    d[o + 8] = sw;
    d[o + 9] = sh;
    d[o + 10] = r;
    d[o + 11] = g;
    d[o + 12] = b;
    d[o + 13] = extra;
  }

  clear() {
    this.count = 0;
  }
}

export class DrawList {
  readonly layers = Object.fromEntries(LAYERS.map((l) => [l, new Commands()])) as Record<LayerName, Commands>;
  readonly lights: Light[] = [];
  readonly bokeh: Bokeh[] = [];
  /** 太阳 / 月亮在屏幕上的位置（逻辑像素），体积光、镜头光斑从这里出来 */
  sun: [number, number] = [0, 0];
  env: Env = { tint: '#ffffff', rays: 0, light: '#ffffff', ambient: '#ffffff', skyTop: '#ffffff', skyHorizon: '#ffffff', skyY: [0, 1], shadow: { alpha: 0, squash: 0, shear: 0 } };
  /**
   * 每层整体再往右挪的亚像素（逻辑像素，可以是负数）。远景、后排、前景按整格画，走得比主平面慢或快，
   * 镜头快停下时会隔几帧才挪一格；渲染器合成时按这个小数偏移取样，移动就是连续的
   */
  readonly shift: Partial<Record<LayerName, number>> = {};

  clear() {
    for (const l of LAYERS) {
      this.layers[l].clear();
      delete this.shift[l];
    }
    this.lights.length = 0;
    this.bokeh.length = 0;
  }

  light(x: number, y: number, radius: number, intensity: number, color: string, beam?: Beam) {
    if (intensity > 0) this.lights.push({ x, y, radius, intensity, color, beam });
  }

  /** 画一个精灵（或它的一部分），左上角在 (x, y) */
  sprite(layer: LayerName, sp: Sprite, x: number, y: number, o: SpriteOpts = {}) {
    const r = o.glow ? sp.glow : sp.rect;
    if (!r) return;
    const [px, py, pw, ph] = o.part ?? [0, 0, r[2], r[3]];
    const flags = (o.erase ? ERASE : 0) | (o.flip ? FLIP : 0) | (o.shadow !== undefined ? SHADOW : 0) | (o.rotate !== undefined ? ROTATE : 0);
    const [dw, dh] = [o.w ?? pw, o.h ?? ph];
    const [ax, ay] = o.pivot ?? [dw / 2, dh / 2];
    this.layers[layer].push(flags, o.alpha ?? 1, x, y, dw, dh, r[0] + px, r[1] + py, pw, ph, ax, ay, 0, o.shadow ?? o.rotate ?? 0);
  }

  /** 填一个纯色矩形 */
  rect(layer: LayerName, x: number, y: number, w: number, h: number, color: string, alpha = 1, erase = false) {
    // 和 Canvas 的 fillRect 一样：宽高是负数时往反方向画
    if (w < 0) [x, w] = [x + w, -w];
    if (h < 0) [y, h] = [y + h, -h];
    if (w === 0 || h === 0 || alpha <= 0) return;
    const [r, g, b] = rgb(color);
    this.layers[layer].push(SOLID | (erase ? ERASE : 0), alpha, x, y, w, h, 0, 0, 0, 0, r, g, b);
  }
}

/**
 * 世界的画布：天空和世界在卡片后面，跟着相机做亚像素平移（天空在里面反着挪回来，贴着屏幕）；
 * 主角始终在屏幕正中；前景压在卡片上面
 */
export interface Canvases {
  world: HTMLCanvasElement;
  hero: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

/** 一块毛玻璃：在世界画布上的位置（画布像素）、圆角、不透明度（卡片淡入淡出时跟着变） */
export interface GlassRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  alpha: number;
}

/** 页面 UI 传给渲染器的东西（见 ui-bridge.ts）：哪些地方要画毛玻璃、打开文章走到了哪一步（0..1，前景跟着淡出） */
export interface View {
  glass: GlassRect[];
  focus: number;
  /**
   * 主角画布相对世界画布的位置（世界画布的像素）。主角画布不做亚像素平移、阅读时跟着 CSS 往下沉：
   * x 就是世界画布这一帧的亚像素平移，y 就是下沉了多少。渲染器让天空按 x 对齐屏幕、不跟着沉，
   * 世界按 y 往下沉（世界画布自己不用 CSS 下沉，见 home.css），和主角同步
   */
  hero: [number, number];
}

/** 渲染器的统一接口：world.ts 每帧交给它一份清单 */
export interface Renderer {
  /**
   * 画布的逻辑尺寸变了（resize）。S 是一个逻辑像素占几个 CSS 像素：画布的 CSS 尺寸由 world.ts 定，
   * 实际分辨率由渲染器自己定（按屏幕像素画，模糊和泛光才是平滑的）
   */
  resize(W: number, H: number, S: number): void;
  /** night：夜色有多浓（0 = 白天，1 = 夜里，晨昏时在中间），见 sim/daytime.ts */
  draw(dl: DrawList, night: number, view: View): void;
}
