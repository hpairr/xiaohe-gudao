#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 assets/theme-pattern/layers/manifest.json 写进 motifs.html 的内嵌图层表。

为什么要有这一步：
  页面在 GitHub Pages 上是 http，fetch('manifest.json') 没问题；
  但本地双击打开是 file://，fetch 会被拦。所以图层清单一律内嵌在页面里，
  由本脚本从 manifest.json 单向生成 —— 单一来源仍然是 manifest.json。

改了 manifest.json（增删图层、改层名）之后跑：
    python tools/gen-motif-layers.py

反查：motifs.html 在 http 下会再 fetch 一次 manifest.json 与内嵌表比对，
不一致就在控制台报警，并在 ?selftest=1 的 layerDataMatchesManifest 里判失败。
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "theme-pattern" / "layers" / "manifest.json"
PAGE = ROOT / "motifs.html"
OPEN_TAG = '<script type="application/json" id="layer-data">'

def main() -> int:
    if not MANIFEST.exists():
        print(f"找不到 {MANIFEST}", file=sys.stderr)
        return 1
    if not PAGE.exists():
        print(f"找不到 {PAGE}", file=sys.stderr)
        return 1

    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    html = PAGE.read_text(encoding="utf-8")
    if OPEN_TAG not in html:
        print("页面里没有内嵌图层表的锚点，先手动加一行再跑：", file=sys.stderr)
        print(OPEN_TAG + "…</script>", file=sys.stderr)
        return 2

    pattern = re.compile(re.escape(OPEN_TAG) + r".*?</script>", re.S)
    new_html, n = pattern.subn(OPEN_TAG + compact + "</script>", html, count=1)
    if n != 1:
        print("替换失败：没找到完整的内嵌块", file=sys.stderr)
        return 3

    if new_html == html:
        print("motifs.html：内嵌表已经是最新的，没改动。")
    else:
        PAGE.write_text(new_html, encoding="utf-8", newline="")
        print(f"已写入 motifs.html：{len(compact)} 字节，{len(data)} 个主题，"
              f"{sum(len(v) for v in data.values())} 层。")

    for key, layers in data.items():
        names = " / ".join(x["name"] for x in layers)
        print(f"  {key}: {len(layers)} 层 — {names}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
