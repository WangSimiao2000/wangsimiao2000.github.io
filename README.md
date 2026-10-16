# MickeyMiao 的博客

[blog.mickeymiao.cn](https://blog.mickeymiao.cn) 的源码。v2 用 [Astro](https://astro.build) 从零重写，输出纯静态页面，部署在 GitHub Pages。

首页是一个像素世界：往下滚动，小人向前跑，每屏停在一个新的群系，上方是对应板块的卡片。

## 开发

需要 Node.js 22.22 或更高版本。

```bash
npm ci
npm run dev      # http://127.0.0.1:4321
npm run build    # 输出到 dist/
npm run check    # 类型检查
```

## 目录

```
src/
├── content/posts/   # 文章，文件名 YYYY-MM-DD-slug.md，URL 为 /posts/slug/
├── data/            # friends.yml 友链、tools.yml 工具、contact.yml 联系方式
├── pixel/           # 首页像素世界：sprites.ts 小人/方块/装饰，world.ts 滚动与渲染
├── lib/             # 文章查询等工具函数
├── pages/           # 路由
└── site.ts          # 站点信息
public/              # 原样复制的静态文件（配图、头像、简历、CNAME）
tools/               # 旧站的工具页，待迁移
```
