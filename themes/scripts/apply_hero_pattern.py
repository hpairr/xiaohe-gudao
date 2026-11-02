# -*- coding: utf-8 -*-
"""六章专题页：首屏线稿图案 → 换成该章真正的设计图案（六主题图案）。

用法：
    python apply_hero_pattern.py

做两件事（都可重复跑，结果一致）：
  1 若页面里还有上一版的「图案」段落（<!-- pattern-section:start/end -->），整段撤掉；
  2 把首屏 <div class="motif-unit" data-motif-unit> 换成 <img class="hero-pattern">。

图片本体在 assets/theme-pattern/（由 ui/_pattern/build_web_lossless.py 生成）。
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
THEMES = os.path.dirname(HERE)

MARK_START = "<!-- pattern-section:start -->"
MARK_END = "<!-- pattern-section:end -->"
MOTIF_DIV = '<div class="motif-unit" data-motif-unit aria-hidden="true"></div>'

DATA = {
    "02-女书.html": dict(
        key="nushu",
        alt="女书图案：八角连弧外框，八瓣内填入女书的点、竖、斜、弧四种笔画，内芯为莲花，群青底、朱砂描边。",
    ),
    "03-蝴蝶歌.html": dict(
        key="butterfly",
        alt="蝴蝶歌图案：秋香黄底，方框内为回纹与折线格，两道弧线围出白色卷云与中心团花，四角与四边中点各一枚星形。",
    ),
    "04-长鼓舞.html": dict(
        key="drum",
        alt="长鼓舞图案：深红菱形格底，两只鼓身交叉成 X，中央方框内为鼓面的锯齿与星形纹，四角为蓝白台阶状色块。",
    ),
    "05-风雨桥.html": dict(
        key="bridge",
        alt="风雨桥图案：黛青底色，几重方框层层退深，中心为带重檐阁楼与三个圆孔的石拱侧影，四角为缠枝花形。",
    ),
    "06-盘王大歌.html": dict(
        key="panwang",
        alt="盘王大歌图案：青灰底色，四边为三角纹带与方框，中央是层叠菱形与回纹，四周一圈朱红星花，四角压朱红印纹。",
    ),
    "07-富川织锦.html": dict(
        key="brocade",
        alt="瑶族织锦图案：藕荷底色，四周菱格与三角星放射排开，中央白框挑花内红白四瓣相对，四边为十字带。",
    ),
}


def hero_img(key, alt):
    return "\n".join([
        f'<img class="hero-pattern" src="../assets/theme-pattern/{key}-1400.webp"',
        f'     srcset="../assets/theme-pattern/{key}-700.webp 700w, ../assets/theme-pattern/{key}-1400.webp 1400w"',
        '     sizes="(max-width: 900px) 58vw, 560px"',
        '     width="1400" height="1400" decoding="async"',
        f'     alt="{alt}">',
    ])


def drop_old_section(text):
    """撤掉上一版注入的「图案」段落，连同它与后一节之间的那一个换行。"""
    while MARK_START in text:
        i = text.index(MARK_START)
        j = text.index(MARK_END) + len(MARK_END)
        tail = text[j:]
        if tail.startswith("\n"):
            tail = tail[1:]
        text = text[:i] + tail
    return text


changed, skipped = [], []

for page, d in DATA.items():
    path = os.path.join(THEMES, page)
    with open(path, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    crlf = "\r\n" in text
    norm = text.replace("\r\n", "\n")
    before = norm

    norm = drop_old_section(norm)

    if "hero-pattern" in norm:
        skipped.append(page)
    elif MOTIF_DIV in norm:
        if norm.count(MOTIF_DIV) != 1:
            raise SystemExit(f"[失败] {page} 里首屏线稿出现 {norm.count(MOTIF_DIV)} 次")
        norm = norm.replace(MOTIF_DIV, hero_img(d["key"], d["alt"]).replace("\n", "\n      "), 1)
        changed.append(page)
    else:
        raise SystemExit(f"[失败] {page} 找不到首屏线稿，也没找到已经换好的 hero-pattern")

    if norm == before:
        continue

    if crlf:
        norm = norm.replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(norm)

print("首屏图案已写入：", "、".join(changed) if changed else "（无，已是最新）")
print("已跳过（原本就是图案）：", "、".join(skipped) if skipped else "（无）")
