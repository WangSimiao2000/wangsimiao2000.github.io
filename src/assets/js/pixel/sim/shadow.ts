/**
 * 投影：布景和主角在地上的影子。影子是精灵自己的轮廓上下翻过来、压扁成一条，从脚底往下铺在草皮上，
 * 往背光的一侧斜过去：太阳在左边影子就往右斜，太阳越低（日出日落）影子越长、越斜。月光下也有很淡的一层。
 * 画在 shadow 层，叠在地面和布景上面。多浓、多扁、多斜见 daytime.ts。
 */
import type { Sprite } from '../atlas.js';
import { clamp } from './util.js';
import type { Frame } from './frame.js';

/** 这一处的影子往右斜多少：按物体在太阳的哪一边、离多远 */
function shearAt(fr: Frame, cx: number): number {
  const side = clamp((cx - fr.dl.sun[0]) / (fr.W * 0.5), -1, 1);
  return side * fr.dl.env.shadow.shear;
}

/** 一个精灵的影子：x 是精灵左边，base 是它底边陷进地面的那一行 */
export function castShadow(fr: Frame, sp: Sprite, x: number, base: number) {
  const s = fr.dl.env.shadow;
  if (s.alpha <= 0) return;
  const h = Math.max(1, Math.round(sp.height * s.squash));
  fr.dl.sprite('shadow', sp, x, base - 1, { h, shadow: shearAt(fr, x + sp.width / 2), alpha: s.alpha });
}

/** 没有精灵可用时（主角画在自己的画布上）：脚下一小块椭圆的影子 */
export function blobShadow(fr: Frame, cx: number, base: number, w: number) {
  const s = fr.dl.env.shadow;
  if (s.alpha <= 0) return;
  const dx = Math.round(shearAt(fr, cx) * 2);
  fr.dl.rect('shadow', Math.round(cx - w / 2) + dx, base, w, 1, '#000000', s.alpha);
  fr.dl.rect('shadow', Math.round(cx - w / 2) + 1 + dx * 2, base + 1, w - 2, 1, '#000000', s.alpha * 0.6);
}
