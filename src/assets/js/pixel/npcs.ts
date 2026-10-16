/**
 * 彩蛋角色：小屋里的女孩、草堆里的三花猫。画法和主角一致（字符矩阵 + 选择性描边 + 左上光源），
 * 由 sprites.ts 的 rowsToCanvas 渲染。
 */
import { renderRows, type Sprite } from './sprites.js';

/** 女孩：棕红长发、白色上衣 + 浅蓝裙摆的连衣裙、胸前黄色蝴蝶结、黑色小皮鞋 */
const GIRL_PALETTE: Record<string, string> = {
  k: '#2a1f22',
  R: '#8e3f2c', // 棕红长发
  r: '#b8613f', // 发丝高光
  f: '#f6d3b0',
  F: '#e7b693', // 腮红 / 阴影
  w: '#ffffff',
  e: '#6a4a3a', // 棕色眼睛
  E: '#3a2620',
  W: '#f5f7fb', // 连衣裙白色上身
  B: '#a8d2f0', // 浅蓝裙摆
  b: '#7fb4dc', // 裙摆暗部
  Y: '#f4c542', // 黄色蝴蝶结
  y: '#d9a21f',
  o: '#24202a', // 黑色小皮鞋
};

// 14x20，朝右。头 0-11，身 12-15，腿 16-19；长发从两侧一直垂到腰
const G_HEAD = [
  '....kkkkkk....',
  '..kkRRRRRRkk..',
  '.kRRRRrrRRRRk.',
  'kRRRrRRRRRRRRk',
  'kRRRRRRRRRRRRk',
  'kRRfRRRfffRRRk',
  'kRffffffffffRk',
  'kRfwwfffwwffRk',
  'kRfwefffweffRk',
  'kRfEefffEeffRk',
  'kRfFffffffFfRk',
  'kRRkkffffkkRRk',
];
const G_BODY = ['kRkWWYkYWWWkRk', 'kRfWWyYyWWWfRk', 'kRkBBBBBBBBkRk', '.kBBBbBBbBBBk.'];
const G_LEGS_IDLE = ['..kbBBBBBBbk..', '...kffkkffk...', '...kffkkffk...', '...kookkook...'];
const G_LEGS_A = ['..kbBBBBBBbk..', '..kffk..kffk..', '.kffk....kffk.', '.kook....kook.'];
const G_LEGS_B = ['..kbBBBBBBbk..', '....kffffk....', '....kffkfk....', '....kookok....'];
// 招手：右手举到脸旁
const G_BODY_WAVE = ['kRkWWYkYWWWkRf', 'kRfWWyYyWWWkRf', 'kRkBBBBBBBBkRk', '.kBBBbBBbBBBk.'];
const G_HEAD_WAVE = G_HEAD.map((r, i) => (i === 9 || i === 10 ? r.slice(0, 13) + 'f' : r));

export interface GirlFrames {
  idle: Sprite;
  walk: [Sprite, Sprite];
  wave: [Sprite, Sprite];
}

export function buildGirl(flip: boolean): GirlFrames {
  const r = (head: string[], body: string[], legs: string[]) => renderRows([...head, ...body, ...legs], GIRL_PALETTE, flip);
  return {
    idle: r(G_HEAD, G_BODY, G_LEGS_IDLE),
    walk: [r(G_HEAD, G_BODY, G_LEGS_A), r(G_HEAD, G_BODY, G_LEGS_B)],
    wave: [r(G_HEAD_WAVE, G_BODY_WAVE, G_LEGS_IDLE), r(G_HEAD, G_BODY_WAVE, G_LEGS_IDLE)],
  };
}

/** 三花猫：白底，橘色和黑色花斑 */
const CAT_PALETTE: Record<string, string> = {
  k: '#2a1f22',
  w: '#fbf8f2',
  o: '#e39a4a', // 橘斑
  n: '#3a3236', // 黑斑
  p: '#f2a7b5', // 粉鼻子 / 耳内
  g: '#7cc46a', // 绿眼睛
};

// 12x9，朝右坐着；尾巴在左边翘起
const CAT_SIT = [
  '........k..k',
  '.......kpkkp',
  'kk.....knwwo',
  'kok...kwgwgw',
  '.kok..kwwpwk',
  '..kokknnwwk.',
  '...kwwwooowk',
  '...kwoowwwwk',
  '...kkwkkkwkk',
];
const CAT_SIT_TAIL = CAT_SIT.map((r, i) => (i === 2 ? '.......knwwo' : i === 3 ? 'kk....kwgwgw' : i === 4 ? 'kokk..kwwpwk' : r));
const CAT_BLINK = CAT_SIT.map((r, i) => (i === 3 ? r.replace(/g/g, 'k') : r));
// 跳起：身体拉长
const CAT_JUMP = [
  '..........kk',
  '.........kpk',
  'kk......knwo',
  'kokkkkkkwgwg',
  '.knnwwooowwk',
  '..kwwwwwwwk.',
  '.kwk.....kwk',
  'kk.........k',
  '............',
];

export interface CatFrames {
  sit: Sprite;
  tail: Sprite;
  blink: Sprite;
  jump: Sprite;
}

export function buildCat(flip: boolean): CatFrames {
  const r = (rows: string[]) => renderRows(rows, CAT_PALETTE, flip);
  return { sit: r(CAT_SIT), tail: r(CAT_SIT_TAIL), blink: r(CAT_BLINK), jump: r(CAT_JUMP) };
}
