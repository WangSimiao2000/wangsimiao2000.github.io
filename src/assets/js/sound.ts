/**
 * 8-bit 环境音：全部用 Web Audio 实时合成（方波、三角波、噪声），没有音频文件、不引入库。
 * 默认静音；右上角喇叭打开后记在 localStorage，下次进来照样开着（浏览器要求声音由用户操作开启，
 * 所以刷新后要等第一次点击 / 按键才真正响起来）。
 *
 *   风声：带通滤波的噪声，强弱跟群系走（雪原、沙丘风大）
 *   营火：离营火越近，噼啪声越密
 *   脚步：小人跑动时一步一声
 *   音效：弹弓拉弓 / 发射、女孩打招呼、猫跳出来、烟花炸开
 * 打开阅读面板时整体压到很小；标签页切到后台时暂停。
 */

const KEY = 'sound';

type Sfx = 'pull' | 'shoot' | 'hello' | 'meow' | 'hay' | 'burst' | 'lantern';

class Sound {
  on = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private fire = 0;
  private wind = 0.3;
  private dim = false;
  private nextCrackle = 0;
  private listeners = new Set<(on: boolean) => void>();

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) === 'on';
    } catch {
      /* 隐私模式 */
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.on) void this.ctx.resume();
    });
    // 记住了「开着」：等第一次用户操作再真正启动（自动播放限制）
    if (this.on) {
      const kick = () => {
        this.start();
        removeEventListener('pointerdown', kick);
        removeEventListener('keydown', kick);
      };
      addEventListener('pointerdown', kick);
      addEventListener('keydown', kick);
    }
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    fn(this.on);
  }

  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem(KEY, this.on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (this.on) this.start();
    else void this.ctx?.suspend();
    this.listeners.forEach((fn) => fn(this.on));
  }

  private start() {
    if (!this.on) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      // 2 秒白噪声，风声循环用，噼啪和爆炸取一段
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.8;
      // 风忽大忽小：很慢的 LFO 调滤波频率
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 160;
      lfo.connect(lfoAmt).connect(bp.frequency);
      lfo.start();
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(bp).connect(this.windGain).connect(this.master);
      src.start();
    }
    void this.ctx.resume();
    this.level();
  }

  private level() {
    if (!this.ctx || !this.master || !this.windGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.on ? (this.dim ? 0.06 : 0.32) : 0, t, 0.25);
    this.windGain.gain.setTargetAtTime(0.05 + this.wind * 0.22, t, 0.8);
  }

  /** 每帧由世界调用：离营火多近（0..1）、风多大（0..1）、是否在阅读 */
  ambient(fire: number, wind: number, reading: boolean) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    const changed = Math.abs(wind - this.wind) > 0.05 || reading !== this.dim;
    this.fire = fire;
    this.wind = wind;
    this.dim = reading;
    if (changed) this.level();
    const now = this.ctx.currentTime;
    if (this.fire > 0.02 && now > this.nextCrackle) {
      this.nextCrackle = now + 0.04 + Math.random() * (0.5 / this.fire);
      this.burstNoise(0.02 + Math.random() * 0.03, 2400 + Math.random() * 2400, 0.12 * this.fire * (0.4 + Math.random()));
    }
  }

  /** 一小段噪声（高通滤一下）：噼啪、脚步沙沙、爆炸都用它 */
  private burstNoise(dur: number, cutoff: number, vol: number, type: BiquadFilterType = 'highpass') {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  /** 一个方波 / 三角波音：从 f0 滑到 f1 */
  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'square', delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  step() {
    if (!this.on || this.ctx?.state !== 'running') return;
    this.burstNoise(0.035, 900, 0.07, 'lowpass');
    this.tone(110, 70, 0.04, 0.025, 'triangle');
  }

  sfx(name: Sfx) {
    if (!this.on || this.ctx?.state !== 'running') return;
    switch (name) {
      case 'pull':
        this.tone(180, 240, 0.18, 0.04, 'triangle');
        break;
      case 'shoot':
        this.tone(300, 1200, 0.16, 0.05);
        break;
      case 'hello':
        this.tone(660, 660, 0.12, 0.05, 'square');
        this.tone(880, 880, 0.18, 0.05, 'square', 0.13);
        break;
      case 'meow':
        this.tone(760, 520, 0.28, 0.05, 'square');
        break;
      case 'hay':
        this.burstNoise(0.12, 1500, 0.12, 'bandpass');
        break;
      case 'burst':
        this.burstNoise(0.5, 300, 0.22, 'lowpass');
        for (let i = 0; i < 5; i++) this.tone(1800 + Math.random() * 1200, 900, 0.05, 0.02, 'square', 0.15 + Math.random() * 0.4);
        break;
      case 'lantern':
        this.tone(1047, 1047, 0.25, 0.035, 'triangle');
        break;
    }
  }
}

export const sound = new Sound();

/** 右上角的喇叭按钮 */
export function bindSoundToggle() {
  const btn = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  if (!btn) return;
  btn.hidden = false;
  btn.addEventListener('click', () => sound.toggle());
  sound.onChange((on) => {
    btn.setAttribute('aria-pressed', String(on));
    const label = on ? '关闭环境音' : '打开 8-bit 环境音';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
}
