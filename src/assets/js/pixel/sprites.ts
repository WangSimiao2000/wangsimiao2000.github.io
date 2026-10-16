/**
 * 像素小人与方块纹理。所有图形都在运行时由字符矩阵 / 种子随机数生成到离屏 canvas，
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

/* ------------------------------------------------------------------ */
/* 方块纹理（8x8）                                                     */
/* ------------------------------------------------------------------ */

export const BLOCK = 8;

/** 确定性哈希随机数 [0,1) */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function speckle(g: CanvasRenderingContext2D, seed: number, base: string, dots: string[], density: number) {
  g.fillStyle = base;
  g.fillRect(0, 0, BLOCK, BLOCK);
  for (let y = 0; y < BLOCK; y++) {
    for (let x = 0; x < BLOCK; x++) {
      const r = hash(seed + x * 13 + y * 71);
      if (r < density) {
        g.fillStyle = dots[Math.floor(hash(seed * 3 + x + y * 9) * dots.length)];
        g.fillRect(x, y, 1, 1);
      }
    }
  }
}

function block(draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = BLOCK;
  c.height = BLOCK;
  draw(c.getContext('2d')!);
  return c;
}

/** 顶层带草/雪/沙的方块：top 色带 + 参差边缘 */
function topped(seed: number, top: string[], under: string, underDots: string[]): Sprite {
  return block((g) => {
    speckle(g, seed, under, underDots, 0.35);
    for (let x = 0; x < BLOCK; x++) {
      const depth = 2 + (hash(seed + x * 5.7) < 0.5 ? 1 : 0) + (hash(seed + x * 2.1) < 0.2 ? 1 : 0);
      for (let y = 0; y < depth; y++) {
        g.fillStyle = top[Math.floor(hash(seed + x * 17 + y * 3) * top.length)];
        g.fillRect(x, y, 1, 1);
      }
    }
  });
}

export type BlockKind =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'sandstone'
  | 'snow'
  | 'path'
  | 'cherryGrass'
  | 'planks'
  | 'log'
  | 'glass';

export function buildBlocks(): Record<BlockKind, Sprite> {
  const dirtDots = ['#6b4a2f', '#8a6240', '#5c3e26'];
  return {
    grass: topped(1, ['#5fae3e', '#4c9a32', '#6cc04a'], '#7a5534', dirtDots),
    cherryGrass: topped(2, ['#6fbd4a', '#5aa83a', '#e7a3c4'], '#7a5534', dirtDots),
    snow: topped(3, ['#f4f8ff', '#dfe8f7', '#ffffff'], '#7a5534', dirtDots),
    path: topped(4, ['#9c7a4a', '#8a6b3f', '#ad8a57'], '#7a5534', dirtDots),
    sand: block((g) => speckle(g, 5, '#e3d29a', ['#d4c086', '#efe0ad', '#cbb478'], 0.4)),
    sandstone: block((g) => {
      speckle(g, 6, '#d6c27f', ['#c9b36f', '#e0cd8f'], 0.25);
      g.fillStyle = '#bfa863';
      g.fillRect(0, 3, BLOCK, 1);
      g.fillRect(0, 7, BLOCK, 1);
    }),
    dirt: block((g) => speckle(g, 7, '#7a5534', dirtDots, 0.4)),
    stone: block((g) => speckle(g, 8, '#7d7d7d', ['#6a6a6a', '#8e8e8e', '#5f5f5f'], 0.4)),
    planks: block((g) => {
      speckle(g, 9, '#b0864f', ['#a07843', '#bd955c'], 0.2);
      g.fillStyle = '#7c5a32';
      g.fillRect(0, 3, BLOCK, 1);
      g.fillRect(0, 7, BLOCK, 1);
      g.fillRect(3, 0, 1, 3);
      g.fillRect(6, 4, 1, 3);
    }),
    log: block((g) => {
      speckle(g, 10, '#6b4f2c', ['#5a4124', '#7a5b34'], 0.3);
      g.fillStyle = '#4e3820';
      for (let x = 1; x < BLOCK; x += 3) g.fillRect(x, 0, 1, BLOCK);
    }),
    glass: block((g) => {
      g.fillStyle = '#a9d8f0';
      g.fillRect(0, 0, BLOCK, BLOCK);
      g.fillStyle = '#e6f6ff';
      g.fillRect(1, 1, 2, 1);
      g.fillRect(1, 2, 1, 1);
      g.fillStyle = '#5b6f7a';
      g.strokeStyle = '#5b6f7a';
      g.fillRect(0, 0, BLOCK, 1);
      g.fillRect(0, 0, 1, BLOCK);
      g.fillRect(BLOCK - 1, 0, 1, BLOCK);
      g.fillRect(0, BLOCK - 1, BLOCK, 1);
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 装饰物：树、仙人掌、房子……画在离屏 canvas 上，底边对齐地面          */
/* ------------------------------------------------------------------ */

function canvasOf(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  return c;
}

/** 方块风格的树冠 + 树干 */
function blockTree(
  seed: number,
  trunk: string,
  trunkDark: string,
  leaves: string[],
  trunkH: number,
  crownW: number,
  crownH: number,
): Sprite {
  const w = crownW;
  const h = crownH + trunkH;
  return canvasOf(w, h, (g) => {
    const tx = Math.floor(w / 2) - 1;
    g.fillStyle = trunk;
    g.fillRect(tx, crownH - 2, 3, trunkH + 2);
    g.fillStyle = trunkDark;
    g.fillRect(tx + 2, crownH - 2, 1, trunkH + 2);
    for (let y = 0; y < crownH; y++) {
      for (let x = 0; x < w; x++) {
        // 圆角方冠：裁掉四角，边缘稀疏
        const edgeX = Math.min(x, w - 1 - x);
        const edgeY = Math.min(y, crownH - 1 - y);
        if (edgeX + edgeY < 2) continue;
        const r = hash(seed + x * 31 + y * 7);
        if ((edgeX === 0 || edgeY === 0) && r < 0.35) continue;
        g.fillStyle = leaves[Math.floor(r * leaves.length)];
        g.fillRect(x, y, 1, 1);
      }
    }
  });
}

function spruce(seed: number, snowy: boolean): Sprite {
  const w = 21;
  const h = 34;
  return canvasOf(w, h, (g) => {
    g.fillStyle = '#4d3520';
    g.fillRect(9, 24, 3, 10);
    const layers = [
      [0, 7],
      [6, 9],
      [12, 10],
      [18, 10],
    ];
    for (const [top, half] of layers) {
      for (let y = 0; y < 8; y++) {
        const span = Math.round(((y + 1) / 8) * half);
        for (let x = 10 - span; x <= 10 + span; x++) {
          const r = hash(seed + x * 11 + (top + y) * 5);
          g.fillStyle = r < 0.5 ? '#2f5d3a' : r < 0.85 ? '#264d30' : '#3b6e45';
          if (snowy && y < 2 + (r < 0.4 ? 1 : 0)) g.fillStyle = r < 0.5 ? '#f4f8ff' : '#dfe8f7';
          g.fillRect(x, top + y, 1, 1);
        }
      }
    }
  });
}

function cactus(height: number): Sprite {
  return canvasOf(11, height, (g) => {
    g.fillStyle = '#4f8a3a';
    g.fillRect(3, 0, 5, height);
    g.fillStyle = '#3c6e2c';
    for (let y = 1; y < height; y += 3) {
      g.fillRect(3, y, 1, 1);
      g.fillRect(7, y + 1, 1, 1);
    }
    g.fillStyle = '#6aa84f';
    g.fillRect(5, 0, 1, height);
    // 手臂
    g.fillStyle = '#4f8a3a';
    g.fillRect(0, Math.floor(height * 0.35), 3, 3);
    g.fillRect(0, Math.floor(height * 0.35) - 4, 2, 5);
    g.fillRect(8, Math.floor(height * 0.55), 3, 3);
    g.fillRect(9, Math.floor(height * 0.55) - 3, 2, 4);
  });
}

function house(blocks: Record<BlockKind, Sprite>): Sprite {
  // 5 格宽、4 格高 + 屋顶
  const B = BLOCK;
  return canvasOf(B * 7, B * 6, (g) => {
    for (let x = 1; x < 6; x++) for (let y = 2; y < 6; y++) g.drawImage(blocks.planks, x * B, y * B);
    for (const y of [2, 3, 4, 5]) {
      g.drawImage(blocks.log, 1 * B, y * B);
      g.drawImage(blocks.log, 5 * B, y * B);
    }
    g.drawImage(blocks.glass, 2 * B, 3 * B);
    // 门
    g.fillStyle = '#5a3d1f';
    g.fillRect(4 * B, 4 * B, B, 2 * B);
    g.fillStyle = '#c9a227';
    g.fillRect(4 * B + 6, 5 * B, 1, 1);
    // 阶梯屋顶
    g.fillStyle = '#8e3b2e';
    for (let i = 0; i < 2; i++) g.fillRect(i * B, (1 - i) * B + B, (7 - i * 2) * B, B);
    g.fillStyle = '#a84a3a';
    for (let x = 0; x < 7 * B; x += 2) g.fillRect(x, 2 * B - 1, 1, 1);
  });
}

function lamp(): Sprite {
  return canvasOf(5, 22, (g) => {
    g.fillStyle = '#4e3820';
    g.fillRect(2, 6, 1, 16);
    g.fillStyle = '#3a2a1a';
    g.fillRect(0, 0, 5, 6);
    g.fillStyle = '#ffd36a';
    g.fillRect(1, 1, 3, 4);
  });
}

function sign(): Sprite {
  return canvasOf(12, 14, (g) => {
    g.fillStyle = '#4e3820';
    g.fillRect(5, 7, 2, 7);
    g.fillStyle = '#a07843';
    g.fillRect(0, 0, 12, 8);
    g.fillStyle = '#7c5a32';
    g.fillRect(0, 7, 12, 1);
    g.fillStyle = '#5a4124';
    g.fillRect(2, 2, 7, 1);
    g.fillRect(2, 4, 5, 1);
  });
}

function tuft(color: string, seed: number): Sprite {
  return canvasOf(5, 4, (g) => {
    g.fillStyle = color;
    for (let x = 0; x < 5; x++) {
      const hgt = 1 + Math.floor(hash(seed + x) * 4);
      g.fillRect(x, 4 - hgt, 1, hgt);
    }
  });
}

function flower(petal: string): Sprite {
  return canvasOf(3, 5, (g) => {
    g.fillStyle = '#3f8a2c';
    g.fillRect(1, 2, 1, 3);
    g.fillStyle = petal;
    g.fillRect(0, 0, 3, 2);
    g.fillStyle = '#ffe680';
    g.fillRect(1, 0, 1, 1);
  });
}

function deadBush(): Sprite {
  return canvasOf(7, 6, (g) => {
    g.fillStyle = '#8a6a3c';
    g.fillRect(3, 2, 1, 4);
    g.fillRect(1, 1, 1, 3);
    g.fillRect(5, 0, 1, 4);
    g.fillRect(2, 3, 1, 1);
    g.fillRect(4, 2, 1, 1);
  });
}

function mushroom(): Sprite {
  return canvasOf(5, 5, (g) => {
    g.fillStyle = '#e9e1cf';
    g.fillRect(2, 2, 1, 3);
    g.fillStyle = '#c0392b';
    g.fillRect(0, 0, 5, 2);
    g.fillStyle = '#fff';
    g.fillRect(1, 0, 1, 1);
    g.fillRect(3, 1, 1, 1);
  });
}

function campfireBase(): Sprite {
  return canvasOf(10, 4, (g) => {
    g.fillStyle = '#5a4124';
    g.fillRect(0, 2, 10, 2);
    g.fillStyle = '#7a5b34';
    g.fillRect(1, 1, 8, 1);
    g.fillStyle = '#3a2a1a';
    g.fillRect(2, 3, 1, 1);
    g.fillRect(7, 3, 1, 1);
  });
}

export interface Decorations {
  oak: Sprite[];
  birch: Sprite[];
  cherry: Sprite[];
  spruce: Sprite[];
  cactus: Sprite[];
  house: Sprite;
  lamp: Sprite;
  sign: Sprite;
  tuft: Sprite[];
  flowerRed: Sprite;
  flowerYellow: Sprite;
  deadBush: Sprite;
  mushroom: Sprite;
  campfire: Sprite;
}

export function buildDecorations(blocks: Record<BlockKind, Sprite>): Decorations {
  const oakLeaves = ['#3f8f2f', '#357f27', '#4ea33a', '#2e6f22'];
  const birchLeaves = ['#6aa84f', '#5c9a44', '#7bb85d'];
  const cherryLeaves = ['#f3b6d0', '#e89bbd', '#f8cfe0', '#d983aa'];
  return {
    oak: [0, 1, 2].map((i) => blockTree(100 + i, '#6b4f2c', '#4e3820', oakLeaves, 10 + i * 2, 21 + i * 4, 15 + i * 2)),
    birch: [0, 1].map((i) => blockTree(200 + i, '#e8e4d8', '#3a3a3a', birchLeaves, 14 + i * 2, 17 + i * 4, 13 + i * 2)),
    cherry: [0, 1, 2].map((i) => blockTree(300 + i, '#5a3b38', '#3e2826', cherryLeaves, 9 + i * 2, 27 + i * 4, 15 + i)),
    spruce: [0, 1, 2].map((i) => spruce(400 + i, true)),
    cactus: [14, 20, 26].map(cactus),
    house: house(blocks),
    lamp: lamp(),
    sign: sign(),
    tuft: [0, 1, 2].map((i) => tuft(['#4c9a32', '#5fae3e', '#3f8a2c'][i], 500 + i)),
    flowerRed: flower('#d9443a'),
    flowerYellow: flower('#f1c232'),
    deadBush: deadBush(),
    mushroom: mushroom(),
    campfire: campfireBase(),
  };
}
