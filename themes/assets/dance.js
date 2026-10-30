/* ==========================================================================
   长鼓舞专题 · 基础教学台
   --------------------------------------------------------------------------
   1) 二十一个动作与教学片双向对齐：点动作 → 视频跳到该秒；播放 → 当前动作、
      所在组、刻度尺同步亮起。
   2) 刻度尺按动作起点分布（不是等分），三段色块对应握鼓 / 鼓花 / 步法。
   3) 影片走本地 video/04-changgu-basics.mp4；读不到时露出原片链接，不写死失败态。
   4) 不自动播放；只在用户点击后 seek + play，天然符合浏览器自动播放策略。
   ========================================================================== */
(() => {
  'use strict';

  /* 本地教学片（约 18 MB，不进仓库）。若换线上直链，只改这一行。 */
  const VIDEO_SRC = '../video/04-changgu-basics.mp4';
  /* 原片出处：读不到本地文件时显示的退路 */
  const FALLBACK_URL = 'https://www.douyin.com/video/7287820631314337080';
  /* 读不到 metadata 时先用片长占位（117 s），拿到后再重排刻度 */
  const FALLBACK_DURATION = 117;
  /* 跳转时略过动作起点，避开上一动作的收势 */
  const LEAD = 0.18;

  const pad2 = n => String(n).padStart(2, '0');
  const mmss = s => pad2(Math.floor(s / 60)) + ':' + pad2(Math.floor(s % 60));

  function boot() {
    const section = document.querySelector('.bs-section');
    if (!section) return;

    const video = section.querySelector('[data-bs-video]');
    const film = section.querySelector('.bs-film');
    const fallback = section.querySelector('[data-bs-fallback]');
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

    if (!rows.length || !groups.length) return;

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
    let pendingSeek = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function duration() {
      const d = video && video.duration;
      return isFinite(d) && d > 0 ? d : FALLBACK_DURATION;
    }

    /* ---------------------------------------------------------- 刻度尺 */
    function buildTape() {
      if (!tape) return;
      const total = duration();
      const span = Math.max(1, total);
      const at = s => (Math.max(0, Math.min(s, total)) / span * 100).toFixed(3) + '%';

      tape.querySelectorAll('.bs-zone,.bs-tick').forEach(node => node.remove());

      const anchor = fill || null;

      groups.forEach((g, gi) => {
        const first = members[gi][0];
        const from = g.from || (first ? first.start : 0);
        const nextGroup = groups[gi + 1];
        const next = nextGroup ? (nextGroup.from || (members[gi + 1][0] ? members[gi + 1][0].start : total)) : total;

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

    function markTicks(t) {
      if (!tape) return;
      const ticks = tape.querySelectorAll('.bs-tick');
      for (let i = 0; i < ticks.length; i++) {
        const passed = t >= items[i].start - 0.04 ? 'true' : 'false';
        if (ticks[i].getAttribute('data-passed') !== passed) {
          ticks[i].setAttribute('data-passed', passed);
        }
      }
    }

    /* ---------------------------------------------------------- 状态同步 */
    function setActive(idx) {
      if (idx === active) return;
      active = idx;

      for (let i = 0; i < items.length; i++) {
        items[i].el.setAttribute('aria-current', i === idx ? 'true' : 'false');
      }

      const item = items[idx];
      if (!item) return;
      const gi = item.group;

      groups.forEach((g, k) => {
        if (k === gi) g.el.setAttribute('data-on', 'true');
        else g.el.removeAttribute('data-on');
      });

      if (tape) {
        tape.querySelectorAll('.bs-zone').forEach((zone, k) => {
          if (k === gi) zone.setAttribute('data-on', 'true');
          else zone.removeAttribute('data-on');
        });
        tape.querySelectorAll('.bs-tick').forEach((tick, k) => {
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
    }

    function sync() {
      if (!video) return;
      const t = video.currentTime || 0;
      const total = duration();
      const p = Math.max(0, Math.min(1, t / Math.max(1, total)));

      if (tape) {
        tape.style.setProperty('--bs-p', p.toFixed(4));
        if (playhead) playhead.style.left = (p * 100).toFixed(3) + '%';
        markTicks(t);
      }

      let idx = 0;
      for (let i = items.length - 1; i >= 0; i--) {
        if (t >= items[i].start - 0.04) { idx = i; break; }
      }
      setActive(idx);
    }

    /* ---------------------------------------------------------- 点击跳转 */
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
      setActive(idx);
      revealFilm();
      seekTo(item.start + LEAD);
    }

    /* ---------------------------------------------------------- 影片事件 */
    if (video) {
      video.addEventListener('loadedmetadata', () => {
        buildTape();
        /* 刻度重建后 data-on / data-passed 归零，强制下一次同步重画 */
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
      video.addEventListener('error', () => {
        if (fallback) fallback.hidden = false;
        if (film) film.classList.add('is-missing');
        if (fallback) {
          const link = fallback.querySelector('a');
          if (link) link.href = FALLBACK_URL;
        }
      });
    }

    items.forEach(item => {
      item.el.addEventListener('click', () => go(item.i));
    });

    buildTape();
    if (video) {
      video.src = VIDEO_SRC;
    }
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
