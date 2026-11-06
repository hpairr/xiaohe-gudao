/* ==========================================================================
   长鼓舞专题 · 基础教学台
   --------------------------------------------------------------------------
   教学片不随仓库发布（原片 18 MB 留在本机 video/04-changgu-basics.mp4），
   线上拿不到文件时自动退成静帧，交互不变：
   1) 点右侧动作名 → 影片跳到该动作起点；播放 → 当前动作、所在组、刻度尺同步。
   2) 原片加载失败（断网、被墙、文件缺失）→ 自动切到同一位置的静帧，
      由 tools/make_video_stills.py 从原片截取，交互不变，只是不播。
   3) 刻度尺按动作起点分布（不是等分），三段色块对应握鼓 / 鼓花 / 步法。
   4) 不自动播放：只在用户点击后 seek + play，符合浏览器自动播放策略。
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_DIR = 'assets/dance-frames/';
  /* 教学片地址。留空 = 用 HTML 里的 ../video/04-changgu-basics.mp4（不进仓库）；
     以后把片子放到 B 站以外的直链或对象存储，填这里就能在页内播，其余不用改。 */
  const VIDEO_SRC = '';
  /* 片长 01:56。读不到 metadata 时用它算刻度尺比例 */
  const TOTAL = 117;
  /* 跳转时略过动作起点，避开上一动作的收势 */
  const LEAD = 0.18;
  /* 静帧对应的取帧偏移，与截图脚本一致 */
  const FRAME_LEAD = 1.0;

  const pad2 = n => String(n).padStart(2, '0');
  const mmss = s => pad2(Math.floor(s / 60)) + ':' + pad2(Math.floor(s % 60));

  function boot() {
    const section = document.querySelector('.bs-section');
    if (!section) return;

    const video = section.querySelector('[data-bs-video]');
    /* 填了外链就改用它；留空则沿用 HTML 里写的本地文件（线上会 404，走静帧兜底） */
    if (video && VIDEO_SRC) video.setAttribute('src', VIDEO_SRC);
    const still = section.querySelector('[data-bs-still]');
    const film = section.querySelector('.bs-film');
    const tape = section.querySelector('[data-bs-tape]');
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

    if ((!video && !still) || !rows.length || !groups.length) return;

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

    let mode = video ? 'video' : 'still';
    let active = -1;
    let pendingSeek = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const framesLoaded = new Set();

    const frameAt = i => FRAME_DIR + pad2(i + 1) + '.jpg';

    function preload(i) {
      if (i < 0 || i >= items.length) return;
      const src = frameAt(i);
      if (framesLoaded.has(src)) return;
      framesLoaded.add(src);
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }

    function duration() {
      if (mode === 'video' && video) {
        const d = video.duration;
        if (isFinite(d) && d > 0) return d;
      }
      return TOTAL;
    }

    /* ---------------------------------------------------------- 刻度尺 */
    function buildTape() {
      if (!tape) return;
      const total = duration();
      const span = Math.max(1, total);
      const at = s => (Math.max(0, Math.min(s, total)) / span * 100).toFixed(3) + '%';

      tape.querySelectorAll('.bs-zone,.bs-tick').forEach(node => node.remove());

      const anchor = tape.querySelector('.bs-fill');

      groups.forEach((g, gi) => {
        const first = members[gi][0];
        const from = g.from || (first ? first.start : 0);
        const nextGroup = groups[gi + 1];
        const next = nextGroup
          ? (nextGroup.from || (members[gi + 1][0] ? members[gi + 1][0].start : total))
          : total;

        const zone = document.createElement('span');
        zone.className = 'bs-zone';
        zone.setAttribute('data-zone', String(gi));
        zone.style.left = at(from);
        zone.style.width = (((Math.min(next, total) - Math.max(from, 0)) / span) * 100).toFixed(3) + '%';

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

    function paintTape(p) {
      if (!tape) return;
      const clamped = Math.max(0, Math.min(1, p));
      tape.style.setProperty('--bs-p', clamped.toFixed(4));
      if (playhead) playhead.style.left = (clamped * 100).toFixed(3) + '%';

      const current = clamped * duration();
      tape.querySelectorAll('.bs-tick').forEach((tick, k) => {
        tick.setAttribute('data-passed', current >= items[k].start - 0.04 ? 'true' : 'false');
        if (k === active) tick.setAttribute('data-on', 'true');
        else tick.removeAttribute('data-on');
      });
      const gi = active >= 0 ? items[active].group : -1;
      tape.querySelectorAll('.bs-zone').forEach((zone, k) => {
        if (k === gi) zone.setAttribute('data-on', 'true');
        else zone.removeAttribute('data-on');
      });
    }

    /* ---------------------------------------------------------- 状态同步 */
    function renderState(idx) {
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

      if (noEl) noEl.textContent = pad2(idx + 1) + ' / ' + items.length;
      if (nameEl) nameEl.textContent = item.name;
      if (timeEl) timeEl.textContent = mmss(item.start);
      if (groupEl) {
        const list = members[gi] || [];
        groupEl.textContent = groups[gi].name + ' · 第 ' + (list.indexOf(item) + 1) + ' / ' + list.length + ' 种';
      }
      if (tipEl) tipEl.textContent = item.tip;
    }

    function sync() {
      if (mode !== 'video' || !video) return;
      const t = video.currentTime || 0;
      const total = duration();

      let idx = 0;
      for (let i = items.length - 1; i >= 0; i--) {
        if (t >= items[i].start - 0.04) { idx = i; break; }
      }
      renderState(idx);
      paintTape(t / Math.max(1, total));
    }

    /* ---------------------------------------------------------- 静帧模式 */
    function selectStill(idx) {
      if (idx < 0 || idx >= items.length) return;
      renderState(idx);
      paintTape((items[idx].start + FRAME_LEAD) / TOTAL);

      if (still) {
        const src = frameAt(idx);
        still.hidden = false;
        if (still.getAttribute('src') !== src) still.setAttribute('src', src);
        still.setAttribute('alt',
          '第 ' + (idx + 1) + ' 个动作「' + items[idx].name + '」：' + (items[idx].tip || '蒋丙莲演示'));
      }

      preload(idx - 1);
      preload(idx + 1);
      if (idx + 2 < items.length) preload(idx + 2);
    }

    function enterStillMode() {
      if (mode === 'still') return;
      mode = 'still';
      try { video.pause(); } catch (err) { /* noop */ }
      if (video) video.hidden = true;
      if (still) still.hidden = false;
      if (film) film.classList.add('is-missing');

      const idx = active >= 0 ? active : 0;
      active = -1;
      buildTape();
      selectStill(idx);
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

    /* ---------------------------------------------------------- 跳转 */
    function seekTo(seconds) {
      if (!video) return;
      const target = Math.max(0, Math.min(seconds, duration() - 0.12));
      pendingSeek = target;
      if (video.readyState >= 1) {
        try { video.currentTime = target; } catch (err) { /* 尚未可 seek */ }
        pendingSeek = null;
        video.play().catch(() => {});
      }
    }

    function go(idx) {
      const item = items[idx];
      if (!item) return;
      revealFilm();

      if (mode === 'still') {
        selectStill(idx);
        return;
      }

      renderState(idx);
      paintTape((item.start + LEAD) / duration());
      seekTo(item.start + LEAD);
    }

    /* ---------------------------------------------------------- 事件 */
    items.forEach(item => {
      item.el.addEventListener('click', () => go(item.i));
    });

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

    /* ---------------------------------------------------------- 启动 */
    buildTape();

    if (mode === 'video') {
      video.addEventListener('loadedmetadata', () => {
        buildTape();
        active = -1;
        if (pendingSeek !== null && video.readyState >= 1) {
          try { video.currentTime = pendingSeek; } catch (err) { /* noop */ }
          pendingSeek = null;
          video.play().catch(() => {});
        }
        sync();
      });
      ['timeupdate', 'seeking', 'seeked', 'play', 'pause', 'ended'].forEach(evt => {
        video.addEventListener(evt, sync);
      });
      video.addEventListener('error', enterStillMode, { once: true });

      sync();
      if (video.error) enterStillMode();
      /* 封面先占着；静帧 01 已在 poster 里，预热相邻几张，断网时切换不闪 */
      preload(1);
    } else {
      selectStill(0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
