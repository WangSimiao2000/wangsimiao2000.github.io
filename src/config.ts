import type { SiteConfig } from './types';

/**
 * 站点配置
 * 替代原有的 Jekyll _config.yml，集中管理所有站点元信息
 */
export const siteConfig: SiteConfig = {
  title: 'MickeyMiao',
  tagline: 'code is cheap, show me your prompt',
  description: 'MickeyMiao 的个人博客，分享编程、技术与生活',
  url: 'https://blog.mickeymiao.cn',
  lang: 'zh-CN',
  timezone: 'Asia/Shanghai',
  avatar: 'https://cdn.mickeymiao.cn/assets/img/avatar/avatar.png',
  cdn: 'https://cdn.mickeymiao.cn',
  paginate: 10,
  toc: true,

  social: {
    name: 'Wang Simiao',
    email: '[email]',
    github: 'WangSimiao2000',
  },

  comments: {
    provider: 'giscus',
    giscus: {
      repo: 'WangSimiao2000/wangsimiao2000.github.io',
      repoId: 'R_kgDONW4tGQ',
      category: 'General',
      categoryId: 'DIC_kwDONW4tGc4ClVF_',
      mapping: 'pathname',
      lang: 'zh-CN',
    },
  },

  pwa: { enabled: true },

  seo: {
    google: '[verification_code]',
    bing: '[verification_code]',
  },

  r2Gallery: {
    publicUrl: 'https://cdn.mickeymiao.cn',
    prefix: 'gallery/',
  },
};
