/* ==========================================================================
   风雨桥 · 一场雨
   --------------------------------------------------------------------------
   SVG 画结构与标签，canvas 只画雨。
   雨带自动横扫；可用鼠标/触摸拖、或键盘拖滑块接管。
   落点由屋顶折线决定：廊顶范围内停在屋面，其余落到桥面。
   ========================================================================== */
(() => {
  'use strict';

  const VB = { w: 1200, h: 460 };
  const DECK_Y = 320;
  /* 屋面折线：左檐 (272,240) → 脊 (600,170) → 右檐 (928,240) */
  const ROOF = { x0: 272, y0: 240, ridge: 600, yRidge: 170, x1: 928 };
  const BAND = 300;
  const COUNT = 64;

  function roofY(x) {
    if (x < ROOF.x0 || x > ROOF.x1) return DECK_Y;
    if (x <= ROOF.ridge) {
      return ROOF.y0 + ((x - ROOF.x0) / (ROOF.ridge - ROOF.x0)) * (ROOF.yRidge - ROOF.y0);
    }
    return ROOF.yRidge + ((x - ROOF.ridge) / (ROOF.x1 - ROOF.ridge)) * (ROOF.y0 - ROOF.yRidge);
  }

  function pingpong(v, lo, hi) {
    const span = hi - lo;
    const m = (((v - lo) % (span * 2)) + span * 2) % (span * 2);
    return lo + (m <= span ? m : span * 2 - m);
  }

  function init(section) {
    const stage = section.querySelector('.rain-stage');
    const inner = section.querySelector('.rain-inner');
    const canvas = section.querySelector('.rain-canvas');
    const range = section.querySelector('.rain-range');
    const read = section.querySelector('[data-rain-read]');
    if (!stage || !inner || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const drops = [];
    for (let i = 0; i < COUNT; i++) {
      drops.push({
        off: (i + Math.random() * 0.85) * (BAND / COUNT),
        speed: 520 + Math.random() * 320,
        phase: Math.random()
      });
    }

    let center = 120;
    let auto = !reduced;
    let last = 0;
    let cssW = 0;
    let cssH = 0;
    let inkColor = 'currentColor';

    function readInk() {
      const v = getComputedStyle(stage).color;
      if (v) inkColor = v;
    }

    function resize() {
      const r = inner.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = r.width;
      cssH = r.height;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readInk();
      draw(performance.now());
    }

    function syncState() {
      const onRoof = center > ROOF.x0 && center < ROOF.x1;
      stage.classList.toggle('is-dry', onRoof);
      if (read) {
        read.textContent = onRoof
          ? '雨落在廊顶 · 廊下的桥面是干的'
          : '雨落在桥头 · 这一段没有屋顶';
      }
      if (range && document.activeElement !== range) {
        range.value = String(Math.round(center));
      }
    }

    function draw(t) {
      if (!cssW || !cssH) return;
      const sx = cssW / VB.w;
      const sy = cssH / VB.h;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = Math.max(1, 1.2 * sx);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.66;

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const x = center - BAND / 2 + d.off;
        if (x < -8 || x > VB.w + 8) continue;

        const stop = roofY(x);
        const p = reduced
          ? ((d.phase + d.off / BAND) % 1)
          : (((t / 1000) * d.speed / VB.h + d.phase) % 1);

        const y = p * stop;
        const len = reduced ? 10 : 12;

        ctx.beginPath();
        ctx.moveTo(x * sx, Math.max(0, y - len) * sy);
        ctx.lineTo(x * sx, y * sy);
        ctx.stroke();

        /* 打在屋面上的雨：收尾处一道短横，表示被挡开 */
        if (p > 0.93 && stop < DECK_Y) {
          ctx.beginPath();
          ctx.moveTo((x - 4) * sx, (stop - 2) * sy);
          ctx.lineTo((x + 4) * sx, (stop - 2) * sy);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      const dt = last ? Math.min(t - last, 64) : 16;
      last = t;
      if (auto) {
        center = pingpong(center + dt * 0.17, 40, 1160);
        syncState();
      }
      draw(t);
      requestAnimationFrame(frame);
    }

    function centerFromEvent(ev) {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return center;
      const x = ((ev.clientX - r.left) / r.width) * VB.w;
      return Math.max(0, Math.min(VB.w, x));
    }

    canvas.addEventListener('pointerdown', (ev) => {
      auto = false;
      if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
      center = centerFromEvent(ev);
      syncState();
      draw(performance.now());
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!canvas.hasPointerCapture || !canvas.hasPointerCapture(ev.pointerId)) return;
      center = centerFromEvent(ev);
      syncState();
      draw(performance.now());
    });

    canvas.addEventListener('pointerup', (ev) => {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
    });

    if (range) {
      range.addEventListener('input', () => {
        auto = false;
        const v = Number(range.value);
        if (Number.isFinite(v)) center = Math.max(0, Math.min(VB.w, v));
        syncState();
        draw(performance.now());
      });
    }

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(inner);
    } else {
      window.addEventListener('resize', resize);
    }

    resize();
    syncState();
    if (!reduced) requestAnimationFrame(frame);
  }

  function boot() {
    document.querySelectorAll('.rain-section').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
