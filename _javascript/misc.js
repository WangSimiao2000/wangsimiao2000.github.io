import { basic, initSidebar, initTopbar } from './modules/layouts';
import { initLocaleDatetime } from './modules/components';

console.log('[Blog] misc.js loaded');

initSidebar();
initTopbar();
initLocaleDatetime();
basic();

console.log('[Blog] Misc page fully initialized');
