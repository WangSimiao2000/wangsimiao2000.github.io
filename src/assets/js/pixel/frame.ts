/**
 * 一帧里各模块共享的状态：画布、尺寸、相机、主题。world.ts 每帧更新它，
 * 其他模块（地形、天空、粒子、灯光、彩蛋）只读它来画，不互相引用。
 */
export interface Frame {
  /** 主画布：远景、前景合成、光晕、粒子、气泡 */
  g: CanvasRenderingContext2D;
  /** 前景（地面、植被）离屏层，深色模式下整体盖夜色 */
  f: CanvasRenderingContext2D;
  /** 角色层（女孩、猫）：画在灯光之后，经过窗前会挡光 */
  a: CanvasRenderingContext2D;
  /** 自发光层：灯泡、亮着的窗，夜里叠在夜色之上 */
  e: CanvasRenderingContext2D;
  /** 天空画布：不吃世界的自下而上渐隐 */
  sk: CanvasRenderingContext2D;
  /** 主角画布：始终在屏幕正中，不跟世界做亚像素平移 */
  hc: CanvasRenderingContext2D;
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
}
