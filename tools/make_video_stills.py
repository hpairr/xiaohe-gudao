#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把本地视频截成静帧（站点不托管视频，只放图）
=================================================

两个用途：
  dance   长鼓舞教学块：按 04-长鼓舞.html 里 21 个动作的 data-start 逐帧截取，
          输出 themes/assets/dance-frames/01.jpg … 21.jpg
  covers  声音数据库封面：video/{id}.mp4 每条截一张，
          输出 assets/img/video-covers/{id}.jpg

用法：
  python tools/make_video_stills.py dance
  python tools/make_video_stills.py covers
  python tools/make_video_stills.py all

为什么用脚本而不是手动截图：动作时间点写在 HTML 里，改了时间点重跑一次即可，
不会出现「页面写 00:19、图却是 00:15」这种对不上的情况。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEMES = ROOT / "themes"
VIDEO = ROOT / "video"

DANCE_HTML = THEMES / "04-长鼓舞.html"
DANCE_VIDEO = VIDEO / "04-changgu-basics.mp4"
DANCE_OUT = THEMES / "assets" / "dance-frames"

COVER_OUT = ROOT / "assets" / "img" / "video-covers"
COVER_IDS = ["so1", "so2", "so4", "so5", "so7", "so8", "so9", "so10", "so11",
             "so12", "so13", "so14", "so15a", "so15b", "so15c", "so16",
             "so18", "so19", "so21"]

# 自动挑点会落在字幕/空镜上的，手动钉死秒数（看过分镜后定的）
COVER_FIXED = {"so1": 232.0, "so9": 301.0, "so15a": 26.0, "so16": 79.0}

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def frame(src: Path, seconds: float, dst: Path, width: int, quality: int = 4) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-v", "error", "-ss", f"{seconds:.2f}", "-i", str(src),
         "-frames:v", "1", "-vf", f"scale={width}:-2", "-q:v", str(quality),
         "-y", str(dst)])


# ---------------------------------------------------------------- 长鼓舞
def do_dance() -> None:
    html = DANCE_HTML.read_text(encoding="utf-8")
    rows = re.findall(
        r'<button class="bs-row"[^>]*data-start="(\d+)"[^>]*data-group="(\d+)"[^>]*>'
        r'\s*<span class="bs-row-time">[^<]*</span><span class="bs-row-name">([^<]+)</span>',
        html)
    if len(rows) != 21:
        sys.exit(f"★ 04-长鼓舞.html 里应有 21 个动作，解析到 {len(rows)} 个")

    print(f"教学片 {DANCE_VIDEO.name} → {DANCE_OUT.relative_to(ROOT)}/")
    total = 0
    for i, (start, _group, name) in enumerate(rows, 1):
        dst = DANCE_OUT / f"{i:02d}.jpg"
        # +1.0 s：避开上一动作的收势，让画面落在本动作的定式上
        frame(DANCE_VIDEO, int(start) + 1.0, dst, 1280)
        kb = dst.stat().st_size / 1024
        total += kb
        print(f"  {i:02d}  t={int(start)+1:>3}s  {name.strip():<6s}  {kb:5.0f} KB")
    print(f"  共 {len(rows)} 张，{total/1024:.2f} MB\n")


# ---------------------------------------------------------------- 数据库封面
def _score(im) -> tuple[float, float]:
    from PIL import ImageStat
    st = ImageStat.Stat(im.convert("L"))
    return st.mean[0], st.stddev[0]


def pick_moment(src: Path, dur: float) -> float:
    """在 10%–80% 之间试 8 个点，挑一张「不黑、有细节」的。

    判据：平均亮度 45–210，取反差（标准差）最大的；都不合格就取最亮的。
    """
    from PIL import Image
    cands = []
    for frac in (0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80):
        t = max(1.0, dur * frac)
        tmp = COVER_OUT / f"_try_{src.stem}_{int(frac * 100)}.jpg"
        frame(src, t, tmp, 640, quality=5)
        try:
            im = Image.open(tmp)
            mean, sd = _score(im)
        finally:
            tmp.unlink(missing_ok=True)
        cands.append((t, mean, sd))

    good = [c for c in cands if 45 <= c[1] <= 210]
    pool = good or cands
    best = max(pool, key=lambda c: c[2] if good else c[1])
    return best[0]


def do_covers() -> None:
    print(f"数据库封面 → {COVER_OUT.relative_to(ROOT)}/")
    total = 0
    for cid in COVER_IDS:
        src = VIDEO / f"{cid}.mp4"
        if not src.is_file():
            print(f"  ✗ 缺少 {src.name}，跳过")
            continue
        dur = ffprobe_duration(src)
        t = COVER_FIXED.get(cid) or pick_moment(src, dur)
        dst = COVER_OUT / f"{cid}.jpg"
        frame(src, t, dst, 960, quality=4)
        kb = dst.stat().st_size / 1024
        total += kb
        print(f"  {cid:7s} {dur:6.1f}s  选点 {t:6.1f}s  {kb:5.0f} KB")
    print(f"  共 {len(COVER_IDS)} 张，{total/1024:.2f} MB\n")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("dance", "all"):
        do_dance()
    if what in ("covers", "all"):
        do_covers()
