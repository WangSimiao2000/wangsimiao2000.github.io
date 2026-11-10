/**
 * 一天里的时刻：跟着访客电脑上的时间走。亮色模式是太阳（6 点从左边升起、18 点在右边落下），
 * 暗色模式是月亮（18 点升起、次日 6 点落下）；不在这段时间里的就停在离得近的那头，贴着山。
 * 太阳低的时候（日出、日落）光是暖的：日盘偏橘红、场景偏暖、体积光变浓。
 * 纯函数，时刻由 world.ts 读系统时钟（或网址里的 ?tod=小时）传进来。
 */
import { clamp, mix, smooth } from './util.js';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Daytime {
  /** 日 / 月在天上走了多少：0 刚从左边升起，0.5 最高，1 落到右边 */
  arc: number;
  /** 日出日落的暖光有多浓（0..1），月亮是 0 */
  golden: number;
  /** 光的颜色：给日盘、体积光、镜头光斑 */
  light: string;
  /** 环境光：场景整体乘上这个颜色（日落时偏暖偏暗） */
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

/** hour：0..24 的小时（可以带小数）；dark：暗色模式（月亮） */
export function daytime(hour: number, dark: boolean): Daytime {
  const h = ((hour % 24) + 24) % 24;
  if (dark) {
    // 18 点 -> 0，次日 6 点 -> 1；白天的时候停在离得近的那头
    const since = (h - 18 + 24) % 24;
    const arc = since <= 12 ? since / 12 : since < 18 ? 1 : 0;
    return { arc, golden: 0, light: MOON.light, ambient: MOON.ambient, horizon: SUNSET.horizon, rays: MOON.rays, skyTop: MOON.top, skyHorizon: MOON.bottom, shadow: MOON.shadow };
  }
  const arc = clamp((h - 6) / 12);
  // 离地平线越近越暖：两头 1，升高到 1/4 弧以上就是正午的光
  const golden = 1 - smooth(0.04, 0.26, Math.min(arc, 1 - arc));
  return {
    arc,
    golden,
    light: mix(NOON.light, SUNSET.light, golden),
    ambient: mix(NOON.ambient, SUNSET.ambient, golden),
    horizon: SUNSET.horizon,
    rays: lerp(NOON.rays, SUNSET.rays, golden),
    skyTop: mix(NOON.top, SUNSET.top, golden),
    skyHorizon: mix(NOON.bottom, SUNSET.bottom, golden),
    shadow: {
      alpha: lerp(NOON.shadow.alpha, SUNSET.shadow.alpha, golden),
      squash: lerp(NOON.shadow.squash, SUNSET.shadow.squash, golden),
      shear: lerp(NOON.shadow.shear, SUNSET.shadow.shear, golden),
    },
  };
}
