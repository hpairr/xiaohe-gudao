# -*- coding: utf-8 -*-
"""
按 Jakobsen 论文重做丝缕的「创建 / 模拟 / 渲染」三层，并修掉四个渲染层错误：

  · 错误1 黄色三角形：SVG 用了 preserveAspectRatio="none"，而 .bead 是个圆 ——
          非等比缩放把圆挤成了菱形。→ 删掉 bead。
  · 错误2 直线乱晃：结点 y 从 0 起，渲染时却整体 +8（vbY0），
          锚点被画到挂结下方 8px，脱开成一小段直线。→ 渲染直接在像素空间做。
  · 错误3 小字：下轨 .mq-bot 留着真词。→ 删掉下轨。
  · 错误4 白边框：丝带区自带 background + border-bottom。→ 去掉。

渲染改为：SVG 与元素**同尺寸（像素即坐标系）**，不再做 viewBox 换算。
"""
import io

P = "index.html"
s = io.open(P, encoding="utf-8").read()


def replace_fn(src, header, new_code):
    start = src.index(header)
    i = src.index("{", start)
    depth = 0
    end = None
    for k in range(i, len(src)):
        if src[k] == "{":
            depth += 1
        elif src[k] == "}":
            depth -= 1
            if depth == 0:
                end = k + 1
                break
    assert end, header
    return src[:start] + new_code + src[end:]


# ---------- ① CSS：去掉 bead 与丝带区的底色/边框 ----------
s = s.replace("  .tas .bead{fill:var(--gold);opacity:.75}\n", "")
s = s.replace(
    """  .tassel{position:relative;height:132px;background:var(--paper);
    border-bottom:1px solid var(--line);overflow:hidden}
  .tassel::before{content:"";position:absolute;inset:0;
    background-image:var(--lattice);pointer-events:none}""",
    """  /* 丝缕区不画自己的底色与边框：它与跑马灯同属一条带子，
     自带 background/border 会切出一条白色横带（实测踩过）。 */
  .tassel{position:relative;height:132px;overflow:hidden}""")

# ---------- ② 删掉下轨（那排小字） ----------
s = s.replace(
    """      <div class="mq-rail"></div>
      <div class="mq-track mq-bot">
        ${mqItems}
      </div>
""",
    """      <div class="mq-rail"></div>
""")
for dead in [
    "  .mq-bot{margin-top:2px;opacity:.5}\n",
    "  .mq-bot .mq-item{padding-inline:var(--sp-10)}\n",
    "  .mq-bot .mq-item .dot{font-size:12px;padding-inline:0;color:var(--ink);opacity:.35}\n",
    "  .mq-bot .mq-item .w{font-size:12px;letter-spacing:0;opacity:.35}\n",
]:
    s = s.replace(dead, "")

# ---------- ③ 创建：SVG 与元素同尺寸，像素即坐标系 ----------
NEW_ENSURE = '''function tasEnsure(){
  const inner = document.getElementById('tasselInner');
  if(!inner) { tasItems = []; return false; }
  if(inner.dataset.built === '1' && tasItems.length) return true;
  tasItems = [];
  inner.dataset.built = '1';
  const W = inner.clientWidth || 1200;
  const H = inner.clientHeight || 132;
  /* 间距 = 跑马灯循环长度 ÷ 循环内应有的点位个数。
     带子横移时按**容器宽度**取模回绕（不能按循环长度，那会绕出屏幕）。 */
  const span = (mqLoop > 0) ? mqLoop / Math.max(1, Math.round(mqLoop / 112)) : 112;
  const count = Math.max(4, Math.floor(W / span) + 1);
  window.__tasW = W;
  const BOXW = 40;                       /* 元素宽：只作结点摆动的活动范围 */
  const DX = BOXW / 2;                   /* 丝的横向中心（元素内坐标） */
  for(let i = 0; i < count; i++){
    const t = count === 1 ? .5 : i / (count - 1);
    const bell = 0.78 + 0.22 * Math.sin(Math.PI * t);   /* 中间略长、两侧略短 */
    const len = Math.min(H * 0.92, H * (0.62 + 0.28 * bell));
    const n = Math.max(4, Math.round(len / TAS_SEG));
    const seg = len / n;                                /* 实际段长，保证总长正好 len */
    const nodes = [], old = [];
    for(let k = 0; k <= n; k++){
      nodes.push(DX, k * seg);                          /* x,y 交错存，避免对象分配 */
      old.push(DX, k * seg);
    }
    const H_ = Math.ceil(len);           /* SVG 与元素同高，见下 */
    const boxH = H_;                     /* 元素高 = SVG 高 → 1 单位 = 1px */
    const el = document.createElement('div');
    el.className = 'tas';
    el.style.height = boxH.toFixed(0) + 'px';
    /* 关键：SVG 宽高与元素一致，viewBox 用同一组数值 → **像素即坐标系**，
       不再有 viewBox 换算，也就不可能出现「圆被挤成菱形」这类非等比形变。 */
    el.innerHTML = '<span class="knot"></span>' +
      '<svg viewBox="0 0 ' + BOXW + ' ' + boxH + '" preserveAspectRatio="none">' +
      '<path class="th" stroke-width="' + (0.8 + 0.6 * bell).toFixed(2) + '" d=""/>' +
      '</svg>';
    inner.appendChild(el);
    tasItems.push({
      el: el, path: el.querySelector('path.th'),
      nodes: nodes, old: old, n: n, seg: seg, L: len, boxH: boxH,
      x0: i * span,
      ph: Math.random() * Math.PI * 2,
      gp: Math.random() * Math.PI * 2,
      g: 0.86 + Math.random() * 0.28,     /* 每根的重力系数 */
      dr: 0.86 + Math.random() * 0.30,    /* 每根的阻力系数 */
      wAmp: 0.70 + Math.random() * 0.60   /* 每根的受风敏感度 */
    });
  }
  return tasItems.length > 0;
}'''
s = replace_fn(s, "function tasEnsure(){", NEW_ENSURE)

# ---------- ④ 渲染：直接用结点像素坐标，画平滑曲线 ----------
NEW_RENDER = '''/* 渲染：结点坐标本来就在像素空间（元素内坐标），直接画。
   用「二次贝塞尔穿过各段中点、以结点为控制点」的常规做法得到平滑曲线。 */
function tasRender(){
  for(let i = 0; i < tasItems.length; i++){
    const it = tasItems[i], nd = it.nodes, n = it.n;
    let d = 'M' + nd[0].toFixed(2) + ' ' + nd[1].toFixed(2);
    if(n < 2){ it.path.setAttribute('d', d); continue; }
    /* 第一段：起点 → 第一段中点（用结点1作控制点） */
    d += ' Q' + nd[2].toFixed(2) + ' ' + nd[3].toFixed(2) + ' ' +
         ((nd[0] + nd[2]) / 2).toFixed(2) + ' ' + ((nd[1] + nd[3]) / 2).toFixed(2);
    /* 中间：逐段以结点为控制点画到下一段中点 */
    for(let k = 1; k < n - 1; k++){
      const p = k << 1, q = p + 2, r = p + 4;
      const mx = (nd[p] + nd[q]) / 2, my = (nd[p + 1] + nd[q + 1]) / 2;
      const mx2 = (nd[q] + nd[r]) / 2, my2 = (nd[q + 1] + nd[r + 1]) / 2;
      d += ' Q' + nd[q].toFixed(2) + ' ' + nd[q + 1].toFixed(2) + ' ' +
           mx2.toFixed(2) + ' ' + my2.toFixed(2);
    }
    /* 收尾：最后一段中点 → 末端结点 */
    const e = n << 1;
    d += ' Q' + nd[e - 2].toFixed(2) + ' ' + nd[e - 1].toFixed(2) + ' ' +
         nd[e].toFixed(2) + ' ' + nd[e + 1].toFixed(2);
    it.path.setAttribute('d', d);
  }
}'''
s = replace_fn(s, "function tasRender(){", NEW_RENDER)

io.open(P, "w", encoding="utf-8", newline="\n").write(s)
left = [w for w in ("bead", "mq-bot", "vbY0", "vbH", "mqItems", "mqItems}") if w in s]
io.open("_fix.txt", "w", encoding="utf-8").write("完成；残留：%s\n" % (left or "无"))
