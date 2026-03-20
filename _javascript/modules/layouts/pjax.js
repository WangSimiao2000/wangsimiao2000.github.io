/**
 * Lightweight PJAX-like navigation
 * Intercepts internal link clicks, fetches new page via AJAX,
 * replaces only the #swup container content, and updates title/URL.
 *
 * After DOM replacement, calls reinitPage() to set up page-specific
 * components (TOC, clipboard, image popup, etc.) without a full reload.
 */

const CONTAINER_ID = 'swup';
const TRANSITION_DURATION = 150; // ms

let isNavigating = false;

function shouldIntercept(el) {
  if (!el || el.tagName !== 'A') return false;
  if (el.target === '_blank' || el.hasAttribute('download')) return false;
  if (el.origin !== window.location.origin) return false;
  if (el.pathname === window.location.pathname && el.hash) return false;
  return true;
}

function updateActiveNav(path) {
  document.querySelectorAll('#sidebar .nav-item').forEach((item) => {
    const link = item.querySelector('a');
    if (!link) return;
    const href = link.getAttribute('href');
    const isActive =
      (href === '/' && path === '/') ||
      (href !== '/' && path.startsWith(href));
    item.classList.toggle('active', isActive);
  });
}

/**
 * Load external scripts that the new page needs but the current page doesn't have.
 * Compares <script> tags in <head> between current doc and new doc.
 */
function loadNewHeadScripts(doc) {
  const currentSrcs = new Set(
    [...document.querySelectorAll('head script[src]')].map((s) =>
      s.getAttribute('src')
    )
  );

  const promises = [];
  doc.querySelectorAll('head script[src]').forEach((s) => {
    const src = s.getAttribute('src');
    if (!currentSrcs.has(src)) {
      console.log('[PJAX] Loading new script:', src);
      const script = document.createElement('script');
      script.src = src;
      const p = new Promise((resolve) => {
        script.onload = resolve;
        script.onerror = resolve;
      });
      document.head.appendChild(script);
      promises.push(p);
    }
  });

  return Promise.all(promises);
}

async function navigate(url, pushState = true) {
  if (isNavigating) {
    console.log('[PJAX] Navigation skipped — already navigating');
    return;
  }
  isNavigating = true;
  console.log(`[PJAX] Navigating to: ${url}`);

  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn('[PJAX] #swup container not found, falling back');
    window.location.href = url;
    return;
  }

  const mainContent = container.querySelector('main');

  try {
    // Fade out
    if (mainContent) {
      mainContent.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      mainContent.style.opacity = '0';
    } else {
      container.style.opacity = '0';
    }

    const response = await fetch(url);
    if (!response.ok) {
      window.location.href = url;
      return;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newContainer = doc.getElementById(CONTAINER_ID);
    if (!newContainer) {
      window.location.href = url;
      return;
    }

    await new Promise((r) => setTimeout(r, TRANSITION_DURATION));

    // Replace main content
    const newMain = newContainer.querySelector('main');
    if (mainContent && newMain) {
      mainContent.innerHTML = newMain.innerHTML;

      // Re-execute inline scripts
      mainContent.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.replaceWith(newScript);
      });
    }

    // Replace panel
    const panel = container.querySelector('#panel-wrapper');
    const newPanel = newContainer.querySelector('#panel-wrapper');
    if (panel && newPanel) {
      panel.innerHTML = newPanel.innerHTML;
    }

    // Update title
    document.title = doc.title;

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumb');
    const newBreadcrumb = doc.getElementById('breadcrumb');
    if (breadcrumb && newBreadcrumb) {
      breadcrumb.innerHTML = newBreadcrumb.innerHTML;
    }

    // Update topbar title
    const topbarTitle = document.getElementById('topbar-title');
    const newTopbarTitle = doc.getElementById('topbar-title');
    if (topbarTitle && newTopbarTitle) {
      topbarTitle.innerHTML = newTopbarTitle.innerHTML;
    }

    // Load any new external scripts (e.g. tocbot, dayjs, glightbox)
    await loadNewHeadScripts(doc);

    // Update URL
    if (pushState) {
      history.pushState({}, '', url);
    }

    // Update sidebar active state (preserve scroll position)
    const sidebar = document.getElementById('sidebar');
    const sidebarScrollTop = sidebar ? sidebar.scrollTop : 0;
    updateActiveNav(new URL(url, window.location.origin).pathname);
    if (sidebar) sidebar.scrollTop = sidebarScrollTop;

    // Reinitialize page-specific components
    if (typeof window.__reinitPage === 'function') {
      window.__reinitPage();
    }

    // Scroll to top
    window.scrollTo({ top: 0 });

    // Fade in
    if (mainContent) {
      mainContent.style.opacity = '1';
    } else {
      container.style.opacity = '1';
    }

    console.log(`[PJAX] ✓ Navigation complete: ${url}`);
  } catch (e) {
    console.error('[PJAX] Navigation error:', e);
    window.location.href = url;
  } finally {
    isNavigating = false;
  }
}

export function initPjax() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!shouldIntercept(link)) return;
    e.preventDefault();
    if (link.href === window.location.href) return;
    navigate(link.href);
  });

  window.addEventListener('popstate', () => {
    navigate(window.location.href, false);
  });
}
