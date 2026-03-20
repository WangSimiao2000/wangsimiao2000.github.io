import { basic, initSidebar, initTopbar, initPjax } from './modules/layouts';
import {
  loadImg,
  imgPopup,
  initLocaleDatetime,
  initClipboard,
  initToc,
  loadMermaid,
  loadTooptip
} from './modules/components';
import { categoryCollapse } from './modules/components';

console.log('[Blog] commons.js loaded (universal bundle)');

/**
 * Reinitialize page-specific components based on current DOM.
 * Called on initial load and after every PJAX navigation.
 */
export function reinitPage() {
  const hasToc = document.querySelector('main > article[data-toc="true"]') !== null;
  const hasCodeBlock = document.querySelector('.code-header > button') !== null;
  const hasImages = document.querySelector('article img') !== null;
  const hasPopup = document.querySelector('.popup') !== null;
  const hasDatetime = document.querySelector('[data-ts]') !== null;
  const hasCategories = document.querySelector('.categories .collapse') !== null;

  if (hasImages) loadImg();
  if (hasToc) initToc();
  if (hasPopup) imgPopup();
  if (hasCodeBlock || document.getElementById('copy-link')) initClipboard();
  if (hasDatetime) initLocaleDatetime();
  if (hasCategories) categoryCollapse();
  loadMermaid();
  loadTooptip();

  console.log('[Blog] Page components reinitialized');
}

// Initial setup
initSidebar();
initTopbar();
basic();
reinitPage();

// Expose for PJAX
window.__reinitPage = reinitPage;

initPjax();

console.log('[Blog] Universal bundle fully initialized');
