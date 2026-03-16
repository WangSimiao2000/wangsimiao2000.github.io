#!/bin/bash
# 将博客静态资源同步到 Cloudflare R2 CDN bucket (blog-assets)
# 包括：文章配图、头像
# 需要环境变量：
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#   R2_CDN_BUCKET_NAME - CDN bucket 名称 (blog-assets)

set -euo pipefail

: "${R2_ACCOUNT_ID:?请设置 R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?请设置 R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?请设置 R2_SECRET_ACCESS_KEY}"
: "${R2_CDN_BUCKET_NAME:?请设置 R2_CDN_BUCKET_NAME}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "正在同步文章配图到 R2..."
aws s3 sync assets/posts/ "s3://${R2_CDN_BUCKET_NAME}/assets/posts/" \
  --endpoint-url "$ENDPOINT" \
  --size-only \
  --quiet

echo "正在同步头像到 R2..."
aws s3 sync assets/img/avatar/ "s3://${R2_CDN_BUCKET_NAME}/assets/img/avatar/" \
  --endpoint-url "$ENDPOINT" \
  --size-only \
  --quiet

echo "正在同步个人照片到 R2..."
aws s3 cp assets/img/photo.jpg "s3://${R2_CDN_BUCKET_NAME}/assets/img/photo.jpg" \
  --endpoint-url "$ENDPOINT" \
  --quiet

echo "同步完成"
