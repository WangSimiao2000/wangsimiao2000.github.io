# MickeyMiao 的博客

[blog.mickeymiao.cn](https://blog.mickeymiao.cn) 的源码。v2 不用任何站点框架，由仓库里几百行的生成器把 Markdown 渲染成纯静态页面，部署在 GitHub Pages。

首页是一个像素世界：往下滚动，小人向前跑，每屏停在一个新的群系，上方是对应板块的卡片。

## 开发

需要 Node.js 22.18 或更高版本（用到内置的 TypeScript 类型擦除）。

```bash
npm ci
npm run dev      # http://127.0.0.1:4399，改动后自动重建并刷新浏览器
npm run build    # 输出到 dist/
```

可选的类型检查：`npx -p typescript tsc -p .`

## 依赖

只有 4 个，都在构建时运行，页面上不加载任何第三方脚本：

| 包 | 用途 |
|---|---|
| markdown-it | Markdown 解析 |
| katex | 公式渲染（构建时生成 HTML，页面只加载样式和字体） |
| highlight.js | 代码高亮（构建时着色） |
| yaml | front matter 与数据文件 |

## 目录

```
build/
├── build.mjs      # 构建入口
├── dev.mjs        # 开发服务器（仅 127.0.0.1）
├── content.mjs    # 读取文章与数据，git 记录取更新时间
├── markdown.mjs   # markdown-it 配置：公式、kramdown 图片宽度、标题 id、外链
├── assets.mjs     # .ts 类型擦除、资源按内容哈希放到 /_s/<hash>/
└── html.mjs       # html`` 模板标签，插值自动转义
src/
├── content/posts/ # 文章，文件名 YYYY-MM-DD-slug.md，URL 为 /posts/slug/
├── data/          # friends.yml 友链、tools.yml 工具、contact.yml 联系方式
├── templates/     # 页面模板（纯 JS 函数）
├── art/           # 像素精灵源图，每个精灵一张 PNG（构建时打包成图集）
├── assets/        # css/ 与 js/（js/pixel/ 是首页像素世界）
└── site.mjs       # 站点信息
public/            # 原样复制的静态文件（配图、头像、简历、CNAME）
tools/             # 旧站的工具页，待迁移
```

## 像素素材

首页世界里固定的精灵（主角、女孩、猫、树、房子、路牌、营火、孔明灯、生日帽……）每个一张 PNG，放在 `src/art/`，
文件路径就是精灵名：`src/art/hero/r/run/0.png` 是 `hero.r.run.0`，`src/art/scenery/cottage.glow.png` 是小屋的自发光遮罩
（夜里不盖夜色的像素，比如窗户、灯泡，尺寸要和本体一样）。用 Aseprite / Piskel 直接改、尺寸随便改，新加精灵就放一张新图。

`npm run dev` / `npm run build` / `npm test` 会先跑 `build/atlas.mjs`，把这些小图拼成一张图集（`src/assets/img/atlas.png` 和坐标表
`src/assets/js/pixel/atlas-map.ts`，都是生成文件、不进 git），访客只加载这一张图。打包时会检查：代码要用的精灵缺了、
角色同一动作的各帧尺寸不一致、自发光遮罩尺寸不对，都会直接报错，CI 也就停在部署之前。

注意：小屋（窗户光晕、门洞、门的点击区域、烟囱）、路灯灯泡、营火火焰的位置是写在 `src/assets/js/pixel/scenery.ts`
里的像素坐标（`COTTAGE`、`LAMP_BULB`、`CAMPFIRE_FLAME`），挪动这几张图里的门窗灯火时要同步改这些数字。
主角、女孩只画朝右一套（`hero/r/...`、`girl/r/...`），朝左的由打包脚本水平翻转生成；哪一帧翻过去别扭，
就在 `l/` 下放一张手画的同名图，会优先用它。同一个角色的所有帧画布尺寸要一样、脚底贴最下面一行。
生日帽戴在哪儿写在 `src/assets/js/pixel/hero.ts` 的 `HAT` 里（每帧一个偏移），改了主角的头部位置要跟着改。
地形、天空、粒子、烟花是按坐标实时算的，仍在代码里。

## 文章写法

front matter 与旧站相同：`title`、`date`、`categories`、`tags`、`description`、`math`、`pin`。`math: true` 时启用 `$...$` / `$$...$$` 公式；图片可以用 `![](src){:width="700px"}` 指定宽度。
