import Swup from 'swup';
import SwupHeadPlugin from '@swup/head-plugin';

let swupInstance = null;

export function initSwup() {
  // Prevent multiple instances
  if (swupInstance) return;

  swupInstance = new Swup({
    containers: ['#swup'],
    animationSelector: '.swup-transition-main',
    cache: true,
    animateHistoryBrowsing: true,
    plugins: [
      new SwupHeadPlugin({
        persistAssets: true
      })
    ]
  });

  // Update sidebar active state after navigation
  swupInstance.hooks.on('page:view', () => {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('#sidebar .nav-item');

    navItems.forEach((item) => {
      const link = item.querySelector('a');
      if (!link) return;

      const href = link.getAttribute('href');
      const isActive =
        (href === '/' && currentPath === '/') ||
        (href !== '/' && currentPath.startsWith(href));

      item.classList.toggle('active', isActive);
    });

    // Scroll content area to top
    window.scrollTo({ top: 0 });
  });
}
