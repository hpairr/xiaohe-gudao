# -*- coding: utf-8 -*-
"""
潇贺古道 · 八角花图标系统 · 图案生成器
==========================================
一键生成 7 枚「八角花」主题图标（SVG，分层、可动画）。

依据：
  · 外框几何 —— A毕设图形/参考/八角花凹边原理演示.html
                8 顶点共圆、跳 3 相连（星形多边形 {8/3}）、8 条同半径连弧
  · 主题内芯 —— A毕设图形/10-主题视觉转化研究报告.md（设计元素清单）
  · 配色     —— docs/素材库/04-代表图案设计方案.md（群青 + 朱砂 + 宣纸白）

用法：
    python build.py
产物：
    ../../images/图案/01-潇贺古道.svg … 07-盘王印.svg
    ../../images/图案/_预览-八角花七枚.svg   （一排七朵，供快速目视核对）
"""

import math
import os

# ---------------------------------------------------------------- 画布与配色
S      = 160.0        # 画布边长
C      = S / 2        # 圆心
R_FRAME = 64.0        # 外框外半径（8 个顶点所在圆）
BULGE   = 0.25        # 每条边「向内凹」的深度 = 弦长 × 此系数
# 说明一：不再用「弧半径」当参数。半径 ∝ 弦长，直接给半径很容易让弦长超过直径，
#         圆心跑到弦中点附近、整朵花塌成一团（本轮踩过这个坑）。
# 说明二：这里必须用「垂直弦的法向」压，不能朝画布中心压 —— 跳 3 位的边几乎穿过圆心，
#         弦中点离画布中心只有 24.5，朝圆心压会顺着弦滑回去。
# 说明三：0.25 是算出来的：弦长 118.26，弦中点半径 24.49，法向压 29.57 后
#         边中点落在半径 54.06，正好与外顶点半径 64 形成 10 的凹口（约 15%），
#         即参考模板里「八条连弧、饱满微凹」的形态。
SW_FRAME = 2.2        # 外框线宽
SW_MAIN  = 3.0        # 内芯主形线宽
SW_FINE  = 1.6        # 细节点线宽

PAPER    = "#F7F4EC"
INK      = "#1F2D3D"
QUN      = "#3A5BA0"
CINNABAR = "#C3272B"
GOLD     = "#D9A13B"
TIANSHUI = "#5CAC9E"
NIGHT    = "#1A1F2B"   # 炸龙专用：夜黑底（有依据的破格）

# ---------------------------------------------------------------- 外框几何
def vtx(n, r=R_FRAME):
    """第 n 个顶点（正上方为 0，顺时针 45° 一步）"""
    a = math.radians(45.0 * n)
    return (C + r * math.sin(a), C - r * math.cos(a))

def edge_arc(i, j):
    """
    i→j 这条边（跳 3 位，跨度 135°）的内凹连弧。
    做法：先取顶点连线，再把它朝画布中心方向压 BULGE×弦长；
    过「两端点 + 压出来的中点」三点定圆 → 圆心、半径、以及要走的弧侧全部唯一确定。
    返回 (圆心, 半径, 弧中点, 起点角, 终点角, 中间角)。
    这样每一步都是显式几何，不依赖 SVG 的 large-arc/sweep 标志位去猜。
    """
    p, q = vtx(i), vtx(j)
    dx, dy = q[0] - p[0], q[1] - p[1]
    chord = math.hypot(dx, dy)
    mx, my = (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0
    # 关键：凹的方向必须垂直于弦（n），而不是「朝画布中心」——
    # 跳 3 位的边几乎穿过圆心，朝圆心走会顺着弦滑回去，整朵花缩成一团。
    nx, ny = -dy / chord, dx / chord
    if nx * (C - mx) + ny * (C - my) > 0:      # 让 n 指离画布中心
        nx, ny = -nx, -ny
    bulge = max(0.0, min(0.45, BULGE)) * chord
    mid = (mx + nx * bulge, my + ny * bulge)   # 边中点（向内凹到的位置）
    # 三点定圆
    ax, ay = p
    bx, by = mid
    cx3, cy3 = q
    d = 2 * (ax * (by - cy3) + bx * (cy3 - ay) + cx3 * (ay - by))
    if abs(d) < 1e-9:                                  # 三点近乎共线 → 直接当直线
        return (None, 0.0, mid, 0.0, 0.0, 0.0)
    ux1 = ((ax * ax + ay * ay) * (by - cy3) + (bx * bx + by * by) * (cy3 - ay) +
           (cx3 * cx3 + cy3 * cy3) * (ay - by)) / d
    uy1 = ((ax * ax + ay * ay) * (cx3 - bx) + (bx * bx + by * by) * (ax - cx3) +
           (cx3 * cx3 + cy3 * cy3) * (bx - ax)) / d
    r = math.hypot(ax - ux1, ay - uy1)
    a0 = math.atan2(ay - uy1, ax - ux1)
    a1 = math.atan2(cy3 - uy1, cx3 - ux1)
    am = math.atan2(by - uy1, bx - ux1)
    return ((ux1, uy1), r, mid, a0, a1, am)


def arc_mid(i, j):
    """弧的中点（八条连弧互相之间就靠它定位）"""
    return edge_arc(i, j)[2]

def _arc_flags(theta_a, theta_b, theta_m):
    """
    求「从角 theta_a 走到 theta_b、且途中经过 theta_m」的 (large-arc, sweep)。
    —— 先把两条可能的走法都摆出来，再挑出真的经过 theta_m 的那条。
    之前按「差值是否落在区间里」写，符号处理极易出错，结果弧走反方向、整朵花缩成一团。
    """
    def norm(x):
        while x <= -math.pi:
            x += 2 * math.pi
        while x > math.pi:
            x -= 2 * math.pi
        return x
    for sweep in (1, 0):
        d = norm(theta_b - theta_a)
        if sweep == 0:
            d = d - 2 * math.pi if d > 0 else d
        else:
            d = d + 2 * math.pi if d < 0 else d
        dm = norm(theta_m - theta_a)
        if sweep == 0:
            dm = dm - 2 * math.pi if dm > 0 else dm
        else:
            dm = dm + 2 * math.pi if dm < 0 else dm
        if (d > 0 and 0 <= dm <= d) or (d < 0 and d <= dm <= 0):
            return (1 if abs(d) > math.pi else 0), sweep
    return 0, 1


def flower_path(close=True):
    """
    八角连弧外框。
    八条边首尾相接：边 k 从顶点 order[k] 沿自己的内凹圆弧走到顶点 order[k+1]，
    每条弧都经过该边的内凹中点 —— 这就是「八条连弧」。
    """
    order = [0, 3, 6, 1, 4, 7, 2, 5]
    segs = [(order[k], order[(k + 1) % 8]) for k in range(8)]
    d = []
    for n, (i, j) in enumerate(segs):
        (cx0, cy0), r, mid, a0, a1, am = edge_arc(i, j)
        if n == 0:
            d.append("M %.2f %.2f" % vtx(i))
        if cx0 is None:
            d.append("L %.2f %.2f" % vtx(j))
            continue
        la, sw = _arc_flags(a0, a1, am)
        d.append("A %.2f %.2f 0 %d %d %.2f %.2f" % (r, r, la, sw, vtx(j)[0], vtx(j)[1]))
    if close:
        d.append("Z")
    return " ".join(d)

FRAME_D = flower_path()

def regular_octagon(r, rot=22.5, cx=C, cy=C):
    pts = []
    for k in range(8):
        a = math.radians(rot + 45.0 * k)
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    return " ".join("%.2f,%.2f" % p for p in pts)

# ---------------------------------------------------------------- SVG 骨架
def svg_open(title, dark=False):
    bg = NIGHT if dark else PAPER
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" '
            'role="img" aria-label="%s">\n'
            '<!-- %s -->\n'
            '<defs><style>\n'
            '  .bg{fill:none}\n'
            '  .frame{fill:none;stroke:%s;stroke-width:%.1f;stroke-linejoin:round}\n'
            '  .main{fill:none;stroke:%s;stroke-width:%.1f;stroke-linecap:round;stroke-linejoin:round}\n'
            '  .accent{fill:none;stroke:%s;stroke-width:%.1f;stroke-linecap:round;stroke-linejoin:round}\n'
            '  .fine{fill:none;stroke:%s;stroke-width:%.1f;stroke-linecap:round}\n'
            '  .fillq{fill:%s}.fillr{fill:%s}.fillg{fill:%s}.fillt{fill:%s}.fillo{fill:%s}\n'
            '  .strokedash{stroke:%s;stroke-width:%.1f;stroke-dasharray:3 4;fill:none}\n'
            '</style></defs>\n'
            '<rect class="bg" x="0" y="0" width="160" height="160" fill="%s"/>\n'
            % (title, title, INK, SW_FRAME, QUN, SW_MAIN, CINNABAR, SW_FINE,
               INK, SW_FINE, QUN, CINNABAR, GOLD, TIANSHUI, GOLD,
               INK, SW_FINE, bg))

SVG_CLOSE = "</svg>\n"

def flower(title, inner, dark=False, frame_color=None, scale=1.0):
    """
    套上统一外框，得到完整的一枚八角花。

    scale 是「内芯适配系数」——外框是 {8/3} 凹边星形，内切圆只有约 49（顶点却有 64），
    所以内芯不能按 160 画满，否则笔画会压到边框上。
    各枚的系数由 check_frame_fit.py 量出来（都是让内芯最远点落在半径 ≈ 46 以内）。
    """
    s = svg_open(title, dark)
    if frame_color:
        s = s.replace('.frame{fill:none;stroke:%s' % INK, '.frame{fill:none;stroke:%s' % frame_color, 1)
    s += '<g id="octagon-frame"><path class="frame" d="%s"/></g>\n' % FRAME_D
    if abs(scale - 1.0) > 1e-6:
        s += '<g id="core" transform="translate(%g %g) scale(%.4f) translate(%g %g)">\n' % (
            C, C, scale, -C, -C)
        s += inner + "\n</g>\n"
    else:
        s += '<g id="core">\n%s</g>\n' % inner
    s += SVG_CLOSE
    return s

# ---------------------------------------------------------------- 内芯 1 · 潇贺古道
def core_road():
    g = []
    # 石板路：一条 12° 的折线路带 + 错缝石板
    ang = math.radians(12)
    ca, sa = math.cos(ang), math.sin(ang)
    def P(u, v):
        """把 (沿线, 垂直) 局部坐标转到画布。
        注意 SVG 里与屏幕一样 x 向右、y 向下，旋转矩阵为
        x' = u·cos − v·sin,  y' = u·sin + v·cos —— 不能再混用「屏幕 y」与「数学 y」。"""
        x = C + u * ca - v * sa
        y = C + u * sa + v * ca
        return x, y
    # 路带轮廓（上下两条平行边）——控制在半径 60 以内，不与外框相撞
    a = P(-50, -10.5); b = P(50, -10.5); c = P(50, 10.5); d = P(-50, 10.5)
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f" stroke-dasharray="2 5"/>' % (*a, *b))
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f" stroke-dasharray="2 5"/>' % (*c, *d))
    # 错缝石板：3 行 × 若干块
    cols = [(-47, -18), (-16, 13), (15, 44)]
    for row, v0 in enumerate([-7.0, 0.0, 7.0]):
        shift = 0 if row == 1 else 7
        for (u0, u1) in cols:
            x0, y0 = P(u0 + shift, v0 - 3.0)
            x1, y1 = P(u1 + shift, v0 - 3.0)
            x2, y2 = P(u1 + shift, v0 + 3.0)
            x3, y3 = P(u0 + shift, v0 + 3.0)
            g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
                     % (x0, y0, x1, y1, x2, y2, x3, y3))
    # 马蹄印：缺口圆（缺口朝上 = 马蹄的开口）
    for (u, v, s) in [(-26, 0, 4.6), (20, 0, 5.4), (43, 0, 3.9)]:
        cx, cy = P(u, v)
        g.append('<path class="accent" d="M %.1f %.1f A %.1f %.1f 0 1 1 %.1f %.1f" '
                 'stroke-width="%.1f"/>'
                 % (cx + s * .72, cy - s * .70, s * 1.05, s * 1.05, cx + s * .72, cy - s * .70, SW_MAIN))
        g.append('<circle class="fillr" cx="%.1f" cy="%.1f" r="1.3"/>' % (cx, cy))
    # 起 / 终 两枚方印（「道」「贺」意象，用实心小方表示）
    for (u, col) in [(-55, CINNABAR), (55, INK)]:
        cx, cy = P(u, 0)
        g.append('<rect x="%.1f" y="%.1f" width="7" height="7" fill="%s" transform="rotate(45 %.1f %.1f)"/>'
                 % (cx - 3.5, cy - 3.5, col, cx, cy))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 2 · 女书
def core_nushu():
    g = []
    # 长菱形字：3×3 字帖格 + 每格一笔（点/竖/斜/弧 四笔体系）
    step = 30.0
    idx = 0
    for r in range(3):
        for c in range(3):
            cx = C + (c - 1) * step
            cy = C + (r - 1) * step
            hw, hh = 11.0, 13.5      # 长菱形：高 > 宽
            # 菱形格（细线；东北向"空位"格用虚线，隐喻"人死书亡"）
            empty = (r == 2 and c == 2)
            cls = 'strokedash' if empty else 'fine'
            g.append('<path class="%s" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
                     % (cls, cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy))
            if empty:
                g.append('<circle class="fillr" cx="%.1f" cy="%.1f" r="1.8"/>' % (cx, cy))
                continue
            k = idx % 4
            if k == 0:      # 点
                g.append('<circle class="fillq" cx="%.1f" cy="%.1f" r="2.2"/>' % (cx, cy - 2))
                g.append('<circle class="fillq" cx="%.1f" cy="%.1f" r="1.5"/>' % (cx + 2.6, cy + 3.4))
            elif k == 1:    # 竖
                g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f"/>' % (cx, cy - 8, cx, cy + 8))
            elif k == 2:    # 斜
                g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f"/>' % (cx - 5.5, cy + 6.5, cx + 5.5, cy - 6.5))
            else:           # 弧
                g.append('<path class="main" d="M %.1f %.1f Q %.1f %.1f %.1f %.1f"/>'
                         % (cx - 5.5, cy + 5.5, cx + 2.5, cy + 1.5, cx + 5.0, cy - 6.0))
            idx += 1
    # 中心一枚朱砂小方（三朝书内页正中「八角花」的位置意象）
    g.append('<rect class="fillr" x="%.1f" y="%.1f" width="6" height="6" transform="rotate(45 %d %d)"/>'
             % (C - 3, C - 3, int(C), int(C)))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 3 · 蝴蝶歌
def core_butterfly():
    theta = math.radians(42)
    ct, st = math.cos(theta), math.sin(theta)
    raw = [(11, -36), (-12, -23), (11, 0), (15, -19)]      # (x 沿轴, y 横向)
    pts = []
    for (x, y) in raw:
        pts.append((C + x * ct - y * st, C + x * st + y * ct))
    p0, p1, p2, p3 = pts
    g = []
    for sgn in (1, -1):
        d = ("M %.1f %.1f Q %.1f %.1f %.1f %.1f Q %.1f %.1f %.1f %.1f Z"
             % (C, C,
                C + sgn * (p1[0] - C), C + sgn * (p1[1] - C),
                C + sgn * (p0[0] - C), C + sgn * (p0[1] - C),
                C + sgn * (p3[0] - C), C + sgn * (p3[1] - C),
                p2[0], p2[1]))
        g.append('<path class="main" d="%s"/>' % d)
    # 中缝：两 wing 的接缝留白即「二声部相交」
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f" stroke-dasharray="2 4"/>' % (C, C - 20, C, C + 12))
    # 衬词点：「蝴·的·蝶」—— 翅内颗粒，二声部同起同收
    for (x, y) in [(-12, 12), (-1, 17), (9, 13), (-18, 5), (17, 4)]:
        g.append('<circle class="fillo" cx="%.1f" cy="%.1f" r="2.2"/>' % (C + x, C + y))
    # 「分→合」：两条曲线从分开收到同度
    g.append('<path class="accent" d="M %.1f %.1f Q %.1f %.1f %.1f %.1f"/>'
             % (C - 19, C - 44, C - 11, C - 26, C, C - 12))
    g.append('<path class="accent" d="M %.1f %.1f Q %.1f %.1f %.1f %.1f"/>'
             % (C + 19, C - 44, C + 11, C - 26, C, C - 12))
    g.append('<circle class="fillr" cx="%.1f" cy="%.1f" r="2.4"/>' % (C, C - 12))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 4 · 长鼓舞
def core_drum():
    g = []
    w_top, w_waist = 21.0, 10.0
    y_top, y_waist, y_bot = C - 40, C, C + 40
    g.append('<path class="main" d="M %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f L %.1f %.1f '
             'C %.1f %.1f %.1f %.1f %.1f %.1f Z"/>'
             % (C - w_waist, y_waist,
                C - w_waist - 1.5, C - 16, C - w_top, y_top + 8, C - w_top, y_top,
                C + w_top, y_top,
                C + w_top, y_top + 8, C + w_waist + 1.5, C - 16, C + w_waist, y_waist))
    g.append('<path class="main" d="M %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f L %.1f %.1f '
             'C %.1f %.1f %.1f %.1f %.1f %.1f Z"/>'
             % (C + w_waist, y_waist,
                C + w_waist + 1.5, C + 16, C + w_top, y_bot - 8, C + w_top, y_bot,
                C - w_top, y_bot,
                C - w_top, y_bot - 8, C - w_waist - 1.5, C + 16, C - w_waist, y_waist))
    # 两端鼓面（圆角矩形 = 绷紧的鼓皮）
    for yy in (y_top, y_bot):
        g.append('<path class="fine" d="M %.1f %.1f Q %.1f %.1f %.1f %.1f L %.1f %.1f Q %.1f %.1f %.1f %.1f"/>'
                 % (C - w_top, yy, C, yy - 5.5, C + w_top, yy, C + w_top, yy, C, yy + 5.5, C - w_top, yy))
    # 中腰：束腰处一道细线 = 束腰绳
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (C - w_waist, y_waist, C + w_waist, y_waist))
    # 鼓点：四个错峰弹跳的实心点
    for (dx, dy) in [(-30, -11), (-19, 15), (19, -9), (30, 14)]:
        g.append('<circle class="fillr" id="beat" cx="%.1f" cy="%.1f" r="3.4"/>' % (C + dx, C + dy))
    # 围圈队形：以中腰为心的弧 + 四个小人形点（围圈击鼓）
    g.append('<path class="strokedash" d="M %.1f %.1f A 38 38 0 0 1 %.1f %.1f"/>'
             % (C - 38, C + 2, C + 38, C + 2))
    for k in range(4):
        a = math.radians(200 + k * 46.7)
        g.append('<circle class="fillq" cx="%.1f" cy="%.1f" r="2.3"/>'
                 % (C + 38 * math.cos(a), C + 2 + 11 * math.sin(a)))
    # 舞者 S 形身姿（一笔暗示，不画具体人物）
    g.append('<path class="accent" d="M %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f"/>'
             % (C - 8, C - 20, C + 6, C - 6, C - 6, C + 6, C + 8, C + 20))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 5 · 风雨桥
def core_bridge():
    g = []
    # 三孔石拱 ——「三孔」是与侗族系风雨桥的区分点（回澜桥为三孔石拱，青龙桥才是单孔）
    y_deck, y_base = C - 10, C + 18
    arches = [(38, 38, 13.0), (62, 98, 22.0), (122, 122, 13.0)]   # (左墩, 右墩, 起拱半径)
    for (xl, xr, rad) in arches:
        cy0 = y_deck + 7
        g.append('<path class="main" d="M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f"/>'
                 % (xl, cy0, rad, rad, xr, cy0))
        g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (xl, cy0, xl, y_base))
        g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (xr, cy0, xr, y_base))
    # 桥面 + 木构桥廊（水平长条）
    g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f"/>' % (C - 46, y_base, C + 46, y_base))
    g.append('<rect class="main" x="%.1f" y="%.1f" width="%.1f" height="%.1f"/>'
             % (C - 38, y_deck - 16, 76, 16))
    # 桥廊立柱
    for dx in (-30, -10, 10, 30):
        g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (C + dx, y_deck - 16, C + dx, y_deck))
    # 重檐歇山阁楼（识别核心）：两重檐口各自「左重右扫 / 右重左扫」= 飞檐翘角
    for (dy, hw, eave) in [(0, 27, 5), (22, 19, 7)]:
        yy = y_deck - 16 - dy
        g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f"/>'
                 % (C - hw, yy, C - hw * .55, yy - 11, C - hw * .38, yy))
        g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f"/>'
                 % (C - hw, yy, C - hw - eave * .8, yy - eave, C - hw * .55, yy - 11))
        g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f"/>'
                 % (C + hw, yy, C + hw * .55, yy - 11, C + hw * .38, yy))
        g.append('<path class="main" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f"/>'
                 % (C + hw, yy, C + hw + eave * .8, yy - eave, C + hw * .55, yy - 11))
    # 阁楼身 + 宝顶
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f"/>'
             % (C - 10, y_deck - 16, C - 8, y_deck - 34, C + 8, y_deck - 34, C + 10, y_deck - 16))
    g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (C, y_deck - 44, C, y_deck - 48))
    # 回澜：水面回流的两道波纹（桥名取自韩愈《进学解》「回狂澜之即倒」）
    for k, yy in enumerate([y_base + 5, y_base + 10]):
        w = 34 - k * 8
        g.append('<path class="fine" d="M %.1f %.1f Q %.1f %.1f %.1f %.1f T %.1f %.1f"/>'
                 % (C - w, yy, C - w / 2, yy - 4, C, yy, C + w, yy))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 6 · 上灯炸龙
def core_dragon():
    g = []
    hub = (C, C - 4)
    # 八角灯骨架：外八角环 + 内八角环 + 八根灯骨（与八角花同构 —— 天然的家族钩子）
    g.append('<path class="accent" d="M %s Z"/>' % regular_octagon(31, cx=hub[0], cy=hub[1]))
    g.append('<path class="fine" d="M %s Z"/>' % regular_octagon(19, cx=hub[0], cy=hub[1]))
    for k in range(8):
        a = math.radians(22.5 + 45 * k)
        x1 = hub[0] + 19 * math.sin(a); y1 = hub[1] - 19 * math.cos(a)
        x2 = hub[0] + 31 * math.sin(a); y2 = hub[1] - 31 * math.cos(a)
        g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f"/>' % (x1, y1, x2, y2))
    # 光点龙：由光点串成的龙身，穿灯而过（S 形折线 + 采样点）
    path = [(C + 28, C - 44), (C + 8, C - 29), (C - 14, C - 13),
            (C - 26, C + 5), (C - 10, C + 22), (C + 15, C + 31), (C + 33, C + 46)]
    dots = []
    for i in range(len(path) - 1):
        for t in [0.0, 0.34, 0.67]:
            x = path[i][0] + (path[i + 1][0] - path[i][0]) * t
            y = path[i][1] + (path[i + 1][1] - path[i][1]) * t
            dots.append((x, y))
    dots.append(path[-1])
    for k, (x, y) in enumerate(dots):
        r = 4.0 - 1.7 * (k / float(len(dots)))
        cls = "fillr" if k % 3 == 0 else "fillo"
        g.append('<circle class="%s" id="spark" cx="%.1f" cy="%.1f" r="%.2f"/>' % (cls, x, y, max(r, 1.6)))
    # 龙首
    g.append('<circle class="fillr" cx="%.1f" cy="%.1f" r="6.0"/>' % dots[0])
    g.append('<circle class="fillo" cx="%.1f" cy="%.1f" r="2.2"/>' % (dots[0][0] + 3.4, dots[0][1] - 1.5))
    # 焰火：放射短线段（自中心向外）
    for k in range(12):
        a = math.radians(k * 30 + 14)
        x1 = C + 34 * math.cos(a); y1 = C + 34 * math.sin(a)
        x2 = C + 50 * math.cos(a); y2 = C + 50 * math.sin(a)
        g.append('<path class="fine" d="M %.1f %.1f L %.1f %.1f" stroke="%s"/>' % (x1, y1, x2, y2, CINNABAR))
    return "\n".join(g)

# ---------------------------------------------------------------- 内芯 7 · 盘王印（备用）
def core_panwang():
    g = []
    # 外方内八角 + 四边回纹（回纹拐角倒圆角）
    g.append('<rect class="main" x="%.1f" y="%.1f" width="%.1f" height="%.1f"/>'
             % (C - 38, C - 38, 76, 76))
    g.append('<rect class="fine" x="%.1f" y="%.1f" width="%.1f" height="%.1f"/>'
             % (C - 33, C - 33, 66, 66))
    g.append('<path class="main" d="M %s Z"/>' % regular_octagon(26))
    g.append('<path class="fine" d="M %s Z"/>' % regular_octagon(14))
    # 八角内的长菱形（三层：外方 → 内八角 → 菱形）
    g.append('<path class="accent" d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
             % (C, C - 10.5, C + 7.5, C, C, C + 10.5, C - 7.5, C))
    # 四角回纹（盘王印是「外方内八角 + 回纹压角」）
    for (sx, sy) in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        x0, y0 = C + sx * 29, C + sy * 29
        d = ("M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f"
             % (x0, y0, x0 - sx * 5, y0, x0 - sx * 5, y0 - sy * 5,
                x0 - sx * 10, y0 - sy * 5, x0 - sx * 10, y0))
        g.append('<path class="fine" d="%s"/>' % d)
    return "\n".join(g)

# ---------------------------------------------------------------- 组装
ICONS = [
    ("01-潇贺古道", "潇贺古道 · 折线路带与马蹄印", lambda: flower("潇贺古道", core_road(),      scale=0.78)),
    ("02-女书",     "女书 · 长菱形字与四笔体系", lambda: flower("女书",     core_nushu(),     scale=0.85)),
    ("03-蝴蝶歌",   "蝴蝶歌 · 双翅分合",         lambda: flower("蝴蝶歌",   core_butterfly(), scale=0.95)),
    ("04-长鼓舞",   "长鼓舞 · 细腰沙漏鼓",       lambda: flower("长鼓舞",   core_drum(),      scale=0.88)),
    ("05-风雨桥",   "风雨桥 · 三孔拱与重檐",     lambda: flower("风雨桥",   core_bridge(),    scale=0.80)),
    ("06-上灯炸龙", "上灯炸龙 · 八角灯与光点龙", lambda: flower("上灯炸龙", core_dragon(), dark=True, scale=0.82)),
    ("07-盘王印",   "盘王印 · 外方内八角",       lambda: flower("盘王印",   core_panwang(),   scale=0.72)),
]

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.normpath(os.path.join(here, "..", "..", "images", "图案"))
    os.makedirs(out, exist_ok=True)
    for name, title, fn in ICONS:
        p = os.path.join(out, name + ".svg")
        with open(p, "w", encoding="utf-8") as f:
            f.write(fn())
        print("written", p)
    # 一排七朵预览
    body = []
    for i, (name, title, fn) in enumerate(ICONS):
        s = fn()
        inner = s[s.index("<rect"):s.rindex("</svg>")]
        body.append('<g transform="translate(%d,0)">%s</g>' % (i * 180, inner))
    prev = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="200" viewBox="0 0 %d 200">'
            '<rect width="100%%" height="100%%" fill="#F7F4EC"/>%s</svg>'
            % (len(ICONS) * 180, len(ICONS) * 180, "".join(body)))
    pp = os.path.join(out, "_预览-八角花七枚.svg")
    with open(pp, "w", encoding="utf-8") as f:
        f.write(prev)
    print("written", pp)

if __name__ == "__main__":
    main()
