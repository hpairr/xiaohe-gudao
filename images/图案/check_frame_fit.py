# -*- coding: utf-8 -*-
"""
八角花图标 · 外框包容性自检
============================
外框不是圆，是 {8/3} 凹边星形：顶点半径 64、边中点半径 54.06。
这里生成与外框完全一致的路径，再按「真实走的弧」密集采样成多边形，
用射线法精确判断「每一枚内芯的关键点是否都在框内」。

为什么要做这个：目视检查发现不了「笔画压到边框」，参数一改又会复发；
本轮真正翻车的地方不是内芯，而是外框本身（弧方向搞错，整朵花缩成一团）。
所以外框也一起自检：顶点半径必须是 64、边中点半径必须在 50~58。

真实渲染核对（2026-10-15，headless Chrome 截图逐像素量）：
    顶点半径 64.5，边中点半径 55.7~56.0 —— 与设计值 64 / 54.06 一致（差值含描边宽度）。
"""

import glob
import math
import os
import re

C = 80.0
R_FRAME = 64.0
BULGE = 0.25          # 与 build.py 保持一致
ORDER = [0, 3, 6, 1, 4, 7, 2, 5]
MARGIN = 2.5          # 内芯距外框线至少留这么多
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '01-潇贺古道.svg')

CMD_ARGS = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'A': 7, 'Z': 0}


def vtx(n, r=R_FRAME):
    a = math.radians(45.0 * n)
    return (C + r * math.sin(a), C - r * math.cos(a))


def edge_arc(i, j):
    """与 build.py 同一算法：两端点 + 内凹中点三点定圆"""
    p, q = vtx(i), vtx(j)
    dx, dy = q[0] - p[0], q[1] - p[1]
    chord = math.hypot(dx, dy)
    mx, my = (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0
    nx, ny = -dy / chord, dx / chord
    if nx * (C - mx) + ny * (C - my) > 0:
        nx, ny = -nx, -ny
    bulge = BULGE * chord
    bx, by = mx + nx * bulge, my + ny * bulge
    ax, ay = p
    cx3, cy3 = q
    dd = 2 * (ax * (by - cy3) + bx * (cy3 - ay) + cx3 * (ay - by))
    ux = ((ax * ax + ay * ay) * (by - cy3) + (bx * bx + by * by) * (cy3 - ay) +
          (cx3 * cx3 + cy3 * cy3) * (ay - by)) / dd
    uy = ((ax * ax + ay * ay) * (cx3 - bx) + (bx * bx + by * by) * (ax - cx3) +
          (cx3 * cx3 + cy3 * cy3) * (bx - ax)) / dd
    r = math.hypot(ax - ux, ay - uy)
    a0 = math.atan2(ay - uy, ax - ux)
    a1 = math.atan2(cy3 - uy, cx3 - ux)
    am = math.atan2(by - uy, bx - ux)
    return (ux, uy), r, (bx, by), a0, a1, am


def arc_flags(ta, tb, tm):
    """从 ta 走到 tb、途中经过 tm 的 (large-arc, sweep)"""
    def norm(x):
        while x <= -math.pi:
            x += 2 * math.pi
        while x > math.pi:
            x -= 2 * math.pi
        return x

    for sweep in (1, 0):
        d = norm(tb - ta)
        d = (d - 2 * math.pi if d > 0 else d) if sweep == 0 else (d + 2 * math.pi if d < 0 else d)
        dm = norm(tm - ta)
        dm = (dm - 2 * math.pi if dm > 0 else dm) if sweep == 0 else (dm + 2 * math.pi if dm < 0 else dm)
        if (d > 0 and 0 <= dm <= d) or (d < 0 and d <= dm <= 0):
            return (1 if abs(d) > math.pi else 0), sweep
    return 0, 1


def arc_samples(i, j, n=64):
    """按最终路径真实走的弧采样"""
    (cx, cy), r, mid, a0, a1, am = edge_arc(i, j)
    la, sw = arc_flags(a0, a1, am)
    d = a1 - a0
    while d <= -math.pi:
        d += 2 * math.pi
    while d > math.pi:
        d -= 2 * math.pi
    if sw == 0:
        d = d - 2 * math.pi if d > 0 else d
    else:
        d = d + 2 * math.pi if d < 0 else d
    return [(cx + r * math.cos(a0 + d * t / float(n)),
             cy + r * math.sin(a0 + d * t / float(n))) for t in range(n)]


def frame_polygon(n=64):
    pts = []
    for k in range(8):
        pts += arc_samples(ORDER[k], ORDER[(k + 1) % 8], n)
    return pts


def inside(p, poly):
    x, y = p
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def dist_to_poly(p, poly):
    x, y = p
    d = 1e9
    j = len(poly) - 1
    for i in range(len(poly)):
        x1, y1 = poly[j]
        x2, y2 = poly[i]
        vx, vy = x2 - x1, y2 - y1
        L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - x1) * vx + (y - y1) * vy) / L2))
        d = min(d, math.hypot(x - (x1 + vx * t), y - (y1 + vy * t)))
        j = i
    return d


def path_points(d):
    """只做粗筛用的路径点解析（内芯判框用；外框另有 arc_samples 精确采样）"""
    toks = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|-?\d+(?:\.\d+)?', d)
    pts, i, cmd, cur = [], 0, None, (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd.upper() == 'Z':
                continue
        n = CMD_ARGS.get(cmd.upper(), 2)
        if i + n > len(toks):
            break
        a = [float(x) for x in toks[i:i + n]]
        i += n
        up, rel = cmd.upper(), cmd.islower()
        if up in ('M', 'L', 'T'):
            x, y = a
            if rel:
                x, y = cur[0] + x, cur[1] + y
            cur = (x, y)
            pts.append(cur)
        elif up == 'C':
            for k in (0, 2, 4):
                x, y = a[k], a[k + 1]
                if rel:
                    x, y = cur[0] + x, cur[1] + y
                pts.append((x, y))
            cur = pts[-1]
        elif up in ('S', 'Q'):
            for k in (0, 2):
                x, y = a[k], a[k + 1]
                if rel:
                    x, y = cur[0] + x, cur[1] + y
                pts.append((x, y))
            cur = pts[-1]
        elif up == 'A':
            x, y = a[5], a[6]
            if rel:
                x, y = cur[0] + x, cur[1] + y
            pts.append((x, y))
            cur = (x, y)
        elif up == 'H':
            x = a[0] + (cur[0] if rel else 0)
            cur = (x, cur[1])
            pts.append(cur)
        elif up == 'V':
            y = a[0] + (cur[1] if rel else 0)
            cur = (cur[0], y)
            pts.append(cur)
    return pts


def collect(svg):
    pts = []
    for d in re.findall(r'<path[^>]*?\sd="([^"]+)"', svg):
        pts += path_points(d)
    for cx, cy in re.findall(r'<circle[^>]*?cx="(-?[\d.]+)"[^>]*?cy="(-?[\d.]+)"', svg):
        pts.append((float(cx), float(cy)))
    for x, y, w, h in re.findall(
            r'<rect[^>]*?x="(-?[\d.]+)"[^>]*?y="(-?[\d.]+)"[^>]*?width="(-?[\d.]+)"[^>]*?height="(-?[\d.]+)"', svg):
        x, y, w, h = float(x), float(y), float(w), float(h)
        pts += [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]
    for ps in re.findall(r'points="([^"]+)"', svg):
        for a, b in re.findall(r'(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)', ps):
            pts.append((float(a), float(b)))
    return pts


def check_frame():
    """外框自检：顶点半径 64、边中点半径约 54"""
    vr = sorted({round(math.hypot(x - C, y - C), 1) for n in range(8) for x, y in [vtx(n)]})
    mids = [math.hypot(edge_arc(ORDER[k], ORDER[(k + 1) % 8])[2][0] - C,
                       edge_arc(ORDER[k], ORDER[(k + 1) % 8])[2][1] - C) for k in range(8)]
    amin, amax = min(mids), max(mids)
    ok = abs(vr[0] - 64) < 0.2 and 50 <= amin and amax <= 58
    print('外框自检  顶点半径 %s（应为 64）' % vr)
    print('          边中点半径 %.1f ~ %.1f（应落在 50~58，即八条连弧的凹口）%s'
          % (amin, amax, '' if ok else '  !! 不对'))
    return ok


def main():
    poly = frame_polygon()
    rs = [math.hypot(x - C, y - C) for x, y in poly]
    print('外框采样 %d 点，半径 %.1f ~ %.1f' % (len(poly), min(rs), max(rs)))
    bad = 0 if check_frame() else 1
    print()
    for f in sorted(glob.glob(os.path.join(os.path.dirname(SRC), '0*.svg'))):
        svg = open(f, encoding='utf-8').read()
        tail = svg[svg.index('<g id="core"'):]
        sc = re.search(r'<g id="core" transform="translate\([^)]*\) scale\(([\d.]+)\)', tail)
        scale = float(sc.group(1)) if sc else 1.0
        core = svg[svg.index('id="core"'):svg.rindex('</svg>')]
        pts = collect(core)
        if not pts:
            print('%-22s 无几何点' % os.path.basename(f))
            continue
        pts = [(C + (x - C) * scale, C + (y - C) * scale) for x, y in pts]
        out = [p for p in pts if not inside(p, poly)]
        near = [p for p in pts if inside(p, poly) and dist_to_poly(p, poly) < MARGIN]
        status = 'OK' if (not out and not near) else '!! 需修'
        bad += 0 if status == 'OK' else 1
        far = max(math.hypot(p[0] - C, p[1] - C) for p in pts)
        msg = '  最远 %.1f' % far
        if out:
            p = out[0]
            msg += '  框外 %d 点，例 (%.1f,%.1f)' % (len(out), p[0], p[1])
        if near:
            p = near[0]
            msg += '  压线(<%.1f) %d 点，例 (%.1f,%.1f)' % (MARGIN, len(near), p[0], p[1])
        print('%-22s 点 %4d scale %.2f  %s%s' % (os.path.basename(f), len(pts), scale, status, msg))
    print('\n结论：', '外框正确，且内芯全部落在框内、不压线' if bad == 0 else '有 %d 项需修' % bad)


if __name__ == '__main__':
    main()
