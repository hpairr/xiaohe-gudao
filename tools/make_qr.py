#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
七枚固定入口 · 二维码与跳转页生成器
=====================================

单一数据源：qr/links.json
产物：
  go/<slug>/index.html     固定短链跳转页（二维码指向这里，永不改名）
  go/index.html            短链目录页
  qr/codes/<id>.svg        矢量二维码（印刷／放大用）
  qr/codes/<id>-print.png  位图二维码（300dpi 以上，PPT／Word 用）

用法：
  python tools/make_qr.py            # 生成 + 自检
  python tools/make_qr.py --check    # 只自检，不写文件

自检内容（任一失败即退出码 1）：
  1. links.json 结构合法（slug 唯一且为 ASCII、颜色合法、url ≤ 60 字符）
  2. target 文件真实存在
  3. 每个 PNG 能被 zxing 解出、内容与预期 URL 完全一致
  4. 每个 PNG 四周留白（quiet zone）纯白
  5. 每个 SVG 是合法 XML
  6. qr/index.html 里出现的入口地址／图片路径与 links.json 一致（防手打漂移）
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote

try:
    import segno
except ImportError:  # pragma: no cover
    sys.exit("缺少 segno：python -m pip install segno")

# Windows 控制台默认 GBK，✓ 之类字符会炸；统一按 UTF-8 输出
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]          # xiaohe-gudao-db/
QR_DIR = ROOT / "qr"
CODES = QR_DIR / "codes"
GO = ROOT / "go"
DATA = QR_DIR / "links.json"
PAGE = QR_DIR / "index.html"

INK = "#141A16"
PAPER = "#FFFFFF"
BORDER = 4          # quiet zone，单位：模块。低于 4 扫码率会掉。
ECC = "q"           # 25% 纠错，印刷品推荐 M~Q
PNG_SCALE = 40      # 37+8 模块 × 40 ≈ 1800px，印 30mm 约 1500dpi

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,23}$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


# ---------------------------------------------------------------- 数据
def load() -> dict:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    entries = data["entries"]
    if len(entries) != 7:
        fail(f"入口应为 7 个，links.json 里是 {len(entries)} 个")
    site = data["site"].rstrip("/")
    if not site.startswith("https://"):
        fail(f"site 必须是 https 绝对地址：{site}")

    seen_slug, seen_id = set(), set()
    for e in entries:
        for key in ("id", "no", "title", "en", "meta", "char", "color"):
            if not str(e.get(key, "")).strip():
                fail(f"条目缺字段 {key}: {e}")
        if not HEX_RE.match(e["color"]):
            fail(f"颜色不合法：{e['id']} → {e['color']}")
        if e["id"] in seen_id:
            fail(f"id 重复：{e['id']}")
        seen_id.add(e["id"])

        slug = e.get("slug")
        if slug is None:                      # 首页：直接落在站点根
            e["url"] = site + "/"
        else:
            if not SLUG_RE.match(slug):
                fail(f"slug 只能是小写字母/数字/连字符：{slug!r}")
            if slug in seen_slug:
                fail(f"slug 重复：{slug}")
            seen_slug.add(slug)
            e["url"] = f"{site}/go/{slug}/"

        if len(e["url"]) > 60:
            fail(f"地址过长（{len(e['url'])} 字符），二维码会变密：{e['url']}")

        target = ROOT / e["target"]
        if not target.is_file():
            fail(f"target 不存在：{e['target']}（来自 {e['id']}）")
        e["_target_file"] = target

    if not any(e.get("slug") is None for e in entries):
        fail("缺少首页入口（slug: null）")
    data["site"] = site
    return data


def fail(msg: str) -> None:
    print("✗ " + msg, file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------- 二维码
def qr_svg(url: str, out: Path, label: str) -> None:
    segno.make(url, error=ECC).save(
        out, kind="svg", scale=1, unit="mm", border=BORDER,
        dark=INK, light=PAPER, xmldecl=True, nl=True,
        title=f"二维码 · {label}", desc=url,
    )


def qr_png(url: str, out: Path) -> None:
    segno.make(url, error=ECC).save(
        out, kind="png", scale=PNG_SCALE, border=BORDER,
        dark=INK, light=PAPER, compresslevel=9,
    )


# ---------------------------------------------------------------- 跳转页
STUB = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>正在前往 {title} · 潇贺古道有声文化数据库</title>
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url={href}">
<link rel="icon" type="image/svg+xml" href="../../favicon.svg">
<style>
:root{{--paper:#F2EDE2;--ink:#141A16;--soft:#4C574F;--line:rgba(20,26,22,.16);
  --serif:'Noto Serif SC','Source Han Serif SC','Songti SC',STSong,serif;
  --sans:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif}}
*{{box-sizing:border-box}}
html,body{{margin:0;height:100%}}
body{{background:var(--paper);color:var(--ink);font-family:var(--sans);
  display:grid;place-items:center;padding:24px}}
main{{max-width:34em}}
p{{margin:0}}
.note{{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--soft)}}
h1{{font-family:var(--serif);font-weight:700;font-size:clamp(28px,5vw,44px);
  line-height:1.2;margin:14px 0 10px}}
a{{color:var(--ink);text-decoration:underline;text-underline-offset:3px}}
.url{{margin-top:22px;font-size:12px;color:var(--soft);word-break:break-all}}
</style>
</head>
<body>
<main>
  <p class="note">固定入口 · 请勿修改此路径</p>
  <h1>{title}</h1>
  <p>正在前往专题页。没有自动跳转？<a href="{href}">点这里进入</a>。</p>
  <p class="url">{url}</p>
</main>
<script>location.replace("{href}");</script>
</body>
</html>
"""

GO_INDEX_HEAD = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>固定入口 · 潇贺古道有声文化数据库</title>
<meta name="robots" content="noindex,follow">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<style>
:root{--paper:#F2EDE2;--ink:#141A16;--soft:#4C574F;--line:rgba(20,26,22,.16);
  --serif:'Noto Serif SC','Source Han Serif SC','Songti SC',STSong,serif;
  --sans:'Noto Sans SC','Source Han Sans SC','PingFang SC','Microsoft YaHei',sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  padding:clamp(24px,6vw,72px);line-height:1.7}
h1{font-family:var(--serif);font-size:clamp(26px,4vw,38px);margin:0 0 8px}
p{max-width:38em;color:var(--soft);margin:0 0 32px}
ul{list-style:none;margin:0;padding:0;max-width:640px;border-top:1px solid var(--line)}
li{border-bottom:1px solid var(--line)}
a{display:flex;justify-content:space-between;gap:16px;padding:14px 0;
  color:inherit;text-decoration:none;font-size:14px}
a:hover{color:#B63A33}
code{font-size:12px;color:var(--soft)}
</style>
</head>
<body>
<main>
  <h1>固定入口</h1>
  <p>七枚二维码指向的短链都在这里。站点改版不影响这些地址。</p>
  <ul>
"""

GO_INDEX_ROW = """    <li><a href="{href}">{no} · {title}<code>{path}</code></a></li>
"""

GO_INDEX_TAIL = """  </ul>
</main>
</body>
</html>
"""


def write_stub(e: dict) -> None:
    slug = e["slug"]
    if slug is None:
        return
    href = "../../" + quote(e["target"])
    html = STUB.format(title=e["title"], href=href, url=e["url"])
    out = GO / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")


def write_go_index(entries: list[dict]) -> None:
    rows = []
    for e in entries:
        rows.append(GO_INDEX_ROW.format(
            href=e["url"],
            no=e["no"],
            title=e["title"],
            path="/" if e.get("slug") is None else "go/" + e["slug"] + "/",
        ))
    (GO / "index.html").write_text(
        GO_INDEX_HEAD + "".join(rows) + GO_INDEX_TAIL, encoding="utf-8")


# ---------------------------------------------------------------- 自检
def check_png(path: Path, url: str) -> tuple[int, int]:
    from PIL import Image
    try:
        import zxingcpp
    except ImportError:
        fail("缺少 zxing-cpp，无法自检二维码内容：python -m pip install zxing-cpp")

    im = Image.open(path).convert("L")
    res = zxingcpp.read_barcodes(im)
    if not res:
        fail(f"扫码失败（无法解码）：{path.name}")
    if res[0].text != url:
        fail(f"二维码内容不符：{path.name}\n  期望 {url}\n  实得 {res[0].text}")

    w, h = im.size
    edge = [im.getpixel((x, 0)) for x in range(0, w, 7)]
    edge += [im.getpixel((x, h - 1)) for x in range(0, w, 7)]
    edge += [im.getpixel((0, y)) for y in range(0, h, 7)]
    edge += [im.getpixel((w - 1, y)) for y in range(0, h, 7)]
    if min(edge) < 250:
        fail(f"quiet zone 不是纯白（边上有墨）：{path.name}")
    return w, h


def check_svg(path: Path) -> None:
    try:
        ET.parse(path)
    except ET.ParseError as exc:
        fail(f"SVG 不是合法 XML：{path.name} → {exc}")


def check_page(entries: list[dict]) -> None:
    if not PAGE.is_file():
        print("… qr/index.html 尚未创建，跳过页面反查")
        return
    html = PAGE.read_text(encoding="utf-8")
    missing = []
    for e in entries:
        if e["url"] not in html:
            missing.append(f"url {e['url']}")
        if f'codes/{e["id"]}.svg' not in html:
            missing.append(f'img codes/{e["id"]}.svg')
    if missing:
        fail("qr/index.html 与 links.json 不一致：\n  - " + "\n  - ".join(missing))


# ---------------------------------------------------------------- 线上核对
def check_live(entries: list[dict]) -> bool:
    """逐条请求线上地址。印之前跑一次：全 200 才说明短链已经部署。"""
    import urllib.error
    import urllib.request

    print("\n线上核对（HEAD）")
    ok = True
    for e in entries:
        try:
            req = urllib.request.Request(e["url"], method="HEAD",
                                         headers={"User-Agent": "make_qr/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                status = r.status
        except urllib.error.HTTPError as exc:
            status = exc.code
        except Exception as exc:  # 网络不通
            status = f"ERR {type(exc).__name__}"
        good = status == 200
        ok &= good
        print(f"  {'✓' if good else '✗'} {status}  {e['url']}")
    return ok


# ---------------------------------------------------------------- 主流程
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只自检，不写文件")
    ap.add_argument("--live", action="store_true", help="另外请求线上地址，确认已部署")
    args = ap.parse_args()

    data = load()
    entries = data["entries"]
    CODES.mkdir(parents=True, exist_ok=True)
    GO.mkdir(exist_ok=True)

    print(f"站点  {data['site']}")
    print(f"{'id':10s} {'no':3s} {'v':>3s} {'模块':>5s} {'URL'}")
    for e in entries:
        svg, png = CODES / f"{e['id']}.svg", CODES / f"{e['id']}-print.png"
        q = segno.make(e["url"], error=ECC)
        if not args.check:
            qr_svg(e["url"], svg, e["title"])
            qr_png(e["url"], png)
            write_stub(e)
        w, h = check_png(png, e["url"])
        check_svg(svg)
        print(f"{e['id']:10s} {e['no']:3s} v{q.version:02d} "
              f"{q.symbol_size(border=0)[0]:3d}px {len(e['url']):2d}字 "
              f"png {w}×{h}  {e['url']}")

    if not args.check:
        write_go_index(entries)
    check_page(entries)

    total = sum((CODES / f"{e['id']}.svg").stat().st_size
                + (CODES / f"{e['id']}-print.png").stat().st_size for e in entries)
    print(f"\n✓ 7 枚二维码自检通过 · 资源共 {total / 1024:.0f} KB"
          f" · 短链页 go/{{{'|'.join(e['slug'] for e in entries if e.get('slug'))}}}")

    if args.live and not check_live(entries):
        print("\n✗ 线上还有地址不是 200：推完代码、等 Pages 构建完再印。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
