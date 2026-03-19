/**
 * 卡片渲染工具函数
 * 提供 Friends 和 Tools 卡片的 HTML 模板生成，
 * 确保数据驱动页面包含所有必填字段。
 *
 * Requirements: 3.6, 3.7, 12.8
 */
import type { FriendLink, ToolItem } from '../types';

/**
 * 生成友链卡片 HTML
 * 必填字段: name, url
 */
export function renderFriendCard(friend: FriendLink): string {
  const iconHtml = friend.icon
    ? `<img src="${friend.icon}" alt="${friend.name}" class="card-avatar" loading="lazy" />`
    : `<div class="card-icon"><span>${friend.name.charAt(0)}</span></div>`;

  const descHtml = friend.description
    ? `<p class="card-description">${friend.description}</p>`
    : '';

  return `<a href="${friend.url}" target="_blank" rel="noopener noreferrer" class="card friend-card">
  <div class="card-body">
    <div class="friend-header">
      ${iconHtml}
      <div class="friend-info">
        <h2 class="card-title">${friend.name}</h2>
        ${descHtml}
      </div>
    </div>
  </div>
</a>`;
}

/**
 * 生成工具卡片 HTML
 * 必填字段: name, description, icon
 */
export function renderToolCard(tool: ToolItem): string {
  return `<a href="${tool.url}" class="card tool-card">
  <div class="card-body">
    <div class="tool-icon">
      <i class="${tool.icon}"></i>
    </div>
    <h2 class="card-title">${tool.name}</h2>
    <p class="card-description">${tool.description}</p>
  </div>
</a>`;
}

/**
 * 批量渲染友链卡片网格
 */
export function renderFriendCards(friends: FriendLink[]): string {
  return `<div class="card-grid">${friends.map(renderFriendCard).join('\n')}</div>`;
}

/**
 * 批量渲染工具卡片网格
 */
export function renderToolCards(tools: ToolItem[]): string {
  return `<div class="card-grid">${tools.map(renderToolCard).join('\n')}</div>`;
}
