# MickeyMiao's Blog

[![Build and Deploy](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/pages-deploy.yml/badge.svg)](https://github.com/WangSimiao2000/wangsimiao2000.github.io/actions/workflows/pages-deploy.yml)

<a href="https://space.bilibili.com/36913332"><img src="https://img.shields.io/badge/Bilibili-鄙人米奇喵-00A1D6?style=for-the-badge&logo=bilibili&logoColor=white" alt="Bilibili@鄙人米奇喵"></a>
<a href="https://steamcommunity.com/id/MickeyMiao/"><img src="https://img.shields.io/badge/Steam-MickeyMiao-000000?style=for-the-badge&logo=steam&logoColor=white" alt="Steam: MickeyMiao"></a>
<a href="https://github.com/WangSimiao2000"><img src="https://img.shields.io/badge/GitHub-WangSimiao2000-181717?style=for-the-badge&logo=github" alt="GitHub: WangSimiao2000"></a>

基于 [Jekyll](https://jekyllrb.com/) + [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 主题的个人博客。

🔗 **博客地址**: [https://blog.mickeymiao.cn](https://blog.mickeymiao.cn)

## 功能特性

- 📝 Markdown 写作，支持 MathJax 数学公式 & Mermaid 图表
- 🎨 亮色/暗色主题自动切换
- 💬 Giscus 评论系统（基于 GitHub Discussions）
- 📸 R2 云端相册，每日自动同步
- 🚀 Cloudflare R2 CDN 加速静态资源 + 自动缓存清除
- 🔍 站内搜索
- 📱 PWA 支持
- 🔗 友链页面（自动检测可达性）
- 🧰 独立工具页面（称骨算命等）

## 项目结构

```
├── _config.yml          # Jekyll 主配置
├── _posts/              # 博客文章 (Markdown)
├── _tabs/               # 导航页面 (关于/归档/分类/标签/友链/相册/工具)
├── _layouts/            # 页面布局模板
├── _includes/           # 可复用 HTML 片段
├── _sass/               # SCSS 样式源码
│   ├── abstracts/       #   变量、mixin、断点
│   ├── base/            #   基础样式、排版、语法高亮
│   ├── components/      #   按钮、弹窗等组件
│   ├── layout/          #   侧边栏、顶栏、页脚
│   ├── pages/           #   各页面专属样式
│   ├── themes/          #   亮色/暗色主题
│   └── vendors/         #   Bootstrap 定制
├── _javascript/         # JS 源码 (Rollup 编译)
│   ├── modules/         #   功能模块 (TOC/搜索/剪贴板/主题切换等)
│   └── pwa/             #   Service Worker + PWA
├── _data/               # 数据文件
│   ├── locales/         #   国际化 (zh-CN, en)
│   ├── origin/          #   CDN 库地址配置
│   ├── contact.yml      #   联系方式
│   ├── friends.yml      #   友链列表
│   ├── media.yml        #   媒体配置
│   ├── share.yml        #   分享按钮配置
│   └── tools.yml        #   工具页数据
├── _plugins/            # Jekyll 插件 (git lastmod hook)
├── _scripts/            # 开发/部署脚本
│   ├── check-friends.sh       # 友链可达性检测
│   ├── run.sh                 # 本地开发服务器
│   └── test.sh                # 构建 + HTML 校验
├── assets/              # 静态资源
│   ├── css/             #   样式表 (含 Giscus 主题)
│   ├── js/dist/         #   编译后 JS (CI 自动生成，不提交)
│   ├── js/data/         #   搜索索引、SW 配置、MathJax
│   ├── img/             #   头像、favicon、照片、二维码
│   ├── posts/           #   文章配图
│   └── resume/          #   简历
├── tools/               # 独立工具页面
│   └── bazi-fortune/    #   称骨算命
├── rollup.config.js     # JS 构建配置
├── package.json         # Node.js 依赖
└── Gemfile              # Ruby 依赖
```

## 开发

### 环境要求

- Ruby 3.3+, Bundler
- Node.js 20+, npm

### 本地运行

```bash
# 安装依赖
bundle install
npm install

# 构建 JS + 启动开发服务器
npm run dev

# 或分步执行
npm run build              # 编译 JS
bundle exec jekyll s -l    # 启动 Jekyll (livereload)
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 JS (production) |
| `npm run watch` | JS 监听模式 |
| `npm run dev` | 构建 + 启动开发服务器 |
| `npm test` | 构建站点 + HTML 校验 |
| `npm run clean` | 清理所有构建产物，恢复干净状态 |

### 写文章

在 `_posts/` 下新建 Markdown 文件，格式：`YYYY-MM-DD-Title.md`

```yaml
---
title: 文章标题
date: 2024-01-01 12:00:00 +0800
categories: [分类1, 分类2]
tags: [标签1, 标签2]
math: false        # 启用 MathJax
mermaid: false     # 启用 Mermaid 图表
image: /path.jpg   # 封面图
pin: false         # 置顶
---
```

## CI/CD

### 主部署流程 (`pages-deploy.yml`)

推送到 `main` 分支后自动执行：

1. 安装 Ruby 3.3 + Node.js 20 依赖
2. `npm run build` 编译 JS
3. `check-friends.sh` — 检测友链可达性
4. `jekyll build` 构建站点
5. `htmlproofer` 校验 HTML
6. 部署到 GitHub Pages

## 致谢

- 主题: [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) by Cotes Chung
- 评论: [Giscus](https://giscus.app/)

## License

[MIT](LICENSE)
