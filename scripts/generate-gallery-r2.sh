#!/bin/bash
# 从 Cloudflare R2 自动获取图片列表，生成 _data/gallery.yml
# 需要配置以下环境变量（可在 .env 或 CI 中设置）：
#   R2_ACCOUNT_ID    - Cloudflare 账户 ID
#   R2_ACCESS_KEY_ID - R2 API Token 的 Access Key ID
#   R2_SECRET_ACCESS_KEY - R2 API Token 的 Secret Access Key
#   R2_BUCKET_NAME   - R2 Bucket 名称
#   R2_PUBLIC_URL    - R2 公开访问域名（如 https://img.example.com）
#   R2_PREFIX        - 图片前缀路径（如 gallery/），可选

set -euo pipefail

# 从 _config.yml 读取默认值（如果环境变量未设置）
CONFIG_FILE="_config.yml"

R2_PUBLIC_URL="${R2_PUBLIC_URL:-$(grep -A5 'r2_gallery:' "$CONFIG_FILE" | grep 'public_url:' | sed 's/.*public_url: *"\(.*\)"/\1/' | tr -d ' ')}"
R2_PREFIX="${R2_PREFIX:-$(grep -A5 'r2_gallery:' "$CONFIG_FILE" | grep 'prefix:' | sed 's/.*prefix: *"\(.*\)"/\1/' | tr -d ' ')}"

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
echo "  Endpoint: ${ENDPOINT}"
echo "  Bucket: ${R2_BUCKET_NAME}"
echo "  Prefix: ${R2_PREFIX}"

# 使用 AWS CLI（S3 兼容）列出对象
COUNT=0
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

# 支持的图片扩展名
ext_pattern = re.compile(r'\.($SUPPORTED_EXT)$', re.IGNORECASE)

# 过滤图片文件并按修改时间倒序
photos = [item for item in data if ext_pattern.search(item['Key'])]
photos.sort(key=lambda x: x['LastModified'], reverse=True)

for photo in photos:
    key = photo['Key']
    # 从文件名生成标题
    filename = key.rsplit('/', 1)[-1]
    name = filename.rsplit('.', 1)[0]
    title = name.replace('-', ' ').replace('_', ' ')
    
    # 生成完整 URL
    url = '${R2_PUBLIC_URL}/' + key
    
    print(f'- title: \"{title}\"')
    print(f'  image: \"{url}\"')
    print(f'  key: \"{key}\"')
    print()

print(f'# 共 {len(photos)} 张照片', file=sys.stderr)
" >> "$OUTPUT" 2>&1

# 统计数量
COUNT=$(grep -c '^- title:' "$OUTPUT" 2>/dev/null || echo "0")
echo "Gallery 生成完成: 共 ${COUNT} 张照片"
