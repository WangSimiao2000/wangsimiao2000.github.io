/**
 * 一天里的时刻：跟着访客电脑上的时间走（或时间拖动条、网址里的 ?tod=小时）。纯函数，world.ts 每帧调一次。
 *
 * 全天是连续的，没有「白天 / 夜里」的开关：
 *   太阳 6 点从左边地平线升起、18 点落到右边，再往下就沉到山后看不见；月亮 18 点升起、次日 6 点落下。
 *   night 是夜色有多浓（0 = 白天，1 = 夜里），在 17-19 点和 5-7 点之间平滑过渡：
 *   天空、光色、影子从白天的取值慢慢变成夜里的，月亮和星星慢慢浮现，灯慢慢亮起来（渲染器、各个光源都按它乘）。
 *   太阳低的时候（日出、日落）光是暖的：日盘偏橘红、场景偏暖、体积光变浓。
 */
import { clamp, mix, smooth } from './util.js';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 晨昏过渡：傍晚从 DUSK[0] 点开始暗、DUSK[1] 点全黑；清晨反过来 */
const DUSK = [17, 19] as const;
const DAWN = [5, 7] as const;

export interface Orb {
  /** 在天上走了多少：0 刚从左边地平线升起，0.5 最高，1 落到右边；小于 0、大于 1 是沉到地平线以下 */
  arc: number;
  /** 多亮（0..1）：太阳一直是 1（沉下去就被山挡住）；月亮随夜色浮现 */
  alpha: number;
  /** 日盘有多偏橘红（贴着地平线时 1）；月亮是 0 */
  warm: number;
}

export interface Daytime {
  /** 夜色有多浓：0 = 白天，1 = 夜里 */
  night: number;
  sun: Orb;
  moon: Orb;
  /** 日出日落的暖光有多浓（0..1） */
  golden: number;
  /** 光的颜色：给日盘、体积光、镜头光斑 */
  light: string;
  /** 环境光：场景整体乘上这个颜色（日落时偏暖偏暗；夜里的偏蓝暗光由渲染器按 night 乘） */
  ambient: string;
  /** 地平线的晕染往这个颜色偏（和群系色调混） */
  horizon: string;
  /** 体积光的强度（再乘群系自己的 rays） */
  rays: number;
  /** 天空渐变：天顶、地平线（地平线还会混一点群系色调，见 world.ts） */
  skyTop: string;
  skyHorizon: string;
  /** 投影：多浓、压扁成几分之几、斜多少（太阳越低影子越长越斜） */
  shadow: { alpha: number; squash: number; shear: number };
}

const NOON = { light: '#fff1c8', ambient: '#ffffff', rays: 0.5, top: '#8fbfe9', bottom: '#dcebf3', shadow: { alpha: 0.3, squash: 0.08, shear: 0.5 } };
const SUNSET = { light: '#ff9c52', ambient: '#ffd8b4', horizon: '#ffb07a', rays: 1.1, top: '#7a86c4', bottom: '#f3ad7c', shadow: { alpha: 0.36, squash: 0.14, shear: 1.4 } };
const MOON = { light: '#bcd0ff', ambient: '#ffffff', rays: 0.45, top: '#0d1531', bottom: '#2a3460', shadow: { alpha: 0.14, squash: 0.1, shear: 0.8 } };

/** 夜色有多浓（0..1），h 是 0..24 点 */
export function nightAt(h: number): number {
  if (h >= DAWN[1] && h <= DUSK[0]) return 0;
  if (h > DUSK[0] && h < DUSK[1]) return smooth(DUSK[0], DUSK[1], h);
  if (h > DAWN[0] && h < DAWN[1]) return 1 - smooth(DAWN[0], DAWN[1], h);
  return 1;
}

/** hour：0..24 的小时（可以带小数） */
export function daytime(hour: number): Daytime {
  const h = ((hour % 24) + 24) % 24;
  const night = nightAt(h);
  // 太阳：6 点 -> 0，18 点 -> 1；半夜（-0.5 / 1.5）在地平线下面最深处
  const sunArc = (h - 6) / 12;
  // 月亮：18 点 -> 0，次日 6 点 -> 1
  const moonArc = ((h - 18 + 24) % 24) / 12;
  // 离地平线越近越暖：两头 1，升高到 1/4 弧以上就是正午的光；沉下去以后天还暖一会儿，再交给夜色
  const golden = 1 - smooth(0.04, 0.26, Math.min(Math.abs(sunArc), Math.abs(1 - sunArc)));
  const day = {
    light: mix(NOON.light, SUNSET.light, golden),
    ambient: mix(NOON.ambient, SUNSET.ambient, golden),
    rays: lerp(NOON.rays, SUNSET.rays, golden),
    top: mix(NOON.top, SUNSET.top, golden),
    bottom: mix(NOON.bottom, SUNSET.bottom, golden),
    shadow: {
      alpha: lerp(NOON.shadow.alpha, SUNSET.shadow.alpha, golden),
      squash: lerp(NOON.shadow.squash, SUNSET.shadow.squash, golden),
      shear: lerp(NOON.shadow.shear, SUNSET.shadow.shear, golden),
    },
  };
  return {
    night,
    sun: { arc: sunArc, alpha: 1, warm: golden },
    moon: { arc: moonArc > 1.5 ? moonArc - 2 : moonArc, alpha: night, warm: 0 },
    golden: golden * (1 - night),
    light: mix(day.light, MOON.light, night),
    ambient: mix(day.ambient, MOON.ambient, night),
    horizon: SUNSET.horizon,
    rays: lerp(day.rays, MOON.rays, night),
    skyTop: mix(day.top, MOON.top, night),
    skyHorizon: mix(day.bottom, MOON.bottom, night),
    shadow: {
      alpha: lerp(day.shadow.alpha, MOON.shadow.alpha, night),
      squash: lerp(day.shadow.squash, MOON.shadow.squash, night),
      shear: lerp(day.shadow.shear, MOON.shadow.shear, night),
    },
  };
}

/** 主光源：夜色过半以前是太阳，过半以后是月亮（镜头光斑、日月体积光、投影的方向都按它） */
export const lightFromMoon = (d: Daytime) => d.night >= 0.5;
/** 主光源从太阳换成月亮那一下前后，光斑、体积光、投影先淡掉再淡回来，不会一下跳到天空另一边 */
export const handover = (d: Daytime) => clamp(Math.abs(1 - 2 * d.night) * 1.5);
