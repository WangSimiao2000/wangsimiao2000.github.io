/**
 * 像素小人。由字符矩阵在运行时生成到离屏 canvas，
 * 不依赖任何图片资源。坐标单位是「逻辑像素」，渲染时整体放大。
 */

export type Sprite = HTMLCanvasElement;

/** 小人调色板（取自头像：棕发、绿头带、绿眼睛、绿外套、斜挎带、棕裤）。'.' 透明 */
const CHAR_PALETTE: Record<string, string> = {
  k: '#2a1f22', // 轮廓占位：渲染时换成相邻色块的深色（选择性描边）
  h: '#5a3a2b', // 头发
  H: '#9a6a4c', // 头发高光
  g: '#62b752', // 头带
  G: '#3f8a3e', // 头带暗部
  f: '#f6d3b0', // 皮肤
  F: '#e0ae8a', // 皮肤阴影
  w: '#ffffff', // 眼白 / 高光
  e: '#4fb246', // 瞳孔
  E: '#255e2c', // 瞳孔暗部
  j: '#4f9c4a', // 外套
  J: '#3a7a3d', // 外套下摆
  l: '#a6d97f', // 内衫
  c: '#eef0ec', // 袖口 / 裤脚白条
  s: '#8a5a3a', // 斜挎带
  b: '#c9ccd2', // 带扣
  p: '#7a5038', // 裤子
  P: '#5a3a2b', // 裤子暗部
  o: '#3b3236', // 靴子
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

type RGB = [number, number, number];
const toRGB = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, t: number) => {
  const x = toRGB(a);
  const y = toRGB(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
};
const INK = '#21161d'; // 深色描边与阴影都往这个偏紫的暗色靠，不用纯黑
const NO_SHADE = new Set(['w', 'e', 'E', 'b', 'c']); // 眼睛、带扣、白条保持原色

/**
 * 字符矩阵 -> 精灵，和场景同一套画法：
 * - 选择性描边：轮廓像素取相邻色块的深色，而不是一圈纯黑；
 * - 光从左上来：色块的左/上边缘提亮一档，右/下边缘压暗一档。
 * 先翻转再打光，所以小人朝左时光源仍在左边。
 */
function rowsToCanvas(rows: string[], palette: Record<string, string>, flip = false): Sprite {
  const h = rows.length;
  const w = rows[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][flip ? w - 1 - x : x]);
  const isFill = (ch: string) => ch !== '.' && ch !== 'k';
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ch === '.') continue;
      let col: string;
      if (ch === 'k') {
        // 优先取下方/内侧的色块（头顶轮廓取头发色，脸下沿取皮肤色）
        const n = [at(x, y + 1), at(x + 1, y), at(x - 1, y), at(x, y - 1)].find(isFill);
        col = n ? mixHex(palette[n], INK, n === 'f' || n === 'F' ? 0.5 : 0.62) : INK;
      } else {
        col = palette[ch];
        if (!col) continue;
        if (!NO_SHADE.has(ch)) {
          const edge = (cx: number, cy: number) => at(cx, cy) !== ch;
          const lit = edge(x - 1, y) || edge(x, y - 1);
          const shaded = edge(x + 1, y) || edge(x, y + 1);
          if (lit && !shaded) col = mixHex(palette[ch], '#ffffff', 0.16);
          else if (shaded && !lit) col = mixHex(palette[ch], INK, 0.18);
        }
      }
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
