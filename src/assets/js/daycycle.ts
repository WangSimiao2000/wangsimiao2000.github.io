/**
 * 一天里的时刻：几点日出日落、晨昏多长、深浅色几点切、时刻从哪来。整站只在这里定义一次：
 *   theme.ts            跟着时钟走、时间拖动条、写 <html data-hour / data-theme>
 *   pixel/sim/daytime.ts 日月的轨迹、夜色的浓淡
 *   templates/layout.mjs 首帧前的内联脚本（initScript() 按这里的常量生成，构建时导入这个文件）
 * 没有依赖，Node 里也能直接导入。
 */

/** 太阳从左边地平线升起 / 落到右边的时刻；月亮正好反过来 */
export const SUNRISE = 6;
export const SUNSET = 18;
/** 晨昏过渡的半宽（小时）：17-19 点天慢慢黑下来，5-7 点慢慢亮起来 */
export const TWILIGHT = 1;
/** localStorage 里记拖动条拖到的时刻；网址里也是这个名字（?tod=小时，截图、预览用） */
export const TOD_KEY = 'tod';

/** 0..24 的数才算时刻 */
export const validHour = (h: number) => h >= 0 && h <= 24;
/**
 * 界面的深浅色：只在晨昏正中间切一次（日出、日落那一刻），那时世界已经亮了（暗了）一半，切换不突兀
 */
export const themeOf = (h: number): 'light' | 'dark' => (h >= SUNRISE && h < SUNSET ? 'light' : 'dark');
/** 系统时钟的时刻（带小数） */
export const clockHour = () => {
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60;
};

/**
 * 首帧前的内联脚本（放在 <head> 里，样式表之前就定下时刻和深浅色，避免亮 -> 暗闪一下）。
 * 取时刻的顺序和 theme.ts 一样：网址 ?tod= > localStorage > 系统时钟
 */
export function initScript(): string {
  return `(()=>{const d=document.documentElement;d.classList.add('js');const ok=(h)=>h>=0&&h<=24;let h=parseFloat(new URLSearchParams(location.search).get('${TOD_KEY}'));if(!ok(h)){try{h=parseFloat(localStorage.getItem('${TOD_KEY}'))}catch{}}if(!ok(h)){const n=new Date;h=n.getHours()+n.getMinutes()/60}d.dataset.hour=h.toFixed(2);d.dataset.theme=h>=${SUNRISE}&&h<${SUNSET}?'light':'dark'})();`;
}
