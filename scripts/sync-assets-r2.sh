#!/bin/bash
# 将博客静态资源同步到 Cloudflare R2 CDN bucket
# 同步目录：public/assets/posts/、public/assets/img/avatar/、public/assets/img/photo.jpg
# 同步完成后检测文件变更，调用 Cloudflare Purge API 清除对应 URL 的 CDN 缓存
#
# 必需环境变量：
#   R2_ACCOUNT_ID          - Cloudflare R2 账户 ID
#   R2_ACCESS_KEY_ID       - R2 访问密钥 ID
#   R2_SECRET_ACCESS_KEY   - R2 访问密钥
#   R2_BUCKET_NAME         - R2 bucket 名称
#   R2_ENDPOINT_URL        - R2 S3 兼容端点 URL
#
# 可选环境变量（用于自动清除 CDN 缓存）：
#   CF_ZONE_ID             - Cloudflare 域名的 Zone ID
#   CF_API_TOKEN           - 具有 Cache Purge 权限的 API Token
#   R2_CDN_PUBLIC_URL      - CDN 公共访问 URL（如 https://cdn.mickeymiao.cn）

set -euo pipefail

# --- 检查必需环境变量 ---
MISSING=0
for VAR in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_ENDPOINT_URL; do
  if [ -z "${!VAR:-}" ]; then
    echo "错误: 缺少必需环境变量 $VAR" >&2
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  exit 1
fi

# 配置 AWS CLI 凭证
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

CHANGED_FILES=()

# --- 同步文章配图 ---
echo "正在同步文章配图到 R2..."
if [ -d "public/assets/posts" ]; then
  SYNC_OUTPUT=$(aws s3 sync public/assets/posts/ "s3://${R2_BUCKET_NAME}/assets/posts/" \
    --endpoint-url "$R2_ENDPOINT_URL" \
    --size-only 2>&1) || true
  if [ -n "$SYNC_OUTPUT" ]; then
    echo "$SYNC_OUTPUT"
    while IFS= read -r line; do
      file=$(echo "$line" | grep -oP 'upload: public/\K\S+' || true)
      [ -n "$file" ] && CHANGED_FILES+=("$file")
    done <<< "$SYNC_OUTPUT"
  fi
else
  echo "目录 public/assets/posts 不存在，跳过"
fi

# --- 同步头像 ---
echo "正在同步头像到 R2..."
if [ -d "public/assets/img/avatar" ]; then
  SYNC_OUTPUT=$(aws s3 sync public/assets/img/avatar/ "s3://${R2_BUCKET_NAME}/assets/img/avatar/" \
    --endpoint-url "$R2_ENDPOINT_URL" \
    --size-only 2>&1) || true
  if [ -n "$SYNC_OUTPUT" ]; then
    echo "$SYNC_OUTPUT"
    while IFS= read -r line; do
      file=$(echo "$line" | grep -oP 'upload: public/\K\S+' || true)
      [ -n "$file" ] && CHANGED_FILES+=("$file")
    done <<< "$SYNC_OUTPUT"
  fi
else
  echo "目录 public/assets/img/avatar 不存在，跳过"
fi

# --- 同步个人照片 ---
echo "正在同步个人照片到 R2..."
if [ -f "public/assets/img/photo.jpg" ]; then
  SYNC_OUTPUT=$(aws s3 cp public/assets/img/photo.jpg "s3://${R2_BUCKET_NAME}/assets/img/photo.jpg" \
    --endpoint-url "$R2_ENDPOINT_URL" 2>&1) || true
  if echo "$SYNC_OUTPUT" | grep -q "upload:"; then
    echo "$SYNC_OUTPUT"
    CHANGED_FILES+=("assets/img/photo.jpg")
  fi
else
  echo "文件 public/assets/img/photo.jpg 不存在，跳过"
fi

echo "同步完成"

# --- 自动清除 CDN 缓存 ---
if [ ${#CHANGED_FILES[@]} -eq 0 ]; then
  echo "没有文件变更，无需清除缓存"
  exit 0
fi

echo "检测到 ${#CHANGED_FILES[@]} 个文件变更"

# 检查缓存清除所需的可选环境变量
if [ -z "${CF_ZONE_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ] || [ -z "${R2_CDN_PUBLIC_URL:-}" ]; then
  echo "未配置 CF_ZONE_ID / CF_API_TOKEN / R2_CDN_PUBLIC_URL，跳过缓存清除"
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
