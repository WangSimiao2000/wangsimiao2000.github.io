import { basic, initSidebar, initTopbar } from './modules/layouts';
import { initLocaleDatetime, loadImg } from './modules/components';

console.log('[Blog] home.js loaded');

loadImg();
initLocaleDatetime();
initSidebar();
initTopbar();
basic();

console.log('[Blog] Home page fully initialized');
