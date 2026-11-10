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

浏览器测试在 `tests/e2e/`，需要 playwright-core。它不在项目依赖里，装在别的目录，再用 `PLAYWRIGHT_CORE` 指过来：

```bash
npm i --prefix ~/pw playwright-core && npx --prefix ~/pw playwright-core install chromium chromium-headless-shell
npm run dev   # 另开一个终端
PLAYWRIGHT_CORE=~/pw node tests/e2e/flow.mjs
```

交互和时序测试用 headless shell。要看 WebGPU 画面的测试（`webgpu.mjs` 自检、`world-pixels.mjs` 画面回归）用完整版 Chromium，配合 SwiftShader 软件渲染。

## 依赖

只有 4 个，都在构建时运行，页面上不加载任何第三方脚本：

| 包 | 用途 |
|---|---|
| markdown-it | Markdown 解析 |
| katex | 公式渲染（构建时生成 HTML，页面只加载样式和字体） |
| highlight.js | 代码高亮（构建时着色） |
| yaml | front matter 与数据文件 |

开发依赖只有 `@webgpu/types`：WebGPU 的类型声明，给编辑器和类型检查用，不进页面。

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

## 像素世界

代码在 `src/assets/js/pixel/`，分三块，只通过绘制清单（`drawlist.ts`）连在一起：

```
pixel/
├── world.ts     # 编排：画布尺寸、滚动和相机、面板、隐藏页；每帧调用 sim/ 写清单，再交给渲染器
├── input.ts     # 滚轮、触屏、键盘、点击
├── drawlist.ts  # 模拟和渲染器之间的约定：图层、命令格式、各层怎么合成（COMPOSE）
├── ui-bridge.ts # 每帧量一次要画毛玻璃的元素（位置、圆角、不透明度）和对焦拉近的进度，交给渲染器
├── atlas.ts     # 精灵 = 图集里的一块坐标（不含像素）
├── sim/         # 模拟：群系、地形、天空、灯光、粒子、彩蛋、主角……只算状态、写清单，不碰画布，可以在 Node 里测
└── render/      # 渲染器：只读清单
    ├── index.ts     # 选渲染器
    ├── gpu/         # WebGPU：每层画到纹理（layer.wgsl）→ 光照图、景深、辉光、体积光 → 按 COMPOSE 合成（compose.wgsl）
    └── classic.ts   # Canvas 2D：迁移到 WebGPU 期间保留，用来对照画面
```

现在默认还是 Canvas 2D，网址加 `?gpu` 用 WebGPU（带光效）。`?gpu&fx=0` 关掉全部光效，`?gpu&fx=lights,bloom` 只开其中几项
（lights 点光源、dof 景深、bloom 辉光、rays 白天体积光、beams 夜里灯光的光束和人物遮挡、grade 按群系调色、
glass 卡片后面的毛玻璃和打开文章时的对焦拉近、front 压在卡片上的前景）。两个渲染器读同一份清单，`tests/e2e/world-pixels.mjs` 用来对比画面：
Canvas 2D 和改造前逐像素一致，WebGPU 关掉光效后和它每个颜色通道的差不超过 3（混合时的舍入不同）。

光效的参数：光源的半径、亮度、颜色和光束（方向、张角、长度）在 `sim/lights.ts` 的 `LIGHT`；每个群系白天体积光的强弱是 `sim/biomes.ts` 里的 `rays`；
远景三层离镜头多远（景深模糊多少）是 `drawlist.ts` 里 `COMPOSE` 的 `depth`。

加新的画面元素：在 `sim/` 里往清单写命令；要新的合成规则（比如新的一层）改 `drawlist.ts` 的 `LAYERS` 和 `COMPOSE`，两个渲染器都会跟上。

## 像素素材

首页世界里固定的精灵（主角、女孩、猫、树、房子、路牌、营火、孔明灯、生日帽……）每个一张 PNG，放在 `src/art/`，
文件路径就是精灵名：`src/art/hero/r/run/0.png` 是 `hero.r.run.0`，`src/art/scenery/cottage.glow.png` 是小屋的自发光遮罩
（夜里不盖夜色的像素，比如窗户、灯泡，尺寸要和本体一样）。用 Aseprite / Piskel 直接改、尺寸随便改，新加精灵就放一张新图。

`npm run dev` / `npm run build` / `npm test` 会先跑 `build/atlas.mjs`，把这些小图拼成一张图集（`src/assets/img/atlas.png` 和坐标表
`src/assets/js/pixel/atlas-map.ts`，都是生成文件、不进 git），访客只加载这一张图。打包时会检查：代码要用的精灵缺了、
角色同一动作的各帧尺寸不一致、自发光遮罩尺寸不对，都会直接报错，CI 也就停在部署之前。

注意：小屋（窗户光晕、门洞、门的点击区域、烟囱）、路灯灯泡、营火火焰的位置是写在 `src/assets/js/pixel/sim/scenery.ts`
里的像素坐标（`COTTAGE`、`LAMP_BULB`、`CAMPFIRE_FLAME`），挪动这几张图里的门窗灯火时要同步改这些数字。
主角、女孩只画朝右一套（`hero/r/...`、`girl/r/...`），朝左的由打包脚本水平翻转生成；哪一帧翻过去别扭，
就在 `l/` 下放一张手画的同名图，会优先用它。同一个角色的所有帧画布尺寸要一样、脚底贴最下面一行。
生日帽戴在哪儿写在 `src/assets/js/pixel/sim/hero.ts` 的 `HAT` 里（每帧一个偏移），改了主角的头部位置要跟着改。
地形、天空、粒子、烟花是按坐标实时算的，仍在代码里。

## 游戏板块（Steam 游戏库）

首页「游戏」板块分「最近在玩」和「MC 服务器」两页，完整游戏库在 `/games/`。数据由 `build/fetch-steam.mjs` 在 CI 里
每次构建前拉取（每天凌晨的定时构建会刷新），封面一起下载下来，访客页面不请求 Steam：

- 需要仓库 Secret `STEAM_API_KEY`（在 [Steam 开发者页面](https://steamcommunity.com/dev/apikey) 申请）。Steam ID 从
  `src/site.mjs` 的 `links.steam` 自定义地址解析，也可以用环境变量 `STEAM_ID` 直接给。
- Steam 隐私设置里「游戏详情」要公开，否则拿不到游戏库。
- 不想展示的游戏，把 appid 写进 `src/data/games-hide.yaml`（一个数字列表）。
- 拉取失败时沿用线上上一版的 `/games.json` 和封面；线上也没有时，板块只显示 MC 服务器，`/games/` 显示「暂时读不到」。

旧锚点 `/#server` 会跳到 `/#games`。

## 文章写法

front matter 与旧站相同：`title`、`date`、`categories`、`tags`、`description`、`math`、`pin`。`math: true` 时启用 `$...$` / `$$...$$` 公式；图片可以用 `![](src){:width="700px"}` 指定宽度。
