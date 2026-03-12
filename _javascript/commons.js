import { basic, initSidebar, initTopbar } from './modules/layouts';

/* Watermark entrance animation — block interaction until done */
document.body.classList.add('watermark-animating');
document.body.addEventListener(
  'animationend',
  (e) => {
    if (e.animationName === 'watermark-enter') {
      document.body.classList.remove('watermark-animating');
    }
  },
  { once: true }
);

initSidebar();
initTopbar();
basic();
