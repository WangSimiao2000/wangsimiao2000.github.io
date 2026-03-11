---
title: 使用 Cloudflare R2 作为博客相册图床
date: 2026-03-11 09:00:00 +0800
categories: [笔记, 博客]
tags: [博客, Cloudflare, R2, GitHub Actions, 图床]
---

最近给博客加了一个「光影集」相册页面, 照片存储在 Cloudflare R2 上, 每次推送代码时 GitHub Actions 会自动从 R2 拉取图片列表并生成相册数据, 整个流程无需手动维护. 这篇文章记录一下完整的配置过程.

## 为什么选择 Cloudflare R2

博客托管在 GitHub Pages 上, 如果把大量照片直接放进仓库, 会导致仓库体积膨胀, clone 和构建都会变慢. 常见的图床方案有很多, 但 Cloudflare R2 有几个比较吸引我的点:

- 免费额度足够个人使用: 每月 10 GB 存储, 1000 万次 Class A 操作, 1000 万次 Class B 操作
- 零出口流量费用: 不像 AWS S3 那样按流量收费
- S3 兼容 API: 可以直接用 AWS CLI 操作, 生态工具丰富
- 自带 CDN: Cloudflare 的全球网络本身就是 CDN

## 整体架构

整个相册的工作流程如下:

1. 手动将照片上传到 Cloudflare R2 Bucket
2. 推送代码到 GitHub 触发 Actions
3. Actions 中的脚本通过 S3 API 列出 R2 中的所有图片
4. 脚本生成 `_data/gallery.yml` 数据文件
5. Jekyll 构建时读取该数据文件, 渲染相册页面
6. 部署到 GitHub Pages

## 第一步: 创建 Cloudflare R2 Bucket

### 注册 Cloudflare 账号

如果还没有 Cloudflare 账号, 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up) 注册一个.

### 创建 Bucket

1. 登录 Cloudflare Dashboard, 在左侧导航栏找到 **R2 对象存储**
2. 点击 **创建存储桶**
3. 输入存储桶名称, 比如 `my-blog-gallery`
4. 选择一个离你较近的区域 (如果不确定就选自动)
5. 点击 **创建存储桶**

### 配置公开访问

相册图片需要能被公开访问, R2 提供两种方式:

**方式一: 使用 R2.dev 子域名 (简单快速)**

1. 进入刚创建的存储桶, 点击 **设置** 标签
2. 找到 **公开访问** 部分, 启用 **R2.dev 子域名**
3. 确认后会得到一个类似 `https://pub-xxxxxxxx.r2.dev` 的公开 URL

**方式二: 绑定自定义域名 (推荐)**

如果你有自己的域名并且已经托管在 Cloudflare 上:

1. 在存储桶的 **设置** 中, 找到 **自定义域名**
2. 点击 **连接域名**, 输入你想使用的子域名, 比如 `img.yourdomain.com`
3. Cloudflare 会自动配置 DNS 记录和 SSL 证书

自定义域名的好处是 URL 更简洁, 而且自带 Cloudflare CDN 缓存加速.

### 上传照片

你可以通过以下方式上传照片到 Bucket:

- Cloudflare Dashboard 网页端直接拖拽上传
- 使用 AWS CLI (因为 R2 兼容 S3 API)
- 使用 rclone 等第三方工具

使用 AWS CLI 上传示例:

```bash
# 配置 AWS CLI (使用 R2 的 Access Key)
aws configure --profile r2
# 输入 Access Key ID 和 Secret Access Key
# Region 填 auto
# Output format 填 json

# 上传单张照片
aws s3 cp photo.jpg s3://my-blog-gallery/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --profile r2

# 批量上传整个文件夹
aws s3 sync ./photos/ s3://my-blog-gallery/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --profile r2
```

## 第二步: 创建 R2 API Token

GitHub Actions 需要通过 API 访问 R2, 所以我们需要创建一个 API Token.

1. 在 Cloudflare Dashboard 左侧导航栏, 点击 **R2 对象存储**
2. 点击 **管理 R2 API 令牌**
3. 点击 **创建 API 令牌**
4. 配置令牌:
   - 令牌名称: 比如 `github-actions-gallery`
   - 权限: 选择 **对象读取** (只需要读取权限即可)
   - 指定存储桶: 选择你刚创建的存储桶 (最小权限原则)
5. 点击 **创建 API 令牌**
6. 记录下生成的 **Access Key ID** 和 **Secret Access Key** (只会显示一次)

同时记下你的 **Cloudflare Account ID**, 可以在 Dashboard 右侧边栏或 URL 中找到.

## 第三步: 配置 GitHub Secrets

在 GitHub 仓库中配置 Actions 所需的密钥:

1. 进入仓库的 **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**, 依次添加以下 Secrets:

| Secret 名称 | 值 |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token 的 Secret Access Key |
| `R2_BUCKET_NAME` | 存储桶名称, 如 `my-blog-gallery` |
| `R2_PUBLIC_URL` | 公开访问 URL, 如 `https://pub-xxx.r2.dev` |

## 第四步: 编写相册生成脚本

这个脚本是整个流程的核心, 它负责从 R2 获取图片列表并生成 Jekyll 数据文件.

创建 `scripts/generate-gallery-r2.sh`:

```bash
#!/bin/bash
# 从 Cloudflare R2 自动获取图片列表，生成 _data/gallery.yml

set -euo pipefail

# 从 _config.yml 读取默认值（如果环境变量未设置）
CONFIG_FILE="_config.yml"

R2_PUBLIC_URL="${R2_PUBLIC_URL:-$(grep -A5 'r2_gallery:' "$CONFIG_FILE" \
  | grep 'public_url:' | sed 's/.*public_url: *"\(.*\)"/\1/' | tr -d ' ')}"
R2_PREFIX="${R2_PREFIX:-$(grep -A5 'r2_gallery:' "$CONFIG_FILE" \
  | grep 'prefix:' | sed 's/.*prefix: *"\(.*\)"/\1/' | tr -d ' ')}"

# 必须的环境变量检查
: "${R2_ACCOUNT_ID:?请设置 R2_ACCOUNT_ID 环境变量}"
: "${R2_ACCESS_KEY_ID:?请设置 R2_ACCESS_KEY_ID 环境变量}"
: "${R2_SECRET_ACCESS_KEY:?请设置 R2_SECRET_ACCESS_KEY 环境变量}"
: "${R2_BUCKET_NAME:?请设置 R2_BUCKET_NAME 环境变量}"
: "${R2_PUBLIC_URL:?请设置 R2_PUBLIC_URL 环境变量或在 _config.yml 中配置}"

OUTPUT="_data/gallery.yml"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
SUPPORTED_EXT="jpg|jpeg|png|gif|webp|avif"

echo "# 此文件由 scripts/generate-gallery-r2.sh 自动生成，请勿手动编辑" > "$OUTPUT"
echo "# 图片来源: ${R2_PUBLIC_URL}/${R2_PREFIX}" >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "正在从 R2 获取图片列表..."

# 使用 AWS CLI（S3 兼容）列出对象
aws s3api list-objects-v2 \
  --bucket "$R2_BUCKET_NAME" \
  --prefix "$R2_PREFIX" \
  --endpoint-url "$ENDPOINT" \
  --query "Contents[].{Key: Key, LastModified: LastModified, Size: Size}" \
  --output json 2>/dev/null | \
python3 -c "
import json, sys, re

data = json.load(sys.stdin)
if not data:
    sys.exit(0)

ext_pattern = re.compile(r'\.($SUPPORTED_EXT)$', re.IGNORECASE)

photos = [item for item in data if ext_pattern.search(item['Key'])]
photos.sort(key=lambda x: x['LastModified'], reverse=True)

for photo in photos:
    key = photo['Key']
    filename = key.rsplit('/', 1)[-1]
    name = filename.rsplit('.', 1)[0]
    title = name.replace('-', ' ').replace('_', ' ')
    url = '${R2_PUBLIC_URL}/' + key

    print(f'- title: \"{title}\"')
    print(f'  image: \"{url}\"')
    print(f'  key: \"{key}\"')
    print()

print(f'# 共 {len(photos)} 张照片', file=sys.stderr)
" >> "$OUTPUT" 2>&1

COUNT=$(grep -c '^- title:' "$OUTPUT" 2>/dev/null || echo "0")
echo "Gallery 生成完成: 共 ${COUNT} 张照片"
```

脚本的工作逻辑:

1. 从环境变量或 `_config.yml` 读取 R2 配置
2. 通过 `aws s3api list-objects-v2` 列出 Bucket 中的所有对象 (R2 兼容 S3 API)
3. 用 Python 过滤出图片文件 (支持 jpg/png/gif/webp/avif), 按修改时间倒序排列
4. 从文件名自动生成标题, 拼接完整的公开 URL
5. 输出为 YAML 格式写入 `_data/gallery.yml`

生成的 `_data/gallery.yml` 格式如下:

```yaml
- title: "sunset over the sea"
  image: "https://pub-xxx.r2.dev/sunset-over-the-sea.jpg"
  key: "sunset-over-the-sea.jpg"

- title: "mountain view"
  image: "https://pub-xxx.r2.dev/mountain-view.png"
  key: "mountain-view.png"
```

## 第五步: 配置 Jekyll

在 `_config.yml` 中添加 R2 相册的配置:

```yaml
# Cloudflare R2 Gallery Settings
r2_gallery:
  public_url: "https://pub-xxxxxxxx.r2.dev"
  prefix: ""
```

- `public_url`: 你的 R2 公开访问域名, 不要以 `/` 结尾
- `prefix`: Bucket 中相册图片的前缀路径, 如果照片直接放在根目录就留空, 如果放在子目录比如 `gallery/` 就填 `gallery/`

## 第六步: 创建相册页面

创建 `_tabs/gallery.md` 作为相册的展示页面:

{% raw %}
```markdown
---
title: 光影集
icon: fas fa-camera-retro
order: 5
---

<style>
.g-item { margin-bottom: 12px; cursor: pointer; }
.g-item img { width: 100%; border-radius: 6px; display: block; }
.lb { display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.9); justify-content:center; align-items:center; }
.lb.on { display:flex; }
.lb img { max-width:92vw; max-height:90vh; border-radius:6px; }
.lb-x { position:absolute; top:12px; right:16px; background:none;
        border:none; color:#fff; font-size:2rem; cursor:pointer; }
</style>

<div class="lb" id="lb" onclick="closeLB()">
  <button class="lb-x" aria-label="关闭">&times;</button>
  <img id="lb-img" alt="" onclick="event.stopPropagation()" />
</div>

{% if site.data.gallery.size > 0 %}
  {% for photo in site.data.gallery %}
  <div class="g-item" onclick="openLB('{{ photo.image }}')">
    <img src="{{ photo.image }}" alt="照片" loading="lazy" />
  </div>
  {% endfor %}
{% else %}
<p class="text-muted text-center mt-5">📷 还没有照片</p>
{% endif %}

<script>
var lb=document.getElementById('lb'), lbImg=document.getElementById('lb-img');
function openLB(s){lbImg.src=s;lb.classList.add('on');document.body.style.overflow='hidden';}
function closeLB(){lb.classList.remove('on');document.body.style.overflow='';}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLB();});
</script>
```
{% endraw %}

这个页面的要点:

- 使用 Chirpy 主题的 `_tabs` 机制, 会自动出现在侧边栏导航中
- `order: 5` 控制在导航栏中的排列顺序
- 通过 Liquid 模板遍历 `site.data.gallery` 渲染图片列表
- 内置了一个简单的 Lightbox 效果, 点击图片可以全屏查看
- 支持 `Escape` 键关闭 Lightbox
- 图片使用 `loading="lazy"` 实现懒加载, 避免一次性加载所有图片

## 第七步: 配置 GitHub Actions

在 `.github/workflows/pages-deploy.yml` 中, 需要在 Jekyll 构建之前添加相册生成步骤:

```yaml
- name: Generate gallery from R2
  env:
    R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
    R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
    AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    AWS_DEFAULT_REGION: auto
  run: |
    pip install awscli --quiet
    bash scripts/generate-gallery-r2.sh
```

注意几个关键点:

- 这个步骤必须放在 `Build site` 之前, 因为 Jekyll 构建时需要读取生成的 `_data/gallery.yml`
- `AWS_ACCESS_KEY_ID` 和 `AWS_SECRET_ACCESS_KEY` 是给 AWS CLI 用的, 值和 R2 的 Key 相同
- `AWS_DEFAULT_REGION` 设为 `auto`, 这是 R2 的要求
- 先安装 `awscli`, 因为 GitHub Actions 的 Ubuntu runner 默认没有预装

完整的 workflow 执行顺序:

```
Checkout → Setup Pages → Setup Ruby → Generate gallery from R2 → Build site → Test site → Upload → Deploy
```

## 日常使用流程

配置完成后, 日常添加照片的流程非常简单:

1. 将照片上传到 R2 Bucket (通过 Dashboard 或 CLI)
2. 推送任意代码改动到 `main` 分支 (或手动触发 workflow)
3. GitHub Actions 自动拉取最新图片列表, 构建并部署

如果只是想更新相册而不改代码, 可以在 GitHub 仓库的 **Actions** 页面手动触发 workflow (因为配置了 `workflow_dispatch`).

