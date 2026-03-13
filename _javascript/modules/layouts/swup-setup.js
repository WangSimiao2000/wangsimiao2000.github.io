import Swup from 'swup';
import SwupHeadPlugin from '@swup/head-plugin';
import SwupScriptsPlugin from '@swup/scripts-plugin';

export function initSwup() {
  const swup = new Swup({
    containers: ['#swup'],
    animationSelector: '.swup-transition-main',
    cache: true,
    plugins: [
      new SwupHeadPlugin({
        persistAssets: true // keep existing CSS/JS, avoid re-downloading
      }),
      new SwupScriptsPlugin({
        head: true,
        body: true
      })
    ]
  });

  // Update sidebar active state after navigation
  swup.hooks.on('page:view', () => {
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
