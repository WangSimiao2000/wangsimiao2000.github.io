/**
 * Lightweight PJAX-like navigation
 * Intercepts internal link clicks, fetches new page via AJAX,
 * replaces only the #swup container content, and updates title/URL.
 */

const CONTAINER_ID = 'swup';
const TRANSITION_DURATION = 150; // ms

let isNavigating = false;

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
  if (isNavigating) return;
  isNavigating = true;

  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    window.location.href = url;
    return;
  }

  // Only fade the main content area, not the sidebar
  const mainContent = container.querySelector('main');

  try {
    // Fade out main content only
    if (mainContent) {
      mainContent.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      mainContent.style.opacity = '0';
    } else {
      container.style.opacity = '0';
    }

    // Fetch new page
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

    // Wait for fade out to finish
    await new Promise((r) => setTimeout(r, TRANSITION_DURATION));

    // Replace main content
    const newMain = newContainer.querySelector('main');
    if (mainContent && newMain) {
      mainContent.innerHTML = newMain.innerHTML;
    }

    // Silently replace sidebar (no animation)
    const panel = container.querySelector('#panel-wrapper');
    const newPanel = newContainer.querySelector('#panel-wrapper');
    if (panel && newPanel) {
      panel.innerHTML = newPanel.innerHTML;
    }

    // Replace tail/footer
    const tail = container.querySelector('#tail-wrapper');
    const newTail = newContainer.querySelector('#tail-wrapper');
    if (tail && newTail) {
      tail.innerHTML = newTail.innerHTML;
    }

    // Update title
    document.title = doc.title;

    // Update URL
    if (pushState) {
      history.pushState({}, '', url);
    }

    // Update sidebar active state
    updateActiveNav(new URL(url, window.location.origin).pathname);

    // Scroll to top
    window.scrollTo({ top: 0 });

    // Fade in main content only
    if (mainContent) {
      mainContent.style.opacity = '1';
    } else {
      container.style.opacity = '1';
    }
  } catch (e) {
    window.location.href = url;
  } finally {
    isNavigating = false;
  }
}

export function initPjax() {
  // Intercept clicks on internal links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!shouldIntercept(link)) return;

    e.preventDefault();

    // Skip if same page
    if (link.href === window.location.href) return;

    navigate(link.href);
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    navigate(window.location.href, false);
  });
}
