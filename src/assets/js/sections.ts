/**
 * 首页的板块：唯一的一张表。模板（templates/home.mjs，构建时导入）按它出卡片和快捷栏，
 * 像素世界（pixel/sim/biomes.ts）按它排群系。加板块、换顺序只改这里。没有依赖，Node 里也能直接导入。
 *
 *   id     锚点（/#posts）和阅读面板的 data-section
 *   label  快捷栏上的字；title 是卡片标题（没有就用 label）
 *   place  群系的中文名（卡片右上角的小标签、关闭按钮的提示）
 *   biome  像素世界里的群系（biomes.ts 的 name）
 */
export interface Section {
  id: string;
  label: string;
  title?: string;
  place: string;
  biome: string;
}

export const SECTIONS: readonly Section[] = [
  { id: 'home', label: '起点', place: '草甸', biome: 'plains' },
  { id: 'posts', label: '博文', title: '最新博文', place: '森林', biome: 'forest' },
  { id: 'tools', label: '工具', place: '沙丘', biome: 'desert' },
  { id: 'games', label: '游戏', place: '小镇', biome: 'village' },
  { id: 'friends', label: '友链', place: '花林', biome: 'cherry' },
  { id: 'about', label: '关于', place: '雪松林', biome: 'snow' },
];

/** 隐藏页：起点左边、路牌背后的秋林（留言板）。不在快捷栏里，序号是 -1 */
export const SECRET: Section = { id: 'secret', label: '？？？', place: '秋林', biome: 'autumn' };

/** 世界里从左到右的顺序：隐藏页在起点左边 */
export const WORLD: readonly Section[] = [SECRET, ...SECTIONS];

/** 风车插在哪个板块：数量等于友链数 */
export const FRIENDS_ID = 'friends';
