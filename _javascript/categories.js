import { basic, initSidebar, initTopbar } from './modules/layouts';
import { categoryCollapse } from './modules/components';

console.log('[Blog] categories.js loaded');

basic();
initSidebar();
initTopbar();
categoryCollapse();

console.log('[Blog] Categories page fully initialized');
