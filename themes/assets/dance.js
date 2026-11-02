/* ==========================================================================
   长鼓舞专题 · 基础教学台（静帧版）
   --------------------------------------------------------------------------
   线上不再挂教学片（18 MB，仓库里没有），改用从原片逐帧截下的二十一张静帧：
   1) 点右侧动作名 → 左侧换成该动作的静帧，读数、分组、刻度尺同步。
   2) 静帧按动作起点排，刻度尺用 01:56 的原始时间轴，位置关系与原片一致。
   3) 左右方向键 / 上下方向键在动作表内换动作，Home / End 到首尾。
   4) 无 JS 时左侧保留第一张静帧，动作表与时间码照常可读（渐进增强）。
   图由 tools/make_video_stills.py 生成，动作时间点仍以 HTML 的 data-start 为准。
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_DIR = 'assets/dance-frames/';
  /* 教学片全长 117 s = 01:56，只用来算刻度尺比例 */
  const TOTAL = 117;
  /* 取帧时略过动作起点，避开上一动作的收势（与截图脚本的 +1.0s 同一套逻辑） */
  const FRAME_LEAD = 1.0;

  const pad2 = n => String(n).padStart(2, '0');
  const mmss = s => pad2(Math.floor(s / 60)) + ':' + pad2(Math.floor(s % 60));

  function boot() {
    const section = document.querySelector('.bs-section');
    if (!section) return;

    const still = section.querySelector('[data-bs-still]');
    const film = section.querySelector('.bs-film');
    const tape = section.querySelector('[data-bs-tape]');
    const fill = tape ? tape.querySelector('.bs-fill') : null;
    const playhead = tape ? tape.querySelector('.bs-play') : null;

    const noEl = section.querySelector('[data-bs-no]');
    const nameEl = section.querySelector('[data-bs-name]');
    const timeEl = section.querySelector('[data-bs-time]');
    const groupEl = section.querySelector('[data-bs-group]');
    const tipEl = section.querySelector('[data-bs-tip]');

    const rows = Array.prototype.slice.call(section.querySelectorAll('.bs-row'));

    const groups = Array.prototype.slice.call(section.querySelectorAll('.bs-group')).map(el => {
      const head = el.querySelector('.bs-group-head b');
      return {
        el: el,
        name: head ? head.textContent.trim() : '',
        from: Number(el.getAttribute('data-from')) || 0
      };
    });

    if (!still || !rows.length || !groups.length) return;

    const items = rows.map((el, i) => {
      const name = el.querySelector('.bs-row-name');
      const rawGroup = Number(el.getAttribute('data-group'));
      return {
        el: el,
        i: i,
        start: Number(el.getAttribute('data-start')) || 0,
        group: isNaN(rawGroup) ? 0 : rawGroup,
        name: name ? name.textContent.trim() : '',
        tip: el.getAttribute('data-tip') || ''
      };
    });

    const members = groups.map((_, gi) => items.filter(it => it.group === gi));

    let active = -1;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const loaded = new Set();

    const frameAt = i => FRAME_DIR + pad2(i + 1) + '.jpg';

    function preload(i) {
      if (i < 0 || i >= items.length) return;
      const src = frameAt(i);
      if (loaded.has(src)) return;
      loaded.add(src);
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }

    /* ---------------------------------------------------------- 刻度尺 */
    function buildTape() {
      if (!tape) return;
      const at = s => (Math.max(0, Math.min(s, TOTAL)) / TOTAL * 100).toFixed(3) + '%';
      const anchor = fill || null;

      tape.querySelectorAll('.bs-zone,.bs-tick').forEach(node => node.remove());

      groups.forEach((g, gi) => {
        const first = members[gi][0];
        const from = g.from || (first ? first.start : 0);
        const nextGroup = groups[gi + 1];
        const next = nextGroup
          ? (nextGroup.from || (members[gi + 1][0] ? members[gi + 1][0].start : TOTAL))
          : TOTAL;

        const zone = document.createElement('span');
        zone.className = 'bs-zone';
        zone.setAttribute('data-zone', String(gi));
        zone.style.left = at(from);
        zone.style.width = (((Math.min(next, TOTAL) - Math.max(from, 0)) / TOTAL) * 100).toFixed(3) + '%';

        const label = document.createElement('b');
        label.textContent = g.name;
        zone.appendChild(label);
        tape.insertBefore(zone, anchor);
      });

      items.forEach(it => {
        const tick = document.createElement('i');
        tick.className = 'bs-tick';
        tick.setAttribute('data-i', String(it.i));
        tick.style.left = at(it.start);
        tape.insertBefore(tick, anchor);
      });
    }

    /* ---------------------------------------------------------- 选中一张 */
    function setActive(idx) {
      if (idx < 0 || idx >= items.length) return;
      active = idx;

      for (let i = 0; i < items.length; i++) {
        items[i].el.setAttribute('aria-current', i === idx ? 'true' : 'false');
      }

      const item = items[idx];
      const gi = item.group;

      groups.forEach((g, k) => {
        if (k === gi) g.el.setAttribute('data-on', 'true');
        else g.el.removeAttribute('data-on');
      });

      if (tape) {
        /* 刻度尺不再跟着播放走，只标出「当前动作在整支片子的哪个位置」 */
        const p = Math.max(0, Math.min(1, (item.start + FRAME_LEAD) / TOTAL));
        tape.style.setProperty('--bs-p', p.toFixed(4));
        if (playhead) playhead.style.left = (p * 100).toFixed(3) + '%';

        tape.querySelectorAll('.bs-zone').forEach((zone, k) => {
          if (k === gi) zone.setAttribute('data-on', 'true');
          else zone.removeAttribute('data-on');
        });
        tape.querySelectorAll('.bs-tick').forEach((tick, k) => {
          tick.setAttribute('data-passed', k <= idx ? 'true' : 'false');
          if (k === idx) tick.setAttribute('data-on', 'true');
          else tick.removeAttribute('data-on');
        });
      }

      if (noEl) noEl.textContent = pad2(idx + 1) + ' / ' + items.length;
      if (nameEl) nameEl.textContent = item.name;
      if (timeEl) timeEl.textContent = mmss(item.start);
      if (groupEl) {
        const list = members[gi] || [];
        groupEl.textContent = groups[gi].name + ' · 第 ' + (list.indexOf(item) + 1) + ' / ' + list.length + ' 种';
      }
      if (tipEl) tipEl.textContent = item.tip;

      const src = frameAt(idx);
      if (still.getAttribute('src') !== src) still.setAttribute('src', src);
      still.setAttribute('alt',
        '第 ' + (idx + 1) + ' 个动作「' + item.name + '」：' + (item.tip || '蒋丙莲演示'));

      preload(idx - 1);
      preload(idx + 1);
      if (idx + 2 < items.length) preload(idx + 2);
    }

    /* ---------------------------------------------------------- 视口 */
    function filmHidden() {
      if (!film) return false;
      const rect = film.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return rect.top < 68 || rect.bottom > vh - 16;
    }

    function revealFilm() {
      if (!film || !filmHidden()) return;
      film.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'center'
      });
    }

    function go(idx) {
      setActive(idx);
      revealFilm();
    }

    /* ---------------------------------------------------------- 事件 */
    items.forEach(item => {
      item.el.addEventListener('click', () => go(item.i));
    });

    /* 键盘：方向键在 21 个动作里走，避免 Tab 二十一次 */
    const index = section.querySelector('.bs-index');
    if (index) {
      index.addEventListener('keydown', e => {
        const start = items.findIndex(it => it.el === document.activeElement);
        let next = start;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(items.length - 1, start + 1);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, start - 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        else return;

        if (next === start || next < 0) return;
        e.preventDefault();
        items[next].el.focus();
        go(next);
      });
    }

    buildTape();
    setActive(0);
    preload(1);
    preload(2);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
