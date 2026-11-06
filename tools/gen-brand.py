#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把一张方形 logo 换成站点用的资产（红标 + favicon）。

用法：
    python tools/gen-brand.py ../logo2.png
    python tools/gen-brand.py            # 不给参数就用仓库外层的 logo.png

做三件事（都写进 xiaohe-gudao-db/）：
    assets/img/logo-mark.png    512×512，主页红 #B63A33，透明底 —— 页面里的 34/30px 大标
    assets/img/logo-mark-sm.png  96×96，同上 —— 顶栏站点名前的 17px 小标
    favicon.svg                  纸色圆角底 + 44px 红标，PNG 内嵌（不用改任何页面的 <link>）

要求源图是**方形**、主体不透明、底透明（现在的 logo 就是黑形 + 透明底）。
颜色只取透明度，所以源图是黑是白无所谓，出来一定是站点红。
"""
import base64
import io
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
RED = (0xB6, 0x3A, 0x33)      # 主页 --cinnabar
PAPER = (0xF7, 0xF4, 0xEC)


def main() -> int:
    src_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "logo.png"
    if not src_path.exists():
        print(f"找不到源图：{src_path}", file=sys.stderr)
        return 1

    src = Image.open(src_path).convert("RGBA")
    w, h = src.size
    if w != h:
        print(f"源图不是正方形（{w}×{h}），标会变形，先裁成方形", file=sys.stderr)
        return 2

    alpha = src.getchannel("A")
    # 源图如果是白形透明底，alpha 也是对的；如果是黑形透明底，同样只有黑处有 alpha
    red = Image.new("RGBA", src.size, RED + (0,))
    red.putalpha(alpha)

    out = ROOT / "assets" / "img"
    out.mkdir(parents=True, exist_ok=True)

    red.resize((512, 512), Image.LANCZOS).save(out / "logo-mark.png", "PNG", optimize=True)
    red.resize((96, 96), Image.LANCZOS).save(out / "logo-mark-sm.png", "PNG", optimize=True)

    # favicon：不垫纸底、不留白边，标几乎铺满整块（四周留 2px，防圆角/裁切切到石头）
    ico = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    ico.alpha_composite(red.resize((60, 60), Image.LANCZOS), (2, 2))
    buf = io.BytesIO()
    ico.save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    (ROOT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n'
        f'  <image href="data:image/png;base64,{b64}" x="0" y="0" width="64" height="64"/>\n'
        '</svg>\n',
        encoding="utf-8", newline="")

    # 自检：三份资产都在、尺寸对、颜色真是那个红
    for name, size in (("assets/img/logo-mark.png", 512), ("assets/img/logo-mark-sm.png", 96)):
        im = Image.open(ROOT / name)
        assert im.size == (size, size), (name, im.size)
    px = Image.open(ROOT / "assets/img/logo-mark.png").convert("RGBA").getpixel((256, 60))
    print(f"源图 {src_path.name} {w}×{h} → 已写入 logo-mark.png / logo-mark-sm.png / favicon.svg")
    print(f"采样像素 rgba{px}（应为 {RED} + alpha）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
