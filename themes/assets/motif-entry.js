/* 专题页首屏图案 → 图案分层解释页（motifs-layers.html）
   ------------------------------------------------------------
   用法不变：<script src="assets/motif-entry.js" data-motif-index="0" defer></script>
   data-motif-index：0 女书 / 1 蝴蝶歌 / 2 长鼓舞 / 3 富川风雨桥 / 4 盘王大歌 / 5 瑶族织锦

   过场只有三件事，颜色一路不变（底色 = 这一页的 --main，详情页也用这个色）：
     ① 一层「底色圆盘」从图案正中长开，把这一页的字句/版式全部盖掉；
     ② 图案本身一直看得见 —— 它从首屏位置挪到画面正中、放大到详情页的尺寸；
     ③ 圆长满的那一帧换页，详情页第一帧就是这个样子。

   2026-11-07 按实测改过三处（数据见 _measure/motif-transition/README.md）：
     · 去掉圆边那根 1px 细线。它除了扎眼，每帧还要写 width/height，
       是这段过场里唯一的布局触发点。
     · 克隆层不再带 clip-path 过渡。七张全尺寸图每帧各重绘一次，是这段
       过场里最贵的一笔；出场模板一律按「已跑完」处理。
     · 圆铺满立刻换页，不再多等 60ms 静止画面；并在悬停时预取详情页文档，
       把跨文档那一段空档压掉（慢网实测 click→内容 1304ms → 857ms）。

   prefers-reduced-motion：直接跳。
   ------------------------------------------------------------ */
(function () {
  'use strict';

  var me = document.currentScript;
  if (!me) return;
  var idx = parseInt(me.getAttribute('data-motif-index'), 10);
  if (isNaN(idx) || idx < 0 || idx > 5) return;

  var art = document.querySelector('.hero-art');
  var stack = art && art.querySelector('.hero-stack');
  if (!art || !stack) return;

  var KEYS = ['nushu', 'butterfly', 'drum', 'bridge', 'panwang', 'brocade'];
  var PLATES = ['m1-nushu', 'm2-butterfly', 'm3-drum', 'm4-bridge', 'm5-panwang', 'm6-brocade'];
  var layers = stack.querySelectorAll('.hero-layer');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var busy = false;

  /* 详情页 URL 只在一处拼：预取和跳转必须是同一个地址，才对得上缓存 */
  function target() { return '../motifs-layers.html?theme=' + KEYS[idx]; }

  var CSS = [
    '.hero-art.is-motif-entry{cursor:pointer;outline:none}',
    '.hero-art.is-motif-entry .hero-stack{transition:transform .55s cubic-bezier(.22,.61,.36,1)}',
    '.hero-art.is-motif-entry:hover .hero-stack,',
    '.hero-art.is-motif-entry:focus .hero-stack{transform:scale(1.028)}',
    '.hero-art.is-motif-entry:focus-visible{outline:1px solid var(--on,currentColor);outline-offset:12px}',
    /* 过场：底色圆盘 + 图案；图案在圆盘之上，全程可见 */
    '.motif-enter{position:fixed;inset:0;z-index:9998;overflow:hidden;pointer-events:none}',
    '.motif-enter .me-disc{position:absolute;inset:0}',
    '.motif-enter .me-stage{position:absolute;left:0;top:0;transform-origin:50% 50%;will-change:transform}',
    '.motif-enter .me-stage img{position:absolute;inset:0;width:100%;height:100%;display:block}',
    /* 过场里这一页的字句先淡出，图案才不会从字上面碾过去 */
    'html.is-motif-leaving .top-nav,html.is-motif-leaving .hero-copy,',
    'html.is-motif-leaving .hero-footer,html.is-motif-leaving .edge-nav,',
    'html.is-motif-leaving .menu,html.is-motif-leaving .arrival-title,',
    'html.is-motif-leaving .arrival-veil{',
    '  opacity:0 !important;pointer-events:none;transition:opacity .42s ease !important}',
    '@media (prefers-reduced-motion:reduce){.motif-enter{display:none}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  art.classList.add('is-motif-entry');
  art.setAttribute('role', 'link');
  art.setAttribute('tabindex', '0');
  art.setAttribute('aria-label', '打开这一幅的分层解释');

  /* 悬停时把详情页要用的整图预热好（只下一次，约 250~340KB），
     并把详情页文档本身也预取掉 —— 换页时就不用现等一次往返。 */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    var im = new Image();
    im.src = '../assets/img/motifs/' + PLATES[idx] + '.webp';
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = target();
    document.head.appendChild(link);
  }
  art.addEventListener('pointerenter', warm, { once: true });
  art.addEventListener('focus', warm, { once: true });

  art.addEventListener('click', function (e) { e.preventDefault(); enter(); });
  art.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      enter();
    }
  });

  function go() { location.href = target(); }

  function enter() {
    if (busy) return;
    busy = true;
    if (reduced.matches) { go(); return; }

    var r = stack.getBoundingClientRect();
    var vw = innerWidth, vh = innerHeight, wide = vw >= 1000;

    /* 详情页图案的落点：与 motifs-layers.html 的 layout() 同一套公式 */
    var pad = Math.min(64, Math.max(20, vw * 0.044));
    var metaW = Math.min(180, Math.max(140, vw * 0.13));
    var panelW = Math.min(310, Math.max(250, vw * 0.22));
    var side = pad + Math.max(metaW, panelW) + 20;
    var size = wide ? Math.round(Math.min(vh * 0.80, vw - 2 * side))
                    : Math.round(Math.min(vh * 0.46, vw * 0.94));
    var cx = vw / 2, cy = wide ? vh * 0.5 : vh * 0.28;

    var c0x = r.left + r.width / 2, c0y = r.top + r.height / 2;
    var dx = cx - c0x, dy = cy - c0y;
    var k = size / r.width;
    var r1 = Math.hypot(vw, vh) / 2 + 24;

    var cs = getComputedStyle(document.documentElement);
    var bg = (cs.getPropertyValue('--main') || '').trim() || '#1D2652';

    document.documentElement.classList.add('is-motif-leaving');
    var ov = document.createElement('div');
    ov.className = 'motif-enter';
    var disc = document.createElement('div');
    disc.className = 'me-disc';
    disc.style.background = bg;
    var stage = document.createElement('div');
    stage.className = 'me-stage';
    stage.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;background:' + bg + ';' +
      'transform:translate3d(' + r.left + 'px,' + r.top + 'px,0)';

    /* 把这一幅的各层搬进来。出场动画（layerIris 的圆形模板）一律按「已跑完」处理：
       这里不再给克隆层加 clip-path，也不再逐帧改它 —— 每帧改一张全尺寸图的
       clip-path 都要重绘那一整张图，七层就是七次。真在动画中途点进来时，
       图层直接完整出现，比看到一个卡在半路的圆更不容易出错。 */
    Array.prototype.slice.call(layers).forEach(function (im) {
      var cl = im.cloneNode(false);
      cl.style.cssText = 'animation:none;transition:none;clip-path:none;opacity:' + getComputedStyle(im).opacity;
      stage.appendChild(cl);
    });

    ov.appendChild(disc);
    ov.appendChild(stage);
    document.body.appendChild(ov);
    /* 原图立刻让位：克隆的那一份就压在它上面，尺寸位置一模一样，看不出换过 */
    stack.style.visibility = 'hidden';

    disc.style.clipPath = 'circle(0px at ' + c0x + 'px ' + c0y + 'px)';

    var DUR = 820, start = performance.now();
    /* 两端都慢：圆先从一个点长起，收尾时一起落定 */
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

    function tick(now) {
      var p = Math.min(1, (now - start) / DUR);
      var e = ease(p);
      var rr = r1 * e;
      disc.style.clipPath = 'circle(' + rr.toFixed(2) + 'px at ' + c0x + 'px ' + c0y + 'px)';
      stage.style.transform = 'translate3d(' + (r.left + dx * e).toFixed(2) + 'px,' +
        (r.top + dy * e).toFixed(2) + 'px,0) scale(' + (1 + (k - 1) * e).toFixed(5) + ')';
      /* 圆铺满的那一帧就换页。原来还多等 60ms，屏幕是静止的，
         正好接上跨文档导航的空档，读起来就是「卡住一下」。 */
      if (p < 1) requestAnimationFrame(tick);
      else go();
    }
    requestAnimationFrame(tick);
  }
})();
