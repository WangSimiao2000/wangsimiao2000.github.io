#!/bin/bash
# 自动扫描 assets/img/gallery/ 下的图片，生成 _data/gallery.yml
# 支持 jpg, jpeg, png, gif, webp, avif

GALLERY_DIR="assets/img/gallery"
OUTPUT="_data/gallery.yml"

echo "# 此文件由 scripts/generate-gallery.sh 自动生成，请勿手动编辑" > "$OUTPUT"
echo "" >> "$OUTPUT"

# 按文件修改时间倒序排列（最新的在前）
find "$GALLERY_DIR" -maxdepth 1 -type f \( \
  -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \
  -o -iname "*.gif" -o -iname "*.webp" -o -iname "*.avif" \
\) -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2- | while read -r file; do
  filename=$(basename "$file")
  name="${filename%.*}"
  # 用文件名作为标题（把连字符和下划线替换为空格）
  title=$(echo "$name" | sed 's/[-_]/ /g')
  echo "- title: \"$title\"" >> "$OUTPUT"
  echo "  image: /$file" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
done

echo "Gallery generated: $(grep -c 'title:' "$OUTPUT") photos found."
