/* ==========================================================================
   六章专题页：开场接力 + 轻量交互
   --------------------------------------------------------------------------
   1. 从主页点击带来的标题，在整屏主题色上移动到专题页 h1，再渐显信息
   2. motifs.js 的几何只在需要时注入；连续纹样首次切换时才生成
   3. 正文入场只在进入视口时运行，声音波形交给真实音频分析器
   4. prefers-reduced-motion 下跳过所有位移动画，直接显示内容
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const isArriving = root.classList.contains('is-arriving');

  /* ---------- 纹样注入 ---------- */
  const motifKey = () => body.dataset.theme || 'nushu';

  const motifMarkup = key => {
    const lib = window.XiaoheMotif;
    if (!lib) return '';
    return lib.motif(key) || lib.motif('panwang') || lib.motif('nushu') || '';
  };

  const drawAll = scope => {
    if (window.XiaoheMotif && window.XiaoheMotif.drawAll) {
      window.XiaoheMotif.drawAll(scope);
    }
  };

  const fillRepeat = node => {
    if (!node || node.dataset.ready === '1') return;
    const mark = motifMarkup(motifKey());
    if (!mark) return;
    node.innerHTML = Array.from({ length: 9 }, (_, i) => {
      return mark.replace('<svg ', `<svg style="--i:${i}" `);
    }).join('');
    node.dataset.ready = '1';
    drawAll(node);
  };

  const injectMotifs = () => {
    const mark = motifMarkup(motifKey());
    if (!mark) return;
    document.querySelectorAll('[data-motif-unit]').forEach(node => {
      node.innerHTML = mark;
    });
    document.querySelectorAll('[data-motif-repeat]').forEach(node => {
      node.innerHTML = '';
      node.dataset.ready = '0';
    });
    drawAll(document);
  };

  injectMotifs();

  /* ---------- 三种纹样视图 ---------- */
  document.querySelectorAll('.pattern-workbench').forEach(workbench => {
    const stage = workbench.querySelector('.pattern-stage');
    const buttons = [...workbench.querySelectorAll('[data-view]')];
    const modeLabel = workbench.querySelector('.stage-mode');
    if (!stage || !buttons.length) return;

    const names = { unit: 'UNIT / 单元', frame: 'FRAME / 骨架', repeat: 'REPEAT / 连续' };

    const setMode = mode => {
      stage.dataset.mode = mode;
      if (mode === 'repeat') fillRepeat(stage.querySelector('[data-motif-repeat]'));
      buttons.forEach(button => {
        const active = button.dataset.view === mode;
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });
      if (modeLabel) modeLabel.textContent = names[mode] || names.unit;
    };

    buttons.forEach((button, i) => {
      button.addEventListener('click', () => setMode(button.dataset.view));
      button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        setMode(buttons[next].dataset.view);
      });
    });

    setMode(stage.dataset.mode || 'unit');
  });

  /* ---------- 纹样工作台：指针轻微倾斜（仅在精确指针设备） ---------- */
  if (finePointer.matches && !reduce.matches) {
    document.querySelectorAll('.pattern-stage').forEach(stage => {
      let raf = 0;
      let tx = 0;
      let ty = 0;

      const render = () => {
        raf = 0;
        stage.style.setProperty('--tilt-x', tx.toFixed(2) + 'deg');
        stage.style.setProperty('--tilt-y', ty.toFixed(2) + 'deg');
      };

      stage.addEventListener('pointermove', event => {
        const rect = stage.getBoundingClientRect();
        tx = ((event.clientY - rect.top) / rect.height - 0.5) * -3.2;
        ty = ((event.clientX - rect.left) / rect.width - 0.5) * 3.8;
        if (!raf) raf = requestAnimationFrame(render);
      }, { passive: true });

      stage.addEventListener('pointerleave', () => {
        tx = 0;
        ty = 0;
        if (!raf) raf = requestAnimationFrame(render);
      });
    });
  }

  /* ---------- 顶栏状态 ---------- */
  const nav = document.querySelector('.top-nav');
  let ticking = false;
  const readScroll = () => {
    ticking = false;
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 28);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(readScroll);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  readScroll();

  /* ---------- 首屏以下内容轻量入场 ---------- */
  if ('IntersectionObserver' in window && !reduce.matches) {
    const els = [...document.querySelectorAll('.field-head, .field-card, .story-head, .story-body, .sound-copy, .next-chapter')];
    els.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-i', String(i % 6));
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ---------- 专题页开场：标题接力 + 整屏主色渐显 ---------- */
  const finishArrival = () => {
    const veil = document.getElementById('arrivalVeil');
    const clone = document.getElementById('arrivalTitle');
    root.classList.remove('is-arriving', 'is-revealing', 'is-arrival-landed');
    if (veil) veil.style.display = 'none';
    if (clone) clone.style.display = 'none';
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('arrive')) {
        url.searchParams.delete('arrive');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (err) { /* file:// / 隐私模式 */ }
  };

  const runArrival = () => {
    const veil = document.getElementById('arrivalVeil');
    const clone = document.getElementById('arrivalTitle');
    const target = document.querySelector('.theme-hero .hero-title');
    if (!veil || !clone || !target || !root.classList.contains('is-arriving')) {
      finishArrival();
      return;
    }

    const start = () => {
      const range = document.createRange();
      range.selectNodeContents(target);
      const targetRect = range.getBoundingClientRect();
      const targetStyle = getComputedStyle(target);

      clone.style.letterSpacing = targetStyle.letterSpacing;
      clone.style.left = '50%';
      clone.style.top = '50%';
      clone.style.transform = 'translate(-50%,-50%)';
      void clone.offsetWidth;

      let cloneRect = clone.getBoundingClientRect();
      clone.style.left = cloneRect.left + 'px';
      clone.style.top = cloneRect.top + 'px';
      clone.style.transform = 'none';

      const cloneRange = document.createRange();
      cloneRange.selectNodeContents(clone);
      cloneRect = cloneRange.getBoundingClientRect();

      const cloneFont = parseFloat(getComputedStyle(clone).fontSize) || 100;
      const targetFont = parseFloat(targetStyle.fontSize) || cloneFont;
      const scale = targetFont / cloneFont;
      const dx = targetRect.left + targetRect.width / 2 - (cloneRect.left + cloneRect.width / 2);
      const dy = targetRect.top + targetRect.height / 2 - (cloneRect.top + cloneRect.height / 2);

      requestAnimationFrame(() => {
        // 先在整屏主色上把标题送到目标位置，再渐显页面信息，避免边移动边重绘整页。
        clone.animate([
          { transform: 'translate3d(0,0,0) scale(1)' },
          { transform: `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${scale.toFixed(4)})` }
        ], { duration: 680, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });

        window.setTimeout(() => {
          root.classList.add('is-arrival-landed', 'is-revealing');
          window.setTimeout(() => {
            clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
            window.setTimeout(finishArrival, 140);
          }, 560);
        }, 680);
      });
    };

    const wait = () => window.setTimeout(start, 40);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(wait);
    else wait();
  };

  if (isArriving) {
    if (reduce.matches) finishArrival();
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runArrival, { once: true });
    else runArrival();
  }

  /* ---------- 键盘可达性：焦点进入首屏时顶栏保持可读 ---------- */
  document.addEventListener('focusin', event => {
    if (!nav || !event.target.closest) return;
    if (event.target.closest('.theme-hero')) nav.classList.remove('is-scrolled');
  });
})();
