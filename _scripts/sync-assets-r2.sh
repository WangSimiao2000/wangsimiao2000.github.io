#!/bin/bash
# 将博客静态资源同步到 Cloudflare R2 CDN bucket (blog-assets)
# 包括：文章配图、头像
# 需要环境变量：
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#   R2_CDN_BUCKET_NAME - CDN bucket 名称 (blog-assets)
# 可选环境变量（用于自动清除 CDN 缓存）：
#   CF_ZONE_ID - Cloudflare 域名的 Zone ID
#   CF_API_TOKEN - 具有 Cache Purge 权限的 API Token

set -euo pipefail

: "${R2_ACCOUNT_ID:?请设置 R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?请设置 R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?请设置 R2_SECRET_ACCESS_KEY}"
: "${R2_CDN_BUCKET_NAME:?请设置 R2_CDN_BUCKET_NAME}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
CHANGED_FILES=()

echo "正在同步文章配图到 R2..."
# 捕获同步输出以检测变更文件
SYNC_OUTPUT=$(aws s3 sync assets/posts/ "s3://${R2_CDN_BUCKET_NAME}/assets/posts/" \
  --endpoint-url "$ENDPOINT" \
  --size-only 2>&1) || true
if [ -n "$SYNC_OUTPUT" ]; then
  echo "$SYNC_OUTPUT"
  while IFS= read -r line; do
    # 从 upload: assets/posts/xxx 中提取路径
    file=$(echo "$line" | grep -oP 'upload: \K\S+' || true)
    [ -n "$file" ] && CHANGED_FILES+=("$file")
  done <<< "$SYNC_OUTPUT"
fi

echo "正在同步头像到 R2..."
SYNC_OUTPUT=$(aws s3 sync assets/img/avatar/ "s3://${R2_CDN_BUCKET_NAME}/assets/img/avatar/" \
  --endpoint-url "$ENDPOINT" \
  --size-only 2>&1) || true
if [ -n "$SYNC_OUTPUT" ]; then
  echo "$SYNC_OUTPUT"
  while IFS= read -r line; do
    file=$(echo "$line" | grep -oP 'upload: \K\S+' || true)
    [ -n "$file" ] && CHANGED_FILES+=("$file")
  done <<< "$SYNC_OUTPUT"
fi

echo "正在同步个人照片到 R2..."
SYNC_OUTPUT=$(aws s3 cp assets/img/photo.jpg "s3://${R2_CDN_BUCKET_NAME}/assets/img/photo.jpg" \
  --endpoint-url "$ENDPOINT" 2>&1) || true
if echo "$SYNC_OUTPUT" | grep -q "upload:"; then
  echo "$SYNC_OUTPUT"
  CHANGED_FILES+=("assets/img/photo.jpg")
fi

echo "同步完成"

# --- 自动清除 CDN 缓存 ---
if [ ${#CHANGED_FILES[@]} -eq 0 ]; then
  echo "没有文件变更，无需清除缓存"
  exit 0
fi

echo "检测到 ${#CHANGED_FILES[@]} 个文件变更"

# 检查缓存清除所需的环境变量
if [ -z "${CF_ZONE_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ] || [ -z "${R2_CDN_PUBLIC_URL:-}" ]; then
  echo "未配置 CF_ZONE_ID / CF_API_TOKEN / R2_CDN_PUBLIC_URL，跳过缓存清除"
  echo "如需自动清除缓存，请在 GitHub Secrets 中配置这三个变量"
  exit 0
fi

# 构建需要清除缓存的 URL 列表
PURGE_URLS=()
for file in "${CHANGED_FILES[@]}"; do
  PURGE_URLS+=("${R2_CDN_PUBLIC_URL}/${file}")
done

echo "正在清除 CDN 缓存..."
printf '  %s\n' "${PURGE_URLS[@]}"

# Cloudflare Purge API 每次最多 30 个 URL，分批处理
BATCH_SIZE=30
for ((i=0; i<${#PURGE_URLS[@]}; i+=BATCH_SIZE)); do
  BATCH=("${PURGE_URLS[@]:i:BATCH_SIZE}")
  # 构建 JSON 数组
  JSON_URLS=$(printf '%s\n' "${BATCH[@]}" | jq -R . | jq -s .)

  RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"files\": ${JSON_URLS}}")

  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "缓存清除成功（本批 ${#BATCH[@]} 个 URL）"
  else
    echo "缓存清除失败："
    echo "$RESPONSE" | jq .
  fi
done

echo "CDN 缓存清除完成"
