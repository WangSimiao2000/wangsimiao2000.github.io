/**
 * Rehype plugin: rewrite local /assets/ URLs to CDN
 * Replaces src="/assets/..." and href="/assets/..." with CDN prefix
 */
import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

const CDN_URL = 'https://cdn.mickeymiao.cn';

export function rehypeCdnAssets() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      rewriteAttr(node, 'src');
      rewriteAttr(node, 'href');
    });
  };
}

function rewriteAttr(node: Element, attr: string) {
  const val = node.properties?.[attr];
  if (typeof val === 'string' && val.startsWith('/assets/')) {
    node.properties[attr] = CDN_URL + val;
  }
}
