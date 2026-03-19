#!/bin/bash
# 从 Cloudflare R2 bucket 的 gallery/ 前缀列出图片，生成 data/gallery.yml
# 支持格式：jpg、jpeg、png、gif、webp、avif
# 按修改时间倒序排列，从文件名自动生成标题
#
# 必需环境变量：
#   R2_ACCESS_KEY_ID       - R2 访问密钥 ID
#   R2_SECRET_ACCESS_KEY   - R2 访问密钥
#   R2_BUCKET_NAME         - R2 bucket 名称
#   R2_ENDPOINT_URL        - R2 S3 兼容端点 URL
#
# 可选环境变量：
#   R2_CDN_PUBLIC_URL      - CDN 公共访问 URL（默认: https://cdn.mickeymiao.cn）

set -euo pipefail

# --- 检查必需环境变量 ---
MISSING=0
for VAR in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_ENDPOINT_URL; do
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

# CDN 公共 URL，默认使用 siteConfig.r2Gallery.publicUrl
CDN_URL="${R2_CDN_PUBLIC_URL:-https://cdn.mickeymiao.cn}"

PREFIX="gallery/"

echo "正在从 R2 列出 ${PREFIX} 下的图片..."

# 列出 gallery/ 前缀下的所有对象，输出 JSON
OBJECTS=$(aws s3api list-objects-v2 \
  --bucket "$R2_BUCKET_NAME" \
  --prefix "$PREFIX" \
  --endpoint-url "$R2_ENDPOINT_URL" \
  --output json 2>&1) || {
  echo "错误: 无法列出 R2 对象" >&2
  echo "$OBJECTS" >&2
  exit 1
}

# 检查是否有内容
CONTENTS=$(echo "$OBJECTS" | jq -r '.Contents // empty')
if [ -z "$CONTENTS" ]; then
  echo "gallery/ 前缀下没有找到任何对象"
  # 写入空的 gallery.yml
  cat > data/gallery.yml << 'EOF'
# 此文件由 scripts/generate-gallery-r2.sh 自动生成，请勿手动编辑
# 图片来源: R2 gallery/ 前缀
EOF
  echo "已生成空的 data/gallery.yml"
  exit 0
fi

# 筛选图片文件（jpg、jpeg、png、gif、webp、avif），按 LastModified 倒序排列
IMAGES=$(echo "$OBJECTS" | jq -r '
  [.Contents[]
   | select(.Key | test("\\.(jpg|jpeg|png|gif|webp|avif)$"; "i"))
   | select(.Key != "gallery/")]
  | sort_by(.LastModified) | reverse
  | .[]
  | [.Key, .LastModified] | @tsv
')

if [ -z "$IMAGES" ]; then
  echo "gallery/ 前缀下没有找到图片文件"
  cat > data/gallery.yml << 'EOF'
# 此文件由 scripts/generate-gallery-r2.sh 自动生成，请勿手动编辑
# 图片来源: R2 gallery/ 前缀
EOF
  echo "已生成空的 data/gallery.yml"
  exit 0
fi

# 生成 YAML 文件
OUTPUT_FILE="data/gallery.yml"

{
  echo "# 此文件由 scripts/generate-gallery-r2.sh 自动生成，请勿手动编辑"
  echo "# 图片来源: ${CDN_URL}/${PREFIX}"
  echo ""

  while IFS=$'\t' read -r key _modified; do
    # 从 key 中提取文件名（不含路径和扩展名）
    filename=$(basename "$key")
    name_no_ext="${filename%.*}"

    # 生成标题：将 - 和 _ 替换为空格
    title=$(echo "$name_no_ext" | sed 's/[-_]/ /g')

    echo "- title: \"${title}\""
    echo "  image: \"${CDN_URL}/${key}\""
    echo "  key: \"${key}\""
    echo ""
  done <<< "$IMAGES"
} > "$OUTPUT_FILE"

# 统计图片数量
COUNT=$(echo "$IMAGES" | wc -l)
echo "已生成 ${OUTPUT_FILE}，共 ${COUNT} 张图片"
