#!/usr/bin/env python3
"""一次性的图片瘦身工具（开发机上手动跑，不进构建、不进 CI）。

把 public/assets/posts/ 下的 PNG/JPG 转成 WebP：宽度超过 MAX_W 的等比缩小，有损 q=QUALITY；
只有转完确实更小才替换，并把 src/content/ 里引用旧文件名的地方改成新文件名，旧文件删除
（原图仍在 git 历史里）。用法：python3 scripts/optimize-images.py [--dry-run]

依赖 Pillow（开发机自带即可，网站本身不依赖它）。
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "public/assets/posts"
CONTENT = ROOT / "src/content"
MAX_W = 1600  # 阅读面板最宽约 800px，2 倍屏够用
QUALITY = 85


def encode(img: Image.Image) -> bytes:
    if img.width > MAX_W:
        img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info or img.mode in ("LA", "PA") else "RGB")
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()


def main(dry: bool) -> None:
    renamed: dict[str, str] = {}
    before = after = 0
    for src in sorted(p for p in POSTS.rglob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg")):
        size = src.stat().st_size
        with Image.open(src) as im:
            data = encode(im)
        before += size
        if len(data) >= size:
            after += size
            print(f"keep   {src.relative_to(ROOT)} ({size // 1024}KB)")
            continue
        dst = src.with_suffix(".webp")
        if dst.exists():
            raise SystemExit(f"目标已存在：{dst}")
        after += len(data)
        renamed["/" + str(src.relative_to(ROOT / "public"))] = "/" + str(dst.relative_to(ROOT / "public"))
        print(f"webp   {src.relative_to(ROOT)} {size // 1024}KB -> {len(data) // 1024}KB")
        if not dry:
            dst.write_bytes(data)
            src.unlink()
    refs = 0
    for md in CONTENT.rglob("*.md"):
        text = md.read_text(encoding="utf-8")
        new = text
        for old, nu in renamed.items():
            new = new.replace(old, nu)
        if new != text:
            refs += sum(text.count(o) for o in renamed)
            if not dry:
                md.write_text(new, encoding="utf-8")
    print(f"\n{len(renamed)} 张转成 WebP，{refs} 处引用已改；{before / 1048576:.1f}MB -> {after / 1048576:.1f}MB")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
