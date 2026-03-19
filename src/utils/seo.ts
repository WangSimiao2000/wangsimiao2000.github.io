/**
 * SEO 工具函数
 * 生成 SEO 元标签、搜索引擎验证码和 JSON-LD 结构化数据的 HTML 字符串
 * 这些函数可独立于 Astro 组件进行测试
 */

import { siteConfig } from '../config';

/**
 * 生成页面标题
 * 如果 title 与站点标题相同，只返回站点标题；否则返回 "title | siteTitle"
 */
export function generatePageTitle(title: string, siteTitle: string = siteConfig.title): string {
  if (title === siteTitle) {
    return siteTitle;
  }
  return `${title} | ${siteTitle}`;
}

/**
 * SEO meta 标签生成参数
 */
export interface MetaTagsOptions {
  title: string;
  description: string;
  url: string;
  siteTitle?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * 生成 SEO meta 标签 HTML 字符串
 * 包含 <title>、<meta description>、Open Graph 标签
 */
export function generateMetaTags(options: MetaTagsOptions): string {
  const {
    title,
    description,
    url,
    siteTitle = siteConfig.title,
    ogImage,
    noindex = false,
  } = options;

  const pageTitle = generatePageTitle(title, siteTitle);
  const parts: string[] = [];

  parts.push(`<title>${escapeHtml(pageTitle)}</title>`);
  parts.push(`<meta name="description" content="${escapeAttr(description)}" />`);
  parts.push(`<link rel="canonical" href="${escapeAttr(url)}" />`);

  if (noindex) {
    parts.push('<meta name="robots" content="noindex, nofollow" />');
  }

  // Open Graph
  parts.push('<meta property="og:type" content="website" />');
  parts.push(`<meta property="og:title" content="${escapeAttr(pageTitle)}" />`);
  parts.push(`<meta property="og:description" content="${escapeAttr(description)}" />`);
  parts.push(`<meta property="og:url" content="${escapeAttr(url)}" />`);
  parts.push(`<meta property="og:site_name" content="${escapeAttr(siteTitle)}" />`);

  if (ogImage) {
    parts.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  }

  return parts.join('\n');
}

/**
 * 搜索引擎验证码配置
 */
export interface VerificationConfig {
  google?: string;
  bing?: string;
}

/**
 * 生成搜索引擎验证码 meta 标签
 */
export function generateVerificationTags(config: VerificationConfig): string {
  const parts: string[] = [];

  if (config.google) {
    parts.push(`<meta name="google-site-verification" content="${escapeAttr(config.google)}" />`);
  }

  if (config.bing) {
    parts.push(`<meta name="msvalidate.01" content="${escapeAttr(config.bing)}" />`);
  }

  return parts.join('\n');
}

/**
 * JSON-LD 博文结构化数据参数
 */
export interface JsonLdOptions {
  title: string;
  author: string;
  date: Date;
  description?: string;
  url: string;
  image?: string;
  lastModified?: Date;
}

/**
 * 生成博文 JSON-LD 结构化数据
 */
export function generateJsonLd(options: JsonLdOptions): string {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: options.title,
    author: {
      '@type': 'Person',
      name: options.author,
    },
    datePublished: options.date.toISOString(),
    url: options.url,
  };

  if (options.description) {
    jsonLd.description = options.description;
  }

  if (options.image) {
    jsonLd.image = options.image;
  }

  if (options.lastModified) {
    jsonLd.dateModified = options.lastModified.toISOString();
  }

  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

/**
 * HTML 特殊字符转义（用于标签内容）
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * HTML 属性值转义
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
