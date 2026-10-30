/* ==========================================================================
   潇贺古道有声文化数据库 · 主题纹样库（浏览器端）
   --------------------------------------------------------------------------
   与 scripts/build.py（Node 版生成器）共用同一套几何：
     · 外框  八角连弧纹 —— 圆心(80,80)、外半径 64、8 顶点跳 3 位相连、
             每条边沿「垂直弦、背离中心」方向内压 0.25×弦长（弦长 118.26）
             得到边中点半径 54.06 —— 凹口深 10
     · 内芯  六个主题各自的辨识焦点（依据 A毕设图形/10-主题视觉转化研究报告.md）
   用法：
     // file:// 下 <script type="module"> 会被 CORS 拦，务必用普通 <script>
     document.getElementById('motif').innerHTML = XiaoheMotif.nushu();
     XiaoheMotif.drawAll();          // 量一次描线长度，交给 CSS 描线动画
   ========================================================================== */
(function (global) {
  'use strict';

  var C = 80, R = 64, BULGE = 0.25;
  var ORDER = [0, 3, 6, 1, 4, 7, 2, 5];
  var TAU = Math.PI * 2;

  var COL = {
    ink: '#1F2D3D', inkSoft: '#5B6B7C', qun: '#3A5BA0', cinnabar: '#C3272B',
    gold: '#D9A13B', tianshui: '#5CAC9E', paper: '#F7F4EC', night: '#1A1F2B',
    nightLine: '#4A5875'
  };

  var SANS = 'Noto Sans SC,Source Han Sans SC,Microsoft YaHei,PingFang SC,sans-serif';

  function fx(n) { return Math.round(n * 100) / 100; }

  function vtx(n, r) {
    r = r == null ? R : r;
    var a = (45 * n) * Math.PI / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  }

  /* 每条边的三点定圆：两端点 + 内凹中点 */
  function edgeArc(i, j) {
    var p = vtx(i), q = vtx(j);
    var dx = q[0] - p[0], dy = q[1] - p[1];
    var chord = Math.sqrt(dx * dx + dy * dy);
    var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    var nx = -dy / chord, ny = dx / chord;
    if (nx * (C - mx) + ny * (C - my) > 0) { nx = -nx; ny = -ny; }
    var b = BULGE * chord;
    var bx = mx + nx * b, by = my + ny * b;
    var ax = p[0], ay = p[1], cx3 = q[0], cy3 = q[1];
    var d = 2 * (ax * (by - cy3) + bx * (cy3 - ay) + cx3 * (ay - by));
    var ux = ((ax * ax + ay * ay) * (by - cy3) + (bx * bx + by * by) * (cy3 - ay) +
      (cx3 * cx3 + cy3 * cy3) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx3 - bx) + (bx * bx + by * by) * (ax - cx3) +
      (cx3 * cx3 + cy3 * cy3) * (bx - ax)) / d;
    var r = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
    return {
      o: [ux, uy], r: r,
      a0: Math.atan2(ay - uy, ax - ux),
      a1: Math.atan2(cy3 - uy, cx3 - ux),
      am: Math.atan2(by - uy, bx - ux),
      mx: bx, my: by
    };
  }

  function arcFlags(ta, tb, tm) {
    function norm(x) { while (x <= -Math.PI) { x += TAU; } while (x > Math.PI) { x -= TAU; } return x; }
    for (var s = 0; s < 2; s++) {
      var sweep = s === 0 ? 1 : 0;
      var d = norm(tb - ta);
      d = sweep === 0 ? (d > 0 ? d - TAU : d) : (d < 0 ? d + TAU : d);
      var dm = norm(tm - ta);
      dm = sweep === 0 ? (dm > 0 ? dm - TAU : dm) : (dm < 0 ? dm + TAU : dm);
      if ((d > 0 && dm >= 0 && dm <= d) || (d < 0 && dm <= 0 && dm >= d)) {
        return [(Math.abs(d) > Math.PI ? 1 : 0), sweep];
      }
    }
    return [0, 1];
  }

  /* 八角连弧外框：八条边首尾相接的 path */
  function framePath() {
    var d = '';
    for (var k = 0; k < 8; k++) {
      var i = ORDER[k], j = ORDER[(k + 1) % 8];
      var e = edgeArc(i, j);
      var p = vtx(i), q = vtx(j);
      var f = arcFlags(e.a0, e.a1, e.am);
      if (k === 0) { d += 'M ' + fx(p[0]) + ' ' + fx(p[1]) + ' '; }
      d += 'A ' + fx(e.r) + ' ' + fx(e.r) + ' 0 ' + f[0] + ' ' + f[1] + ' ' + fx(q[0]) + ' ' + fx(q[1]) + ' ';
    }
    return d + 'Z';
  }

  var FRAME_D = framePath();

  function oct(r, cx, cy, rot) {
    cx = cx == null ? C : cx; cy = cy == null ? C : cy;
    rot = rot == null ? 22.5 : rot;
    var s = [];
    for (var k = 0; k < 8; k++) {
      var a = (rot + 45 * k) * Math.PI / 180;
      s.push(fx(cx + r * Math.sin(a)) + ',' + fx(cy - r * Math.cos(a)));
    }
    return s.join(' ');
  }

  /* 内芯：统一按 160 画布作画，再整体缩放适配外框
     fit = 内芯最大半径（以画布中心计）→ 缩到 ~46，保证不压到边框 */
  var LIMIT = 46;

  function wrap(coreSvg, fit, dark, extraAttrs) {
    var scale = fit > 0 ? LIMIT / fit : 1;
    var attrs = extraAttrs || '';
    var style = dark ? ' style="background:' + COL.night + '"' : '';
    return '<svg class="motif"' + attrs + ' viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"' +
      ' role="img" aria-label="八角花主题纹样"' + style + '>' +
      (dark ? '<rect width="160" height="160" fill="' + COL.night + '"/>' : '') +
      '<g fill="none" stroke-linejoin="round">' +
      '<path class="motif-frame" d="' + FRAME_D + '" stroke="' + (dark ? COL.gold : COL.ink) + '" stroke-width="2.1"/>' +
      '<g class="motif-core" transform="translate(80 80) scale(' + fx(scale) + ') translate(-80 -80)" ' +
      'stroke-linecap="round">' + coreSvg + '</g>' +
      '</g></svg>';
  }

  function circle(cls, x, y, r, fill, sw) {
    return '<circle class="' + cls + '" cx="' + fx(x) + '" cy="' + fx(y) + '" r="' + fx(r) + '" fill="' + fill + '"' +
      (sw ? ' stroke="' + COL.paper + '" stroke-width="' + sw + '"' : '') + '/>';
  }
  function path(cls, d, stroke, sw, extra) {
    return '<path class="' + cls + '" d="' + d + '" stroke="' + stroke + '" stroke-width="' + sw + '"' +
      (extra ? ' ' + extra : '') + '/>';
  }

  /* ======================================================================
     六枚主题内芯（+ 备用盘王印）
     ====================================================================== */

  /* 1 潇贺古道 · 折线路带 + 马蹄印 —— 辨识焦点：线 > 印 */
  function coreRoad() {
    var g = [], ang = 12 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    function P(u, v) { return [C + u * ca - v * sa, C + u * sa + v * ca]; }
    var a = P(-50, -10.5), b = P(50, -10.5), c = P(50, 10.5), dd = P(-50, 10.5);
    g.push(path('draw road-edge', 'M ' + fx(a[0]) + ' ' + fx(a[1]) + ' L ' + fx(b[0]) + ' ' + fx(b[1]),
      COL.inkSoft, 1.5, 'stroke-dasharray="2 5"'));
    g.push(path('road-edge', 'M ' + fx(c[0]) + ' ' + fx(c[1]) + ' L ' + fx(dd[0]) + ' ' + fx(dd[1]),
      COL.inkSoft, 1.5, 'stroke-dasharray="2 5"'));
    var cols = [[-47, -18], [-16, 13], [15, 44]];
    for (var row = 0; row < 3; row++) {
      var v0 = -7 + row * 7, shift = row === 1 ? 0 : 7;
      for (var ci = 0; ci < cols.length; ci++) {
        var u0 = cols[ci][0] + shift, u1 = cols[ci][1] + shift;
        var p1 = P(u0, v0 - 3), p2 = P(u1, v0 - 3), p3 = P(u1, v0 + 3), p4 = P(u0, v0 + 3);
        g.push(path('slab', 'M ' + fx(p1[0]) + ' ' + fx(p1[1]) + ' L ' + fx(p2[0]) + ' ' + fx(p2[1]) +
          ' L ' + fx(p3[0]) + ' ' + fx(p3[1]) + ' L ' + fx(p4[0]) + ' ' + fx(p4[1]) + ' Z', COL.ink, 1.4));
      }
    }
    var hoof = [[-26, 4.6, 0], [20, 5.4, 0.5], [43, 3.9, 1.1]];
    for (var h = 0; h < hoof.length; h++) {
      var pt = P(hoof[h][0], 0), s = hoof[h][1];
      g.push(path('hoof', 'M ' + fx(pt[0] + s * 0.72) + ' ' + fx(pt[1] - s * 0.70) +
        ' A ' + fx(s * 1.05) + ' ' + fx(s * 1.05) + ' 0 1 1 ' + fx(pt[0] + s * 0.72) + ' ' + fx(pt[1] - s * 0.70),
        COL.cinnabar, 2.4, 'style="--delay:' + hoof[h][2] + 's"'));
      g.push(circle('', pt[0], pt[1], 1.3, COL.cinnabar));
    }
    [-55, 55].forEach(function (u, i) {
      var pt = P(u, 0), col = i === 0 ? COL.cinnabar : COL.ink;
      g.push('<rect x="' + fx(pt[0] - 3.5) + '" y="' + fx(pt[1] - 3.5) + '" width="7" height="7" fill="' + col +
        '" transform="rotate(45 ' + fx(pt[0]) + ' ' + fx(pt[1]) + ')"/>');
    });
    return { svg: g.join(''), fit: 59.2 };
  }

  /* 2 女书 · 长菱形字（点/竖/斜/弧四笔）+ 3×3 字帖格 —— 辨识焦点：字形 */
  function coreNushu() {
    var g = [], step = 30, idx = 0;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        var cx = C + (c - 1) * step, cy = C + (r - 1) * step;
        var hw = 11, hh = 13.5, empty = (r === 2 && c === 2);
        g.push(path(empty ? 'cell empty' : 'cell',
          'M ' + cx + ' ' + fx(cy - hh) + ' L ' + fx(cx + hw) + ' ' + cy + ' L ' + cx + ' ' + fx(cy + hh) +
          ' L ' + fx(cx - hw) + ' ' + cy + ' Z', COL.ink, empty ? 1.2 : 1.4,
          empty ? 'stroke-dasharray="3 4"' : ''));
        if (empty) { g.push(circle('rise', cx, cy, 1.8, COL.cinnabar, 1.2)); continue; }
        var k = idx % 4, dl = (idx * 0.08).toFixed(2);
        if (k === 0) {
          g.push(circle('pop', cx, cy - 2, 2.2, COL.qun));
          g.push(circle('pop', cx + 2.6, cy + 3.4, 1.5, COL.qun));
        } else if (k === 1) {
          g.push(path('draw stroke', 'M ' + cx + ' ' + fx(cy - 8) + ' L ' + cx + ' ' + fx(cy + 8),
            COL.qun, 2.8, 'style="--delay:' + dl + 's"'));
        } else if (k === 2) {
          g.push(path('draw stroke', 'M ' + fx(cx - 5.5) + ' ' + fx(cy + 6.5) + ' L ' + fx(cx + 5.5) + ' ' + fx(cy - 6.5),
            COL.qun, 2.8, 'style="--delay:' + dl + 's"'));
        } else {
          g.push(path('draw stroke', 'M ' + fx(cx - 5.5) + ' ' + fx(cy + 5.5) + ' Q ' + fx(cx + 2.5) + ' ' +
            fx(cy + 1.5) + ' ' + fx(cx + 5.0) + ' ' + fx(cy - 6.0), COL.qun, 2.8, 'style="--delay:' + dl + 's"'));
        }
        idx++;
      }
    }
    g.push('<rect x="' + fx(C - 3) + '" y="' + fx(C - 3) + '" width="6" height="6" fill="' + COL.cinnabar +
      '" transform="rotate(45 ' + C + ' ' + C + ')"/>');
    return { svg: g.join(''), fit: 52.8 };
  }

  /* 3 蝴蝶歌 · 双翅「分→合」 —— 辨识焦点：结构 > 翅形 */
  function coreButterfly() {
    var g = [], th = 42 * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    var raw = [[8, -26], [-9, -17], [8, 0], [11, -14]], pts = raw.map(function (p) {
      return [C + p[0] * ct - p[1] * st, C + p[0] * st + p[1] * ct];
    });
    var p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    [1, -1].forEach(function (sg) {
      var d = 'M ' + C + ' ' + C +
        ' Q ' + fx(C + sg * (p1[0] - C)) + ' ' + fx(C + sg * (p1[1] - C)) +
        ' ' + fx(C + sg * (p0[0] - C)) + ' ' + fx(C + sg * (p0[1] - C)) +
        ' Q ' + fx(C + sg * (p3[0] - C)) + ' ' + fx(C + sg * (p3[1] - C)) +
        ' ' + fx(p2[0]) + ' ' + fx(p2[1]) + ' Z';
      g.push(path('draw wing', d, COL.qun, 2.8, 'style="--len:150"'));
    });
    g.push(path('', 'M ' + C + ' ' + fx(C - 15) + ' L ' + C + ' ' + fx(C + 9), COL.inkSoft, 1.4,
      'stroke-dasharray="2 4"'));
    [[-9, 9], [-1, 13], [7, 10], [-14, 4], [13, 3]].forEach(function (p, i) {
      g.push('<circle class="pop" style="animation-delay:' + fx(i * 0.12) + 's" cx="' + (C + p[0]) +
        '" cy="' + (C + p[1]) + '" r="1.9" fill="' + COL.gold + '"/>');
    });
    g.push(path('converge', 'M ' + fx(C - 15) + ' ' + fx(C - 34) + ' Q ' + fx(C - 9) + ' ' + fx(C - 20) + ' ' + C + ' ' + fx(C - 9),
      COL.cinnabar, 2.2, 'style="--dur:3.2s"'));
    g.push(path('converge', 'M ' + fx(C + 15) + ' ' + fx(C - 34) + ' Q ' + fx(C + 9) + ' ' + fx(C - 20) + ' ' + C + ' ' + fx(C - 9),
      COL.cinnabar, 2.2, 'style="--dur:3.2s"'));
    g.push(circle('fizz', C, C - 9, 2.1, COL.cinnabar));
    return { svg: g.join(''), fit: 37.2 };
  }

  /* 4 长鼓舞 · 细腰沙漏鼓 + 鼓点 —— 辨识焦点：外轮廓 */
  function coreDrum() {
    var g = [], wt = 21, ww = 10, yt = C - 40, yw = C, yb = C + 40;
    g.push(path('draw shell', 'M ' + fx(C - ww) + ' ' + yw +
      ' C ' + fx(C - ww - 1.8) + ' ' + (C - 20) + ' ' + fx(C - wt) + ' ' + (yt + 10) + ' ' + fx(C - wt) + ' ' + yt +
      ' L ' + fx(C + wt) + ' ' + yt +
      ' C ' + fx(C + wt) + ' ' + (yt + 10) + ' ' + fx(C + ww + 1.8) + ' ' + (C - 20) + ' ' + fx(C + ww) + ' ' + yw +
      ' Z', COL.qun, 2.8, 'style="--len:220"'));
    g.push(path('draw shell', 'M ' + fx(C + ww) + ' ' + yw +
      ' C ' + fx(C + ww + 1.8) + ' ' + (C + 20) + ' ' + fx(C + wt) + ' ' + (yb - 10) + ' ' + fx(C + wt) + ' ' + yb +
      ' L ' + fx(C - wt) + ' ' + yb +
      ' C ' + fx(C - wt) + ' ' + (yb - 10) + ' ' + fx(C - ww - 1.8) + ' ' + (C + 20) + ' ' + fx(C - ww) + ' ' + yw +
      ' Z', COL.qun, 2.8, 'style="--len:220"'));
    [yt, yb].forEach(function (yy) {
      g.push(path('', 'M ' + fx(C - wt) + ' ' + yy + ' Q ' + C + ' ' + fx(yy - 5.5) + ' ' + fx(C + wt) + ' ' + yy +
        ' Q ' + C + ' ' + fx(yy + 5.5) + ' ' + fx(C - wt) + ' ' + yy, COL.ink, 1.5));
    });
    g.push(path('', 'M ' + fx(C - ww) + ' ' + yw + ' L ' + fx(C + ww) + ' ' + yw, COL.gold, 2.2));
    [[-30, -11, 0.0], [-19, 15, 1.15], [19, -9, 0.62], [30, 14, 1.5]].forEach(function (b) {
      g.push('<circle class="beat" style="--dur:1.05s;--delay:' + b[2] + 's" cx="' + (C + b[0]) + '" cy="' +
        (C + b[1]) + '" r="3.4" fill="' + COL.cinnabar + '"/>');
    });
    g.push(path('', 'M ' + fx(C - 38) + ' ' + fx(C + 2) + ' A 38 38 0 0 1 ' + fx(C + 38) + ' ' + fx(C + 2),
      COL.inkSoft, 1.4, 'stroke-dasharray="3 4"'));
    for (var k = 0; k < 4; k++) {
      var a = (200 + k * 46.7) * Math.PI / 180;
      g.push(circle('pop', C + 38 * Math.cos(a), C + 2 + 9 * Math.sin(a), 2.1, COL.qun));
    }
    g.push(path('sway', 'M ' + fx(C - 8) + ' ' + fx(C - 20) + ' C ' + fx(C + 6) + ' ' + fx(C - 6) + ' ' +
      fx(C - 6) + ' ' + fx(C + 6) + ' ' + fx(C + 8) + ' ' + fx(C + 20), COL.cinnabar, 2.2,
      'style="--dur:3.6s"'));
    return { svg: g.join(''), fit: 45.4 };
  }

  /* 5 风雨桥 · 三孔拱 + 木廊 + 重檐阁楼 —— 辨识焦点：侧影 > 孔数 */
  function coreBridge() {
    var g = [], yd = C - 10, yb = C + 18;
    [[38, 38, 13], [62, 98, 22], [122, 122, 13]].forEach(function (ar) {
      var xl = ar[0], xr = ar[1], rad = ar[2], cy0 = yd + 7;
      g.push(path('draw arch', 'M ' + xl + ' ' + cy0 + ' A ' + rad + ' ' + rad + ' 0 0 1 ' + xr + ' ' + cy0,
        COL.ink, 2.4, 'style="--len:120"'));
      g.push(path('', 'M ' + xl + ' ' + cy0 + ' L ' + xl + ' ' + yb, COL.ink, 1.5));
      g.push(path('', 'M ' + xr + ' ' + cy0 + ' L ' + xr + ' ' + yb, COL.ink, 1.5));
    });
    g.push(path('draw deck', 'M ' + (C - 46) + ' ' + yb + ' L ' + (C + 46) + ' ' + yb, COL.qun, 2.8,
      'style="--len:92"'));
    g.push('<rect x="' + (C - 38) + '" y="' + (yd - 16) + '" width="76" height="16" fill="none" stroke="' +
      COL.qun + '" stroke-width="2.6"/>');
    [-30, -10, 10, 30].forEach(function (dx) {
      g.push(path('', 'M ' + (C + dx) + ' ' + (yd - 16) + ' L ' + (C + dx) + ' ' + yd, COL.ink, 1.5));
    });
    [[0, 27, 5], [22, 19, 7]].forEach(function (e) {
      var dy = e[0], hw = e[1], ev = e[2], yy = yd - 16 - dy;
      g.push(path('draw roof', 'M ' + fx(C - hw) + ' ' + yy + ' L ' + fx(C - hw * .55) + ' ' + fx(yy - 11) +
        ' L ' + fx(C - hw * .38) + ' ' + yy, COL.qun, 2.6, 'style="--len:70"'));
      g.push(path('draw roof', 'M ' + fx(C - hw) + ' ' + yy + ' L ' + fx(C - hw - ev * .8) + ' ' + fx(yy - ev) +
        ' L ' + fx(C - hw * .55) + ' ' + fx(yy - 11), COL.qun, 2.6, 'style="--len:60"'));
      g.push(path('draw roof', 'M ' + fx(C + hw) + ' ' + yy + ' L ' + fx(C + hw * .55) + ' ' + fx(yy - 11) +
        ' L ' + fx(C + hw * .38) + ' ' + yy, COL.qun, 2.6, 'style="--len:70"'));
      g.push(path('draw roof', 'M ' + fx(C + hw) + ' ' + yy + ' L ' + fx(C + hw + ev * .8) + ' ' + fx(yy - ev) +
        ' L ' + fx(C + hw * .55) + ' ' + fx(yy - 11), COL.qun, 2.6, 'style="--len:60"'));
    });
    g.push(path('', 'M ' + (C - 10) + ' ' + (yd - 16) + ' L ' + (C - 8) + ' ' + (yd - 34) + ' L ' + (C + 8) + ' ' +
      (yd - 34) + ' L ' + (C + 10) + ' ' + (yd - 16), COL.ink, 1.5));
    g.push(path('', 'M ' + C + ' ' + (yd - 44) + ' L ' + C + ' ' + (yd - 48), COL.gold, 2));
    [5, 10].forEach(function (o, i) {
      var w = 34 - i * 8, yy = yb + o;
      g.push(path('wave', 'M ' + (C - w) + ' ' + yy + ' Q ' + (C - w / 2) + ' ' + (yy - 4) + ' ' + C + ' ' + yy +
        ' T ' + (C + w) + ' ' + yy, COL.tianshui, 1.8, 'style="--delay:' + (i * .4) + 's"'));
    });
    return { svg: g.join(''), fit: 60.3 };
  }

  /* 5b 富川织锦 · 经纬带 + 菱形显花 + 阶梯折线 —— 辨识焦点：织纹结构 */
  function coreBrocade() {
    var g = [];
    for (var row = 0; row < 4; row++) {
      var y = C - 33 + row * 22;
      g.push(path('weft', 'M ' + (C - 48) + ' ' + y + ' L ' + (C + 48) + ' ' + y,
        COL.gold, 1.2, 'stroke-dasharray="2 4"'));
      g.push(path('weft', 'M ' + (C - 48) + ' ' + (y + 12) + ' L ' + (C + 48) + ' ' + (y + 12),
        COL.inkSoft, 1.2, 'stroke-dasharray="2 4"'));
      for (var col = 0; col < 5; col++) {
        var x = C - 40 + col * 20;
        g.push(path('lozenge', 'M ' + x + ' ' + (y + 1) + ' L ' + (x + 7) + ' ' + (y + 6) +
          ' L ' + x + ' ' + (y + 11) + ' L ' + (x - 7) + ' ' + (y + 6) + ' Z',
          col % 2 ? COL.qun : COL.cinnabar, 1.8));
        g.push(path('stitch', 'M ' + x + ' ' + (y + 4) + ' L ' + x + ' ' + (y + 8),
          COL.paper, 1, 'opacity=".68"'));
      }
      if (row < 3) {
        var y2 = y + 18;
        g.push(path('step', 'M ' + (C - 42) + ' ' + y2 + ' L ' + (C - 30) + ' ' + y2 +
          ' L ' + (C - 30) + ' ' + (y2 + 4) + ' L ' + (C - 18) + ' ' + (y2 + 4) +
          ' L ' + (C - 18) + ' ' + y2 + ' L ' + C + ' ' + y2,
          COL.inkSoft, 1.3));
        g.push(path('step', 'M ' + C + ' ' + y2 + ' L ' + (C + 12) + ' ' + y2 +
          ' L ' + (C + 12) + ' ' + (y2 + 4) + ' L ' + (C + 24) + ' ' + (y2 + 4) +
          ' L ' + (C + 24) + ' ' + y2 + ' L ' + (C + 42) + ' ' + y2,
          COL.inkSoft, 1.3));
      }
    }
    g.push('<polygon points="' + oct(17) + '" fill="none" stroke="' + COL.gold + '" stroke-width="1.7"/>');
    g.push('<rect x="' + (C - 4) + '" y="' + (C - 4) + '" width="8" height="8" fill="' + COL.cinnabar +
      '" transform="rotate(45 ' + C + ' ' + C + ')"/>');
    return { svg: g.join(''), fit: 60 };
  }

  /* 6 上灯炸龙 · 八角灯 + 光点龙 + 放射火花 —— 辨识焦点：光点 > 灯 */
  function coreDragon() {
    var g = [], hub = [C, C - 4];
    g.push('<polygon points="' + oct(31, hub[0], hub[1]) + '" fill="none" stroke="' + COL.gold + '" stroke-width="2.2"/>');
    g.push('<polygon points="' + oct(19, hub[0], hub[1]) + '" fill="none" stroke="' + COL.gold + '" stroke-width="1.4" opacity=".75"/>');
    for (var k = 0; k < 8; k++) {
      var a = (22.5 + 45 * k) * Math.PI / 180;
      g.push(path('', 'M ' + fx(hub[0] + 19 * Math.sin(a)) + ' ' + fx(hub[1] - 19 * Math.cos(a)) +
        ' L ' + fx(hub[0] + 31 * Math.sin(a)) + ' ' + fx(hub[1] - 31 * Math.cos(a)), COL.gold, 1.2,
        'opacity=".6"'));
    }
    var path6 = [[C + 28, C - 44], [C + 8, C - 29], [C - 14, C - 13], [C - 26, C + 5],
      [C - 10, C + 22], [C + 15, C + 31], [C + 33, C + 46]];
    var dots = [];
    for (var i = 0; i < path6.length - 1; i++) {
      [0, 0.34, 0.67].forEach(function (t) {
        dots.push([path6[i][0] + (path6[i + 1][0] - path6[i][0]) * t,
        path6[i][1] + (path6[i + 1][1] - path6[i][1]) * t]);
      });
    }
    dots.push(path6[path6.length - 1]);
    dots.forEach(function (p, i) {
      var r = Math.max(4.0 - 1.7 * (i / dots.length), 1.6);
      var col = (i % 3 === 0) ? COL.cinnabar : COL.gold;
      g.push('<circle class="fizz" style="--dur:' + fx(0.7 + (i % 5) * 0.12) + 's;--delay:' + fx(i * 0.09) +
        's" cx="' + fx(p[0]) + '" cy="' + fx(p[1]) + '" r="' + fx(r) + '" fill="' + col + '"/>');
    });
    g.push(circle('', dots[0][0], dots[0][1], 6.0, COL.cinnabar));
    g.push(circle('', dots[0][0] + 3.4, dots[0][1] - 1.5, 2.2, COL.paper));
    for (var s = 0; s < 12; s++) {
      var aa = (s * 30 + 14) * Math.PI / 180;
      g.push(path('fizz', 'M ' + fx(C + 34 * Math.cos(aa)) + ' ' + fx(C + 34 * Math.sin(aa)) +
        ' L ' + fx(C + 50 * Math.cos(aa)) + ' ' + fx(C + 50 * Math.sin(aa)), COL.cinnabar, 1.6,
        'style="--dur:' + fx(0.8 + (s % 4) * 0.15) + 's;--delay:' + fx(s * 0.07) + 's"'));
    }
    return { svg: g.join(''), fit: 52.0, dark: true };
  }

  /* 备用：盘王印 · 外方内八角 */
  function corePanwang() {
    var g = [];
    g.push('<rect x="' + (C - 38) + '" y="' + (C - 38) + '" width="76" height="76" fill="none" stroke="' + COL.qun + '" stroke-width="2.8"/>');
    g.push('<rect x="' + (C - 33) + '" y="' + (C - 33) + '" width="66" height="66" fill="none" stroke="' + COL.ink + '" stroke-width="1.4"/>');
    g.push('<polygon points="' + oct(26) + '" fill="none" stroke="' + COL.qun + '" stroke-width="2.6"/>');
    g.push('<polygon points="' + oct(14) + '" fill="none" stroke="' + COL.ink + '" stroke-width="1.4"/>');
    g.push('<polygon points="' + C + ',' + (C - 10.5) + ' ' + (C + 7.5) + ',' + C + ' ' + C + ',' + (C + 10.5) + ' ' +
      (C - 7.5) + ',' + C + '" fill="none" stroke="' + COL.cinnabar + '" stroke-width="2.4"/>');
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
      var x0 = C + s[0] * 29, y0 = C + s[1] * 29;
      g.push(path('', 'M ' + x0 + ' ' + y0 + ' L ' + (x0 - s[0] * 5) + ' ' + y0 + ' L ' + (x0 - s[0] * 5) + ' ' +
        (y0 - s[1] * 5) + ' L ' + (x0 - s[0] * 10) + ' ' + (y0 - s[1] * 5) + ' L ' + (x0 - s[0] * 10) + ' ' + y0,
        COL.ink, 1.4));
    });
    return { svg: g.join(''), fit: 53.7 };
  }

  var CORES = {
    road: coreRoad, nushu: coreNushu, butterfly: coreButterfly,
    drum: coreDrum, bridge: coreBridge, brocade: coreBrocade,
    dragon: coreDragon, panwang: corePanwang
  };

  function motif(key, attrs) {
    var f = CORES[key];
    if (!f) { return ''; }
    var r = f();
    return wrap(r.svg, r.fit, r.dark, attrs);
  }

  /* 只有外框的小八角花：用于「构造过程」四格与变体格 */
  function frameOnly(scale, color) {
    scale = scale || 0.5;
    var c = color || COL.ink;
    return '<svg class="mini" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
      'style="width:100%;height:auto">' +
      '<g transform="translate(30 30) scale(' + fx(scale * 60 / 160) + ') translate(-80 -80)" fill="none">' +
      '<path d="' + FRAME_D + '" stroke="' + c + '" stroke-width="' + fx(2.2 / scale) + '"/>' +
      '</g></svg>';
  }

  /* 装饰带：一排小八角花 + 中心色点（用于段落之间） */
  function band(count, accent) {
    count = count || 7;
    var one = 40, gap = 26, w = count * one + (count - 1) * gap;
    var s = '<svg viewBox="0 0 ' + w + ' 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
      'style="display:block;width:100%;max-width:' + w + 'px;height:auto">';
    for (var i = 0; i < count; i++) {
      var x = i * (one + gap);
      s += '<g transform="translate(' + x + ',4) scale(' + fx(one / 160) + ')">' +
        '<path d="' + FRAME_D + '" fill="none" stroke="' + COL.ink + '" stroke-width="3.6" opacity=".42"/>' +
        '<circle cx="80" cy="80" r="15" fill="' + (accent || COL.cinnabar) + '" opacity=".5"/>' +
        '</g>';
    }
    return s + '</svg>';
  }

  /* 描线动画的 --len 与实际路径长度对齐（CSS 里给的只是估算） */
  function drawAll(root) {
    var scope = root || document;
    var paths = scope.querySelectorAll('.motif .draw');
    for (var i = 0; i < paths.length; i++) {
      try {
        var L = paths[i].getTotalLength();
        if (L) { paths[i].style.setProperty('--len', L.toFixed(0)); }
      } catch (e) { /* 某些环境无 getTotalLength，保留 CSS 估算值 */ }
    }
  }

  /* 菱形格底纹（45° 菱形网格，全站母题） */
  function latticeSvg(w, h, step, stroke, opacity) {
    step = step || 26; stroke = stroke || 'rgba(29,38,82,.10)';
    var d = '', x;
    for (x = -h; x < w + h; x += step) {
      d += 'M ' + x + ' 0 L ' + (x + h) + ' ' + h + ' M ' + x + ' ' + h + ' L ' + (x + h) + ' 0 ';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true" ' +
      'style="position:absolute;inset:0;width:100%;height:100%;opacity:' + (opacity == null ? 1 : opacity) + '">' +
      '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="1"/></svg>';
  }

  global.XiaoheMotif = {
    frame: FRAME_D, motif: motif, frameOnly: frameOnly, band: band,
    drawAll: drawAll, latticeSvg: latticeSvg, colors: COL, octagon: oct
  };
})(window);
