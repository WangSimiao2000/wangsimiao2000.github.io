/**
 * 像素小人。由字符矩阵在运行时生成到离屏 canvas，
 * 不依赖任何图片资源。坐标单位是「逻辑像素」，渲染时整体放大。
 */

export type Sprite = HTMLCanvasElement;

/** 小人调色板（取自头像：棕发、绿头带、绿眼睛、绿外套、斜挎带、棕裤）。'.' 透明 */
const CHAR_PALETTE: Record<string, string> = {
  k: '#1c1410', // 描边
  h: '#4a2c1c', // 头发
  H: '#8a5a3a', // 头发高光
  g: '#4caf3a', // 头带
  G: '#2e7d25', // 头带暗部
  f: '#f1c9a0', // 皮肤
  F: '#d9a67c', // 皮肤阴影
  w: '#ffffff', // 眼白 / 高光
  e: '#3fae2a', // 瞳孔
  E: '#1d5e17', // 瞳孔暗部
  j: '#3f9a35', // 外套
  J: '#2b6e25', // 外套下摆
  l: '#7ccf5c', // 内衫
  c: '#e8e8e8', // 袖口 / 裤脚白条
  s: '#7a4a2a', // 斜挎带
  b: '#9aa0a6', // 带扣
  p: '#6b4026', // 裤子
  P: '#4a2c1c', // 裤子暗部
  o: '#2a2220', // 靴子
};

// 14x20，朝右的 Q 版大头。头 0-11 行，身体 12-15 行，腿 16-19 行
const HEAD = [
  '.....kkkk.....',
  '..kkkhhHHkkk..',
  '.khhhhHhhhhhk.',
  'khhhhhhhhhhhhk',
  'kggggggggggggk',
  'gGGGGGGGGGGGGk',
  'gkhffffffffffk',
  '.khfwwfffwwffk',
  '.khfwefffweffk',
  '.khfEefffEeffk',
  '.kFffffffffffk',
  '..kkkkkkkkkkk.',
];

const BODY = ['..kjjslllljk..', '.kjjjlsllljjk.', '.kcjjllblljck.', '.kfkJJJJJJsfk.'];

const LEGS_IDLE = ['...kppppPPk...', '...kppkkPPk...', '...kcckkcck...', '...kookkook...'];
const LEGS_STRIDE = ['...kppppPPk...', '..kppk..kPPk..', '.kcck....kcck.', 'kook......kook'];
const LEGS_PASS = ['...kppppPPk...', '....kppPPk....', '....kcckck....', '....kookok....'];

function blink(rows: string[]): string[] {
  return rows.map((r, i) => {
    if (i === 7 || i === 8) return r.replace(/[weE]/g, 'f');
    if (i === 9) return r.replace(/[weE]/g, 'k');
    return r;
  });
}

function compose(head: string[], body: string[], legs: string[], headDx = 0): string[] {
  const shift = (r: string) => (headDx > 0 ? '.' + r.slice(0, -1) : r);
  return [...head.map(shift), ...body, ...legs];
}

function rowsToCanvas(rows: string[], palette: Record<string, string>, flip = false): Sprite {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][flip ? w - 1 - x : x];
      const col = palette[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export interface CharacterFrames {
  idle: [Sprite, Sprite]; // [睁眼, 眨眼]
  run: Sprite[]; // 4 帧
}

export function buildCharacter(flip: boolean): CharacterFrames {
  const idle = compose(HEAD, BODY, LEGS_IDLE);
  // 跑步时整体上下颠簸即可；头已经占满宽度，不再前倾平移
  const run = [
    compose(HEAD, BODY, LEGS_STRIDE),
    compose(HEAD, BODY, LEGS_PASS),
    compose(HEAD, BODY, LEGS_STRIDE),
    compose(HEAD, BODY, LEGS_PASS),
  ];
  return {
    idle: [rowsToCanvas(idle, CHAR_PALETTE, flip), rowsToCanvas(blink(idle), CHAR_PALETTE, flip)],
    run: run.map((r) => rowsToCanvas(r, CHAR_PALETTE, flip)),
  };
}

/** 确定性哈希随机数 [0,1) */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
