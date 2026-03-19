/**
 * TypeScript 类型定义
 * 定义博客系统中所有核心数据结构的接口
 */

/** 支持的语言类型 */
export type Locale = 'zh-CN' | 'en';

/** 博文 Frontmatter 接口 */
export interface PostFrontmatter {
  title: string;
  date: Date;
  categories: string[];
  tags: string[];
  description?: string;
  image?: string;
  toc: boolean;
  comments: boolean;
  pin: boolean;
  math: boolean;
  mermaid: boolean;
  last_modified_at?: Date;
  lang?: Locale;
}

/** 友链数据 */
export interface FriendLink {
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

/** 相册项目 */
export interface GalleryItem {
  title: string;
  image: string;
  key: string;
}

/** 工具项目 */
export interface ToolItem {
  name: string;
  description: string;
  url: string;
  icon: string;
}

/** 社交联系方式 */
export interface ContactItem {
  type: string;
  icon: string;
  url?: string;
  noblank?: boolean;
}

/** 多语言文本数据 */
export interface LocaleData {
  layout: {
    post: string;
    category: string;
    tag: string;
  };
  tabs: Record<string, string>;
  search: {
    hint: string;
    cancel: string;
    no_results: string;
  };
  post: {
    posted: string;
    updated: string;
    words: string;
    read_time: {
      unit: string;
      prompt: string;
    };
    relate_posts: string;
    share: string;
    button: {
      next: string;
      previous: string;
      copy_code: {
        succeed: string;
      };
    };
  };
}

/** Giscus 评论配置 */
export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: string;
  lang: string;
}

/** 站点配置 */
export interface SiteConfig {
  title: string;
  tagline: string;
  description: string;
  url: string;
  lang: Locale;
  timezone: string;
  avatar: string;
  cdn: string;
  paginate: number;
  toc: boolean;
  social: {
    name: string;
    email: string;
    github: string;
  };
  comments: {
    provider: 'giscus';
    giscus: GiscusConfig;
  };
  pwa: {
    enabled: boolean;
  };
  seo: {
    google: string;
    bing: string;
  };
  r2Gallery: {
    publicUrl: string;
    prefix: string;
  };
}
