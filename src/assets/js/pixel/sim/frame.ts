/**
 * 一帧里各模块共享的状态：尺寸、相机、主题、时钟，以及这一帧的绘制清单。world.ts 每帧更新它，
 * 其他模块（地形、天空、粒子、灯光、彩蛋）只读它，往 dl 里写，不互相引用，也不碰画布。
 */
import type { DrawList } from '../drawlist.js';

export interface Frame {
  /** 这一帧的绘制清单 */
  dl: DrawList;
  /** 画布宽高（逻辑像素） */
  W: number;
  H: number;
  /** 每个逻辑像素对应的 CSS 像素 */
  S: number;
  /** 视口中心（逻辑像素） */
  HALF: number;
  /** 相机世界坐标（视口中心）、视口左边缘取整后的世界坐标、亚像素余量 */
  camX: number;
  camLeft: number;
  frac: number;
  /** 滚动进度 0..N-1 */
  p: number;
  dark: boolean;
  /** 页面底色（雾色的基底） */
  bg: string;
  /** 动画时钟（秒） */
  time: number;
  /** 系统开了「减少动态效果」 */
  reduced: boolean;
  /** 小人正在跑 */
  running: boolean;
  /** 屏幕上实际看得到的高度（逻辑像素）：手机地址栏展开时画布顶上一截在屏幕外 */
  visH: number;
}
