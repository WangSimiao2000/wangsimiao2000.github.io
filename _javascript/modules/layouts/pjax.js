/**
 * Lightweight PJAX-like navigation
 * Intercepts internal link clicks, fetches new page via AJAX,
 * replaces only the #swup container content, and updates title/URL.
 *
 * Falls back to full page load when navigating between different page types
 * (e.g. browse → post) since each type loads a different JS bundle.
 */

const CONTAINER_ID = 'swup';
const TRANSITION_DURATION = 150; // ms

let isNavigating = false;

/**
 * Detect the JS bundle name from a parsed document by looking at
 * the <script> tag that loads from /assets/js/dist/*.min.js
 */
function detectBundle(doc) {
  const scripts = doc.querySelectorAll('script[src]');
  for (const s of scripts) {
    const m = s.getAttribute('src').match(/\/assets\/js\/dist\/(\w+)\.min\.js/);
    if (m) return m[1];
  }
  return null;
}

/** The bundle loaded on the current (initial) page */
const currentBundle = detectBundle(document);

function shouldIntercept(el) {
  // Only intercept internal same-origin links
  if (!el || el.tagName !== 'A') return false;
  if (el.target === '_blank' || el.hasAttribute('download')) return false;
  if (el.origin !== window.location.origin) return false;
  // Skip anchor links on same page
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

async function navigate(url, pushState = true) {
  if (isNavigating) {
    console.log('[PJAX] Navigation skipped — already navigating');
    return;
  }
  isNavigating = true;
  console.log(`[PJAX] Navigating to: ${url}`);

  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn('[PJAX] #swup container not found, falling back to full page load');
    window.location.href = url;
    return;
  }

  // Only fade the main content area, not the sidebar
  const mainContent = container.querySelector('main');

  try {
    // Fade out main content only
    console.log('[PJAX] Fading out main content');
    if (mainContent) {
      mainContent.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      mainContent.style.opacity = '0';
    } else {
      container.style.opacity = '0';
    }

    // Fetch new page
    const response = await fetch(url);
    console.log(`[PJAX] Fetch response: ${response.status}`);
    if (!response.ok) {
      console.warn(`[PJAX] Fetch failed (${response.status}), falling back`);
      window.location.href = url;
      return;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newContainer = doc.getElementById(CONTAINER_ID);
    if (!newContainer) {
      console.warn('[PJAX] New page has no #swup container, falling back');
      window.location.href = url;
      return;
    }

    // If the new page needs a different JS bundle, fall back to full load
    const newBundle = detectBundle(doc);
    if (newBundle !== currentBundle) {
      console.log(`[PJAX] Bundle mismatch (${currentBundle} → ${newBundle}), full page load`);
      window.location.href = url;
      return;
    }

    // Wait for fade out to finish
    await new Promise((r) => setTimeout(r, TRANSITION_DURATION));
    console.log('[PJAX] Fade out complete, replacing DOM');

    // Replace main content
    const newMain = newContainer.querySelector('main');
    if (mainContent && newMain) {
      mainContent.innerHTML = newMain.innerHTML;

      // Re-execute inline scripts in the new content
      mainContent.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.replaceWith(newScript);
      });

      console.log('[PJAX] ✓ Main content replaced');
    } else {
      console.warn('[PJAX] ✗ Main content not found', { mainContent: !!mainContent, newMain: !!newMain });
    }

    // Silently replace sidebar (no animation)
    const panel = container.querySelector('#panel-wrapper');
    const newPanel = newContainer.querySelector('#panel-wrapper');
    if (panel && newPanel) {
      panel.innerHTML = newPanel.innerHTML;
      console.log('[PJAX] ✓ Panel replaced (silent)');
    } else {
      console.warn('[PJAX] ✗ Panel not found', { panel: !!panel, newPanel: !!newPanel });
    }

    // Replace tail/footer
    const tail = container.querySelector('#tail-wrapper');
    const newTail = newContainer.querySelector('#tail-wrapper');
    if (tail && newTail) {
      tail.innerHTML = newTail.innerHTML;
      console.log('[PJAX] ✓ Tail/footer replaced (silent)');
    } else {
      console.warn('[PJAX] ✗ Tail not found', { tail: !!tail, newTail: !!newTail });
    }

    // Update title
    document.title = doc.title;

    // Update breadcrumb from new page
    const breadcrumb = document.getElementById('breadcrumb');
    const newBreadcrumb = doc.getElementById('breadcrumb');
    if (breadcrumb && newBreadcrumb) {
      breadcrumb.innerHTML = newBreadcrumb.innerHTML;
      console.log('[PJAX] ✓ Breadcrumb updated');
    }

    // Update topbar title from new page
    const topbarTitle = document.getElementById('topbar-title');
    const newTopbarTitle = doc.getElementById('topbar-title');
    if (topbarTitle && newTopbarTitle) {
      topbarTitle.innerHTML = newTopbarTitle.innerHTML;
      console.log('[PJAX] ✓ Topbar title updated');
    }

    // Update URL
    if (pushState) {
      history.pushState({}, '', url);
    }

    // Update sidebar active state (preserve scroll position)
    const sidebar = document.getElementById('sidebar');
    const sidebarScrollTop = sidebar ? sidebar.scrollTop : 0;
    updateActiveNav(new URL(url, window.location.origin).pathname);
    if (sidebar) sidebar.scrollTop = sidebarScrollTop;
    console.log('[PJAX] Sidebar nav updated');

    // Scroll to top
    window.scrollTo({ top: 0 });

    // Fade in main content only
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
  console.log('[PJAX] Setting up event listeners');

  // Intercept clicks on internal links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!shouldIntercept(link)) return;

    e.preventDefault();

    // Skip if same page
    if (link.href === window.location.href) {
      console.log('[PJAX] Same page click ignored:', link.href);
      return;
    }

    console.log('[PJAX] Link intercepted:', link.href);
    navigate(link.href);
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    console.log('[PJAX] Popstate (back/forward):', window.location.href);
    navigate(window.location.href, false);
  });
}
