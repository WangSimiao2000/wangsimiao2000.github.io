import { basic, initSidebar, initTopbar, initPjax } from './modules/layouts';

console.log('[Blog] commons.js loaded');

initSidebar();
console.log('[Blog] Sidebar initialized');

initTopbar();
console.log('[Blog] Topbar initialized');

basic();
console.log('[Blog] Basic modules initialized');

initPjax();
console.log('[Blog] PJAX initialized');
