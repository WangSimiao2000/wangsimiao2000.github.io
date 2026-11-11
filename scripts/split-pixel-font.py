#!/usr/bin/env python3
"""一次性的字体切分工具（开发机上手动跑，不进构建、不进 CI）。

全站用的像素字体是方舟像素 12px 等宽（Ark Pixel Font，OFL 协议，https://github.com/TakWolf/ark-pixel-font）。
完整的简体中文版有两万多个字、约 790KB，整个下载太重。这里按「常用程度」切成几十个小文件，每块配一条
@font-face + unicode-range，浏览器只下载页面上真正用到的字所在的那几块（大多数页面是 base + 常用字那几块）：

  0..    其余汉字和别的文字（按码位，每 CHUNK 个字一块）
  ..     GB2312 二级字、一级常用字（3755 个）各自按码位切块
  最后   拉丁字母、标点、全角符号、箭头等符号（几乎每页都要）

大多数页面只下载符号那块和一级常用字那几块。以后写新文章用到生僻字，也会自动下载对应那块，不用重跑。

用法：
  python3 scripts/split-pixel-font.py <ark-pixel-12px-monospaced-zh_hans.ttf.woff2> <版本号，如 2026.11.10>
输出：
  public/assets/fonts/ark-pixel-12px-mono-<版本>/<n>.woff2   字体分块（不进资源哈希目录：地址稳定，部署后缓存还在）
  public/assets/fonts/ark-pixel-12px-mono-<版本>/OFL.txt      许可证（需另外从发布包里拷过来）
  src/assets/css/pixel-font.css                               所有 @font-face（layout.mjs 在 base.css 前引用）
换字体版本时重跑一次，删掉旧版本目录。

依赖 fontTools 和 brotli（pip install fonttools brotli；网站本身不依赖它们）。
"""
from __future__ import annotations

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FAMILY = 'Ark Pixel'
CHUNK = 800  # 每块多少个字：12px 点阵字每个字约 30 字节，一块 20-30KB


def gb2312(level: int) -> list[int]:
    """GB2312 一级（16-55 区）或二级（56-87 区）汉字，按 GB 码顺序"""
    rows = range(0xB0, 0xD8) if level == 1 else range(0xD8, 0xF8)
    out = []
    for hi in rows:
        for lo in range(0xA1, 0xFF):
            try:
                out.append(ord(bytes([hi, lo]).decode('gb2312')))
            except UnicodeDecodeError:
                pass
    return out


def is_base(c: int) -> bool:
    return (
        c < 0x0300  # 拉丁字母
        or 0x2000 <= c < 0x2C00  # 通用标点、箭头、数学符号、方框线等
        or 0x3000 <= c < 0x3040  # 中文标点
        or 0xFF00 <= c < 0xFFF0  # 全角
    )


def ranges(cps: list[int]) -> str:
    """连续的码位合并成 U+a-b，写成 unicode-range"""
    cps = sorted(cps)
    out = []
    start = prev = cps[0]
    for c in cps[1:] + [None]:
        if c is not None and c == prev + 1:
            prev = c
            continue
        out.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
        if c is not None:
            start = prev = c
    return ','.join(out)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, version = Path(sys.argv[1]), sys.argv[2]
    font = TTFont(src)
    have = set(font.getBestCmap())

    base = sorted(c for c in have if is_base(c))
    seen = set(base)

    def pick(cps: list[int]) -> list[int]:
        out = sorted(c for c in cps if c in have and c not in seen)
        seen.update(out)
        return out

    def split(cps: list[int]) -> list[list[int]]:
        n = max(1, round(len(cps) / CHUNK))
        size = -(-len(cps) // n)
        return [cps[i : i + size] for i in range(0, len(cps), size)]

    # 声明顺序 = 优先级从低到高：生僻字 -> 二级字 -> 一级字 -> 符号。
    # 每块的 unicode-range 只写首尾一段（U+a-b），中间夹着别的块的字也没关系：几个 @font-face 的范围重叠时，
    # 浏览器先查最后声明的那条，下载后发现没有这个字再往前找（CSS Fonts 4 §4.5）。常用字都在后声明的块里，
    # 所以不会为了常用字去下生僻字的块；这样 CSS 只有几十条短规则，不用把上万个码位一一列出来
    level1 = pick(gb2312(1))
    level2 = pick(gb2312(2))
    rest = pick(sorted(have))
    chunks = split(rest) + split(level2) + split(level1) + [base]

    out_dir = ROOT / 'public/assets/fonts' / f'ark-pixel-12px-mono-{version}'
    out_dir.mkdir(parents=True, exist_ok=True)
    url = f'/assets/fonts/{out_dir.name}'
    css = [
        f'/* 由 scripts/split-pixel-font.py 生成，不要手改。方舟像素 12px 等宽 {version}（OFL，见 {url}/OFL.txt） */',
    ]
    total = 0
    for i, cps in enumerate(chunks):
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = False
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=cps)
        f = TTFont(src)
        sub.subset(f)
        path = out_dir / f'{i}.woff2'
        f.flavor = 'woff2'
        f.save(path)
        total += path.stat().st_size
        span = ranges(cps) if cps is base else f'U+{cps[0]:X}-{cps[-1]:X}'
        css.append(
            f"@font-face{{font-family:'{FAMILY}';src:url({url}/{i}.woff2) format('woff2');"
            f'font-display:swap;unicode-range:{span}}}'
        )
    (ROOT / 'src/assets/css/pixel-font.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
    print(f'{len(chunks)} 块，共 {total / 1024:.0f} KB -> {out_dir.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
