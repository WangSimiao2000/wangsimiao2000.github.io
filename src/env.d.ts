/// <reference types="astro/client" />

/**
 * Global window extensions for component re-initialization functions.
 * These are set by individual components (TOC, CodeCopy, Lightbox, Mermaid)
 * and called by BaseLayout after View Transitions page swap.
 */
interface Window {
  initTOC?: () => void;
  initCodeCopy?: () => void;
  initLightbox?: () => void;
  renderMermaid?: () => void;
}
