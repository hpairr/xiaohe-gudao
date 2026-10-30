/* ==========================================================================
   潇贺古道 · 六章声音播放器
   --------------------------------------------------------------------------
   · 音频以 MP3 短片段存放在 assets/audio/，同时生成 data/<key>.js 的 base64。
   · Web Audio API 解码 + AnalyserNode 分析，波形来自正在播放的声音。
   · 关闭自动播放：声音只在用户点击播放键时开始，滚动与首次点击都不会出声。
   · 播放、切换、结束都走 GainNode 渐变，不是硬切。
   · 数据脚本只在需要播放时加载；file:// 下也能解码分析。
   ========================================================================== */
(() => {
  'use strict';

  /* 自动播放总开关：false = 必须手动点播放键 */
  const AUTOPLAY = false;

  const META = {
    nushu: {
      title: '金坨女',
      sub: '女书歌曲 · 35 秒选段',
      credit: 'B站 · BV1QTrTY2EAF',
      href: 'https://www.bilibili.com/video/BV1QTrTY2EAF/'
    },
    butterfly: {
      title: '流水欢歌迎客来',
      sub: '蝴蝶歌现场 · 35 秒选段',
      credit: 'B站 · BV1B8411S74T',
      href: 'https://www.bilibili.com/video/BV1B8411S74T/'
    },
    drum: {
      title: '汪嘟',
      sub: '瑶族长鼓舞 · 35 秒选段',
      credit: 'B站 · BV1pZKszGEtK',
      href: 'https://www.bilibili.com/video/BV1pZKszGEtK/'
    },
    bridge: {
      title: '风雨桥边',
      sub: '富川推广曲 · 35 秒选段',
      credit: 'B站 · BV14b4y1U7su',
      href: 'https://www.bilibili.com/video/BV14b4y1U7su/'
    },
    panwang: {
      title: '万段曲',
      sub: '盘王大歌 · 35 秒选段',
      credit: 'B站 · BV1JUyABpEbb',
      href: 'https://www.bilibili.com/video/BV1JUyABpEbb/'
    },
    brocade: {
      title: '瑶族织锦现场声',
      sub: '织机与讲述 · 30 秒选段',
      credit: 'B站 · BV1K34y1e7wh',
      href: 'https://www.bilibili.com/video/BV1K34y1e7wh/'
    }
  };

  const body = document.body;
  const audioBase = (body.dataset.audioBase || 'assets/audio/').replace(/\/?$/, '/');
  const dataCache = Object.create(null);
  const players = [];
  let audioContext = null;
  let autoUnlocked = false;
  let unlockPromise = null;
  let autoScheduled = false;
  let lastAutoKey = '';

  const formatTime = value => {
    const safe = Math.max(0, Math.floor(Number(value) || 0));
    return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0');
  };

  const getContext = () => {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('AudioContext unavailable');
      audioContext = new Ctx();
    }
    return audioContext;
  };

  const loadData = key => {
    if (window.XiaoheAudioData && window.XiaoheAudioData[key]) {
      return Promise.resolve(window.XiaoheAudioData[key]);
    }
    if (dataCache[key]) return dataCache[key];

    dataCache[key] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = audioBase + 'data/' + key + '.js';
      script.onload = () => {
        if (window.XiaoheAudioData && window.XiaoheAudioData[key]) {
          resolve(window.XiaoheAudioData[key]);
        } else {
          reject(new Error('Audio data missing: ' + key));
        }
      };
      script.onerror = () => reject(new Error('Audio data script failed: ' + key));
      document.head.appendChild(script);
    });
    return dataCache[key];
  };

  const decodeDataUrl = async (dataUrl, context) => {
    const binary = atob(dataUrl.split(',')[1] || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Promise((resolve, reject) => {
      const task = context.decodeAudioData(bytes.buffer, resolve, reject);
      if (task && task.then) task.then(resolve, reject);
    });
  };

  const makePlayer = el => {
    const chapter = el.closest('.chapter');
    const stageCopy = el.closest('.stage-copy');
    const key = el.dataset.key || (chapter && chapter.dataset.c);
    const meta = META[key];
    if (!key || !meta) return null;

    const bars = [];
    const count = el.classList.contains('audio-player--theme') ? 88 : 46;
    el.innerHTML = [
      '<button class="audio-player__toggle" type="button" aria-pressed="false" aria-label="播放 ' + meta.title + '">',
      '<span class="audio-player__icon" aria-hidden="true"></span>',
      '</button>',
      '<div class="audio-player__body">',
      '<div class="audio-player__head"><b>' + meta.title + '</b><span>' + meta.sub + '</span></div>',
      '<div class="audio-player__wave" aria-hidden="true"></div>',
      '<div class="audio-player__foot"><span class="audio-player__status" role="status" aria-live="polite">未播放</span>',
      '<a class="audio-player__credit" href="' + meta.href + '" target="_blank" rel="noopener">' + meta.credit + '</a></div>',
      '</div>',
      '<span class="audio-player__time">00:00</span>'
    ].join('');

    const toggle = el.querySelector('.audio-player__toggle');
    const wave = el.querySelector('.audio-player__wave');
    const status = el.querySelector('.audio-player__status');
    const time = el.querySelector('.audio-player__time');

    for (let i = 0; i < count; i++) {
      const bar = document.createElement('i');
      const idle = (0.15 + 0.38 * Math.abs(Math.sin((i + 1) * 0.63))).toFixed(3);
      bar.style.setProperty('--idle', idle);
      bar.style.transform = 'scaleY(' + idle + ')';
      wave.appendChild(bar);
      bars.push(bar);
    }

    const player = {
      el,
      key,
      meta,
      chapter,
      stageCopy,
      isChapter: !!chapter,
      isStage: !!stageCopy,
      toggle,
      bars,
      status,
      time,
      buffer: null,
      source: null,
      analyser: null,
      gain: null,
      data: null,
      levels: new Array(count).fill(0.15),
      offset: 0,
      startedAt: 0,
      playing: false,
      loading: false,
      finished: false,
      userPaused: false,
      raf: 0,
      stopTimer: 0
    };

    const setStatus = text => {
      if (status) status.textContent = text;
    };

    const setBarsIdle = () => {
      player.bars.forEach((bar, i) => {
        const idle = bar.style.getPropertyValue('--idle') || '0.15';
        player.levels[i] = Number(idle);
        bar.style.transform = 'scaleY(' + idle + ')';
      });
    };

    const setPlayingUI = playing => {
      el.classList.toggle('is-playing', playing);
      toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
      toggle.setAttribute('aria-label', (playing ? '暂停 ' : '播放 ') + meta.title);
    };

    const draw = () => {
      if (!player.playing || !player.analyser) return;
      player.analyser.getByteFrequencyData(player.data);
      const bins = player.data.length;
      for (let i = 0; i < player.bars.length; i++) {
        const pos = i / Math.max(1, player.bars.length - 1);
        const bin = Math.min(bins - 1, Math.round(1 + Math.pow(pos, 1.5) * bins * 0.72));
        const target = player.data[bin] / 255;
        player.levels[i] = target > player.levels[i] ? target : player.levels[i] * 0.82;
        const level = 0.06 + player.levels[i] * 0.94;
        player.bars[i].style.transform = 'scaleY(' + level.toFixed(3) + ')';
      }
      const duration = player.buffer ? player.buffer.duration : 0;
      const elapsed = Math.min(duration, Math.max(0, audioContext.currentTime - player.startedAt));
      player.time.textContent = formatTime(elapsed);
      player.raf = requestAnimationFrame(draw);
    };

    const stopDraw = () => {
      cancelAnimationFrame(player.raf);
      player.raf = 0;
      setBarsIdle();
    };

    const pause = ({ auto = false } = {}) => {
      if (!player.playing) return;
      const ctx = audioContext;
      const now = ctx.currentTime;
      player.offset = player.buffer ? Math.min(player.buffer.duration, Math.max(0, now - player.startedAt)) : 0;
      player.playing = false;

      if (player.gain) {
        const gain = player.gain.gain;
        if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
        else {
          gain.cancelScheduledValues(now);
          gain.setValueAtTime(Math.max(0.0001, gain.value), now);
        }
        gain.linearRampToValueAtTime(0.0001, now + 0.55);
      }

      const source = player.source;
      if (source) {
        source.onended = null;
        try { source.stop(now + 0.58); } catch (err) { /* already stopped */ }
        window.clearTimeout(player.stopTimer);
        player.stopTimer = window.setTimeout(() => {
          if (player.source === source) player.source = null;
        }, 620);
      }

      setPlayingUI(false);
      stopDraw();
      setStatus(auto ? '自动播放已暂停' : '已暂停');
    };

    const finish = () => {
      player.playing = false;
      player.offset = 0;
      player.source = null;
      player.finished = true;
      setPlayingUI(false);
      stopDraw();
      setStatus('播放完毕');
      player.time.textContent = '00:00';
    };

    const ensureBuffer = async () => {
      if (player.buffer) return player.buffer;
      const ctx = getContext();
      const dataUrl = await loadData(key);
      player.buffer = await decodeDataUrl(dataUrl, ctx);
      return player.buffer;
    };

    const play = async ({ auto = false } = {}) => {
      if (auto && !AUTOPLAY) return false;
      if (player.loading) return false;
      if (player.playing) return true;

      players.forEach(other => {
        if (other !== player && other.playing) other.pause({ auto: true });
      });

      try {
        player.loading = true;
        player.finished = false;
        player.userPaused = false;
        el.classList.add('is-loading');
        el.classList.remove('is-unavailable', 'needs-gesture');
        setStatus(auto ? '正在自动载入声音…' : '正在载入声音…');
        toggle.disabled = true;

        const ctx = getContext();
        if (ctx.state !== 'running') await ctx.resume();
        if (ctx.state !== 'running') {
          const blocked = new Error('AudioContext is suspended');
          blocked.name = 'NotAllowedError';
          throw blocked;
        }

        const buffer = await ensureBuffer();
        if (!player.analyser) {
          player.analyser = ctx.createAnalyser();
          player.analyser.fftSize = 256;
          player.analyser.smoothingTimeConstant = 0.76;
          player.gain = ctx.createGain();
          player.gain.gain.value = 0.0001;
          player.analyser.connect(player.gain);
          player.gain.connect(ctx.destination);
          player.data = new Uint8Array(player.analyser.frequencyBinCount);
        }

        if (player.source) {
          try { player.source.stop(); } catch (err) { /* already stopped */ }
          player.source = null;
        }
        window.clearTimeout(player.stopTimer);
        if (player.offset >= buffer.duration - 0.08) player.offset = 0;

        const now = ctx.currentTime;
        const gain = player.gain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0.0001, now);
        const fadeIn = Math.min(1.15, Math.max(0.35, buffer.duration - player.offset));
        gain.linearRampToValueAtTime(0.9, now + fadeIn);

        const remaining = buffer.duration - player.offset;
        if (remaining > 2.2) {
          const fadeStart = now + remaining - 1.35;
          if (fadeStart > now + fadeIn) gain.setValueAtTime(0.9, fadeStart);
          gain.linearRampToValueAtTime(0.0001, now + remaining);
        } else {
          gain.linearRampToValueAtTime(0.0001, now + Math.max(0.35, remaining));
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(player.analyser);
        source.start(0, player.offset);
        player.source = source;
        player.startedAt = ctx.currentTime - player.offset;
        player.playing = true;
        player.loading = false;
        el.classList.remove('is-loading');
        el.classList.add('is-ready');
        toggle.disabled = false;
        setPlayingUI(true);
        setStatus(auto ? '实时分析' : '实时分析中');
        source.onended = () => {
          if (player.playing && player.source === source) finish();
        };
        draw();
        return true;
      } catch (err) {
        player.loading = false;
        player.playing = false;
        el.classList.remove('is-loading', 'is-playing');
        toggle.disabled = false;
        setPlayingUI(false);
        if (err.name === 'NotAllowedError' || err.name === 'InvalidStateError') {
          el.classList.add('needs-gesture');
          setStatus('加载失败，请重试');
        } else {
          el.classList.add('is-unavailable');
          toggle.disabled = true;
          setStatus('音频不可用');
        }
        return false;
      }
    };

    toggle.addEventListener('click', async () => {
      if (player.playing) {
        player.userPaused = true;
        pause();
      } else {
        player.userPaused = false;
        const ok = await play({ auto: false });
        if (ok) markAudioUnlocked();
      }
    });

    player.pause = pause;
    player.play = play;
    player.setStatus = setStatus;
    players.push(player);
    return player;
  };

  document.querySelectorAll('[data-audio-player]').forEach(makePlayer);

  const chapterPlayers = players.filter(player => player.isChapter);
  const stagePlayers = players.filter(player => player.isStage);
  const themePlayer = players.find(player => player.el.classList.contains('audio-player--theme'));


  const activeStagePlayer = () => stagePlayers.find(player =>
    player.stageCopy && player.stageCopy.classList.contains('is-active')
  ) || null;
  const activeChapterPlayer = () => {
    if (!chapterPlayers.length) return null;
    const vh = window.innerHeight;
    let best = null;
    let bestArea = 0;
    chapterPlayers.forEach(player => {
      const rect = player.chapter.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      if (visible > bestArea) {
        bestArea = visible;
        best = player;
      }
    });
    return bestArea >= vh * 0.5 ? best : null;
  };

  const runAuto = () => {
    if (!AUTOPLAY) return;
    if (!autoUnlocked) {
      const active = activeStagePlayer() || themePlayer || activeChapterPlayer();
      if (active && !active.playing) active.setStatus('未播放');
      return;
    }

    if (stagePlayers.length) {
      const active = activeStagePlayer();
      if (!active) {
        if (lastAutoKey) {
          stagePlayers.forEach(player => {
            if (player.playing) player.pause({ auto: true });
          });
          lastAutoKey = '';
        }
        return;
      }
      if (active.key !== lastAutoKey) {
        lastAutoKey = active.key;
        stagePlayers.forEach(player => {
          if (player !== active && player.playing) player.pause({ auto: true });
        });
        active.finished = false;
        active.userPaused = false;
      }
      if (!active.playing && !active.userPaused && !active.finished) {
        active.play({ auto: true });
      }
      return;
    }

    if (themePlayer) {
      if (!themePlayer.userPaused && !themePlayer.finished && !themePlayer.playing) {
        themePlayer.play({ auto: true });
      }
      return;
    }

    const active = activeChapterPlayer();
    if (!active) {
      if (lastAutoKey) {
        chapterPlayers.forEach(player => {
          if (player.playing) player.pause({ auto: true });
        });
        lastAutoKey = '';
      }
      return;
    }

    if (active.key !== lastAutoKey) {
      lastAutoKey = active.key;
      chapterPlayers.forEach(player => {
        if (player !== active && player.playing) player.pause({ auto: true });
      });
      active.finished = false;
      active.userPaused = false;
      if (!active.playing) active.play({ auto: true });
    }
  };

  const scheduleAuto = () => {
    if (autoScheduled) return;
    autoScheduled = true;
    requestAnimationFrame(() => {
      autoScheduled = false;
      runAuto();
    });
  };

  const tryUnlock = () => {
    if (autoUnlocked) return Promise.resolve(true);
    if (unlockPromise) return unlockPromise;
    let ctx;
    try { ctx = getContext(); } catch (err) { return Promise.resolve(false); }
    const resume = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    unlockPromise = Promise.race([
      Promise.resolve(resume).then(() => true).catch(() => false),
      new Promise(resolve => window.setTimeout(() => resolve(false), 420))
    ]).then(() => {
      unlockPromise = null;
      if (ctx.state === 'running') {
        autoUnlocked = true;
        runAuto();
        return true;
      }
      return false;
    });
    return unlockPromise;
  };

  function markAudioUnlocked() {
    if (autoUnlocked) return;
    autoUnlocked = true;
    const active = activeStagePlayer() || activeChapterPlayer();
    if (active) lastAutoKey = active.key;
    runAuto();
  }

  const unlockFromGesture = event => {
    if (event.target && event.target.closest && event.target.closest('[data-audio-player]')) return;
    tryUnlock();
  };

  let scrollUnlockTried = false;
  document.addEventListener('pointerdown', unlockFromGesture, { passive: true });
  document.addEventListener('keydown', unlockFromGesture, { passive: true });
  document.addEventListener('touchstart', unlockFromGesture, { passive: true });
  window.addEventListener('wheel', () => tryUnlock(), { passive: true, once: true });
  window.addEventListener('scroll', () => {
    if (!autoUnlocked && !scrollUnlockTried) {
      scrollUnlockTried = true;
      tryUnlock();
    }
    scheduleAuto();
  }, { passive: true });
  window.addEventListener('resize', scheduleAuto);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) players.forEach(player => { if (player.playing) player.pause({ auto: true }); });
  });

  if (AUTOPLAY) {
    tryUnlock().then(ok => {
      if (!ok) {
        const active = activeStagePlayer() || themePlayer;
        if (active) active.setStatus('未播放');
      }
    });
    scheduleAuto();
  }

  window.XiaoheAudioPlayer = {
    pauseAll() {
      players.forEach(player => {
        if (player.playing) player.pause();
      });
    }
  };
})();
