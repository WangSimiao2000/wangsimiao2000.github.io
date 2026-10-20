/**
 * 联系方式：一排图标按钮 + 微信/QQ 二维码浮层 + Switch 好友代码浮层（原生 popover）。
 * 首页关于卡片和关于页都用它；首页的世界一直在 DOM 里，关于页又会被放进阅读面板，
 * 所以浮层 id 带前缀（prefix），两处同时存在也不会撞 id。
 */
import { html } from '../../build/html.mjs';
import { site } from '../site.mjs';
import { ICONS } from './icons.mjs';

/** 图标按钮：只显示图标，名字放在 aria-label 和悬停提示里 */
const icon = (name) => html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;

const iconLink = (href, name, label) =>
  html`<a class="icon-btn" href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${icon(name)}</a>`;

const iconBtn = (name, label, pop, copy) =>
  copy
    ? html`<button type="button" class="icon-btn" popovertarget="${pop}" data-copy="${copy}" data-copy-tip="${pop}-tip" aria-label="${label}" title="${label}">${icon(name)}</button>`
    : html`<button type="button" class="icon-btn" popovertarget="${pop}" aria-label="${label}" title="${label}">${icon(name)}</button>`;

/** 二维码浮层：点按钮打开，点外面或按 Esc 关闭，不需要脚本 */
const qrPopover = (id, src, alt, hint) => html`
  <div class="qr-pop" id="${id}" popover>
    <img src="${src}" alt="${alt}" width="220" height="220" loading="lazy">
    <p>${hint}</p>
    <p class="muted small">手机上长按图片识别</p>
  </div>`;

export function contactIcons(prefix) {
  const id = (s) => `${prefix}-${s}`;
  return html`
    <p class="contact-icons">
      ${iconLink(site.links.github, 'github', 'GitHub')}
      ${iconLink(site.links.bilibili, 'bilibili', 'Bilibili · 鄙人米奇喵')}
      ${iconLink(site.links.steam, 'steam', 'Steam')}
      ${iconBtn('wechat', '微信', id('wechat'))}
      ${iconBtn('tencentqq', 'QQ', id('qq'))}
      ${iconBtn('nintendoswitch', 'Switch 好友代码', id('switch'), site.switchCode)}
      ${iconLink('/assets/resume/WangSimiao_resume.pdf', 'resume', '简历 PDF')}
    </p>`;
}

export function contactPopovers(prefix) {
  const id = (s) => `${prefix}-${s}`;
  return html`
  ${qrPopover(id('wechat'), '/assets/img/wechat-qr.webp', '微信二维码', '微信扫码加好友')}
  ${qrPopover(id('qq'), '/assets/img/qq-qr.webp', 'QQ 二维码', 'QQ 扫码加好友')}
  <div class="qr-pop code-pop" id="${id('switch')}" popover>
    <p class="muted small">Nintendo Switch 好友代码</p>
    <p class="sw-code">${site.switchCode}</p>
    <p class="muted small" id="${id('switch')}-tip" aria-live="polite">正在复制…</p>
  </div>`;
}
