# MickeyMiao's Blog

[![Build and Deploy](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/pages-deploy.yml/badge.svg)](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/pages-deploy.yml)
[![Daily R2 Gallery Sync](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/r2-gallery-sync.yml/badge.svg)](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/r2-gallery-sync.yml)

<a href="https://space.bilibili.com/36913332"><img src="https://img.shields.io/badge/Bilibili-鄙人米奇喵-00A1D6?style=for-the-badge&logo=bilibili&logoColor=white" alt="Bilibili@鄙人米奇喵"></a>
<a href="https://steamcommunity.com/id/MickeyMiao/"><img src="https://img.shields.io/badge/Steam-MickeyMiao-000000?style=for-the-badge&logo=steam&logoColor=white" alt="Steam: MickeyMiao"></a>
<a href="https://github.com/WangSimiao2000"><img src="https://img.shields.io/badge/GitHub-WangSimiao2000-181717?style=for-the-badge&logo=github" alt="GitHub: WangSimiao2000"></a>

基于 [Astro](https://astro.build/) 框架的个人博客，从 Jekyll + Chirpy 主题迁移而来。

🔗 **博客地址**: [https://blog.mickeymiao.cn](https://blog.mickeymiao.cn)

## 技术栈

- **框架**: [Astro](https://astro.build/) — SSG 静态站点生成，Islands 架构按需加载
- **语言**: TypeScript
- **样式**: CSS Layers + CSS 变量（明暗主题）+ Scoped CSS
- **搜索**: [Pagefind](https://pagefind.app/) — 构建时索引，支持中英文
- **评论**: [Giscus](https://giscus.app/) — 基于 GitHub Discussions
- **PWA**: [@vite-pwa/astro](https://vite-pwa-org.netlify.app/frameworks/astro.html)
- **CDN**: [Cloudflare R2](https://developers.cloudflare.com/r2/) — 静态资源 + 相册
- **测试**: [Vitest](https://vitest.dev/) + [fast-check](https://fast-check.dev/)（属性测试）
- **Markdown**: Shiki 代码高亮、KaTeX 数学公式、Mermaid 图表

## 功能特性

- 📝 Markdown 写作，支持 KaTeX 数学公式 & Mermaid 图表
- 🎨 亮色/暗色主题自动切换（CSS 变量驱动）
- 💬 Giscus 评论系统
- 📸 R2 云端相册，每日自动同步
- 🚀 Cloudflare R2 CDN 加速 + 自动缓存清除
- 🔍 Pagefind 全文搜索（中英文）
- 📱 PWA 离线支持
- 🔗 友链、相册、工具等数据驱动页面
- 🌐 中英文多语言 UI
- ⚡ View Transitions 页面切换动画

## 项目结构

```
├── content/
│   └── posts/               # Markdown 博文（日常编辑）
├── data/
│   ├── friends.yml          # 友链数据
│   ├── gallery.yml          # 相册数据（R2 自动生成）
│   ├── tools.yml            # 工具列表
│   ├── contact.yml          # 社交链接
│   ├── share.yml            # 分享平台配置
│   └── locales/             # 多语言 UI 文本
│       ├── zh-CN.yml
│       └── en.yml
├── src/
│   ├── components/          # UI 组件（Sidebar、TOC、SearchModal 等）
│   ├── layouts/             # 页面布局
│   │   ├── BaseLayout.astro     # 基础布局（SEO、Sidebar、Topbar）
│   │   ├── PostLayout.astro     # 文章详情布局
│   │   ├── PageLayout.astro     # 通用页面布局
│   │   └── ToolLayout.astro     # 工具页面布局（样式隔离）
│   ├── pages/               # 页面路由（文件即路由）
│   ├── styles/              # 全局样式、主题、卡片、排版
│   ├── utils/               # 工具函数（i18n、日期、分页、阅读时间等）
│   ├── config.ts            # 站点配置（替代 _config.yml）
│   ├── content.config.ts    # Content Collections 定义
│   └── types.ts             # TypeScript 类型定义
├── public/                  # 静态资源（直接复制到构建输出）
│   ├── CNAME
│   └── robots.txt
├── scripts/                 # 部署脚本
│   ├── sync-assets-r2.sh        # R2 资源同步
│   └── generate-gallery-r2.sh   # R2 相册数据生成
├── tests/                   # 属性测试
├── astro.config.ts          # Astro 配置
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**关键路径说明**：
- 日常内容编辑只需关注 `content/posts/` 和 `data/` 目录（≤ 2 层嵌套）
- 代码文件统一在 `src/` 下，按 components / layouts / pages / utils 组织
- 站点配置集中在 `src/config.ts`

## 本地开发

### 环境要求

- Node.js 20+
- npm

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（支持 HMR 热更新）
npm run dev
```

开发服务器默认运行在 `http://localhost:4321`。

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建（输出到 `dist/`） |
| `npm run preview` | 预览生产构建 |
| `npm test` | 运行测试（Vitest） |
| `npm run lint` | ESLint 代码检查 |
| `npm run format` | Prettier 格式化 |

## 内容编写指南

### 写文章

在 `content/posts/` 下新建 Markdown 文件，文件名格式：`YYYY-MM-DD-title.md`

```yaml
---
title: 文章标题
date: 2024-01-01
categories: [分类1, 分类2]
tags: [标签1, 标签2]
description: 文章摘要（可选，用于 SEO）
image: /assets/posts/cover.jpg   # 封面图（可选）
math: false          # 启用 KaTeX 数学公式
mermaid: false       # 启用 Mermaid 图表
pin: false           # 置顶
comments: true       # 评论区（设为 false 关闭）
toc: true            # 目录（设为 false 关闭）
last_modified_at: 2024-06-01  # 最后修改日期（可选）
lang: zh-CN          # 文章语言（可选，zh-CN 或 en）
---

正文内容...
```

### 管理数据页面

各数据驱动页面通过 `data/` 目录下的 YAML 文件管理，修改数据文件后重新构建即可生效：

- **友链**: 编辑 `data/friends.yml`
- **工具**: 编辑 `data/tools.yml`
- **社交链接**: 编辑 `data/contact.yml`
- **分享平台**: 编辑 `data/share.yml`
- **相册**: `data/gallery.yml`（由 R2 脚本自动生成）

### 添加新工具页面

1. 在 `data/tools.yml` 中添加一条记录
2. 在 `src/pages/tools/` 下创建对应目录和 `index.astro` 文件

### 多语言

UI 文本翻译在 `data/locales/` 下管理，默认语言通过 `src/config.ts` 中的 `lang` 字段配置。

## CI/CD

### 主部署流程 (`pages-deploy.yml`)

推送到 `main` 分支后自动执行：

1. 安装 Node.js 20 依赖
2. `sync-assets-r2.sh` — 同步静态资源到 R2 CDN
3. `generate-gallery-r2.sh` — 从 R2 生成相册数据
4. `astro build` — 构建静态站点
5. 部署到 GitHub Pages

### 相册同步 (`r2-gallery-sync.yml`)

每日自动从 R2 拉取相册数据，有变更时自动提交到仓库。

## 致谢

- 框架: [Astro](https://astro.build/)
- 原主题: [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) by Cotes Chung
- 评论: [Giscus](https://giscus.app/)
- 搜索: [Pagefind](https://pagefind.app/)
- CDN / 图床 / 相册: [Cloudflare R2](https://developers.cloudflare.com/r2/)

## License

[MIT](LICENSE)
