/* ==========================================================================
   潇贺古道 · 六章声音播放器
   --------------------------------------------------------------------------
   · 音频以 MP3 短片段存放在 assets/audio/，同时生成 data/<key>.js 的 base64。
   · Web Audio API 解码 + AnalyserNode 分析，波形来自正在播放的声音。
   · 首页六章：滚到哪一章就自动起哪一章的声音，换章时旧声音先淡出（0.9s）、
     新声音同时淡入，不是硬切；滚出六章（#chapter-stage 离屏）就淡出并停。
   · 浏览器不允许无手势自动出声：第一次点击/按键后才会真正开始，
     左下角有「开启声音 / 声音 关」总开关，选择记在 localStorage。
   · 播放、切换、结束都走 GainNode 渐变；数据脚本只在需要播放时加载。
   ========================================================================== */
(() => {
  'use strict';

  /* 自动播放总开关：true = 首页滚到某一章就自动起该章的声音。 */
  const AUTOPLAY = true;
  /* 自动播放时的目标音量（手动点播放仍是 0.9） */
  const AUTO_GAIN = 0.62;
  /* 声音总开关的本地记忆：off = 用户主动关掉，不再自动出声 */
  const SOUND_KEY = 'xiaohe-sound';

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
  /* 声音总开关（左下角按钮）与它的界面刷新钩子 */
  let soundEnabled = true;
  try { soundEnabled = window.localStorage.getItem(SOUND_KEY) !== 'off'; } catch (err) { /* 隐私模式忽略 */ }
  let soundPillPaint = null;

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

  /* 优先直接取 MP3（561 KB，浏览器当媒体资源处理，比 748 KB 的 base64 脚本稳）；
     fetch 不可用时（file:// 预览）才退回 data/<key>.js。 */
  const loadDataScript = key => new Promise((resolve, reject) => {
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

  const loadData = key => {
    if (dataCache[key]) return dataCache[key];

    dataCache[key] = (async () => {
      try {
        const res = await fetch(audioBase + key + '.mp3', { cache: 'force-cache' });
        const buf = res.ok ? await res.arrayBuffer() : null;
        /* 有的本地预览环境会把媒体请求回成 204/空 body，这种要走脚本兜底 */
        if (!buf || buf.byteLength < 1024) throw new Error('empty audio body');
        return buf;
      } catch (err) {
        return await loadDataScript(key);
      }
    })();
    return dataCache[key];
  };

  const decodeDataUrl = async (payload, context) => {
    if (typeof payload !== 'string') {
      /* ArrayBuffer：decodeAudioData 会把它 detach，复制一份，缓存还能复用 */
      return new Promise((resolve, reject) => {
        const task = context.decodeAudioData(payload.slice(0), resolve, reject);
        if (task && task.then) task.then(resolve, reject);
      });
    }
    const binary = atob(payload.split(',')[1] || '');
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
      /* 每次 play/pause 自增：异步解码回来时若 token 变了，说明已经被取消，
         否则快速滚过两章会出现两首同时响 */
      token: 0,
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
      player.token++;               /* 作废还在载入的那一次 play */
      if (!player.playing) {
        if (player.loading) {
          player.loading = false;
          el.classList.remove('is-loading');
          toggle.disabled = false;
          setStatus(auto ? '自动播放已暂停' : '已暂停');
        }
        return;
      }
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
        /* 0.9s 淡出：足够“慢慢消失”，又不会拖到下一章已经进来了还在响 */
        gain.linearRampToValueAtTime(0.0001, now + 0.9);
      }

      const source = player.source;
      if (source) {
        source.onended = null;
        try { source.stop(now + 0.95); } catch (err) { /* already stopped */ }
        window.clearTimeout(player.stopTimer);
        player.stopTimer = window.setTimeout(() => {
          if (player.source === source) player.source = null;
        }, 1000);
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
      if (auto && !soundEnabled) return false;
      if (player.loading) return false;
      if (player.playing) return true;

      players.forEach(other => {
        if (other !== player && (other.playing || other.loading)) other.pause({ auto: true });
      });

      try {
        player.loading = true;
        player.finished = false;
        player.userPaused = false;
        const token = ++player.token;
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
        /* 解码期间用户换了章/关了声音：这一次就不要播了 */
        if (token !== player.token || (auto && !soundEnabled)) {
          player.loading = false;
          el.classList.remove('is-loading');
          toggle.disabled = false;
          return false;
        }
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
        const level = auto ? AUTO_GAIN : 0.9;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0.0001, now);
        const fadeIn = Math.min(1.15, Math.max(0.35, buffer.duration - player.offset));
        gain.linearRampToValueAtTime(level, now + fadeIn);

        const remaining = buffer.duration - player.offset;
        if (remaining > 2.2) {
          const fadeStart = now + remaining - 1.35;
          if (fadeStart > now + fadeIn) gain.setValueAtTime(level, fadeStart);
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


  /* 六章舞台：滚出 #chapter-stage（索引/尾声/首屏）就不再算“在章里”，
     否则舞台进度会停在最后一章，声音会一直响到页面结束。 */
  const stageSection = document.getElementById('chapter-stage');
  const stageInView = () => {
    if (!stageSection) return true;
    const rect = stageSection.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    return visible >= vh * 0.2;
  };

  const activeStagePlayer = () => {
    if (!stageInView()) return null;
    return stagePlayers.find(player =>
      player.stageCopy && player.stageCopy.classList.contains('is-active')
    ) || null;
  };

  /* 提前把下一章的声音数据取回来（不解码）：换章时不用干等 700 KB，
     移动端开了省流量就不预取。 */
  const warmNextChapter = player => {
    if (navigator.connection && navigator.connection.saveData) return;
    const i = stagePlayers.indexOf(player);
    const next = i >= 0 ? stagePlayers[i + 1] : null;
    if (!next) return;
    if (window.XiaoheAudioData && window.XiaoheAudioData[next.key]) return;
    if (dataCache[next.key]) return;
    loadData(next.key).catch(() => {});
  };
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
    /* 只在首页六章舞台自动配乐；专题页的播放器保持手动，点了才响 */
    if (!AUTOPLAY || !soundEnabled || !stageSection) return;
    if (!autoUnlocked) {
      const active = activeStagePlayer() || themePlayer || activeChapterPlayer();
      if (active && !active.playing) active.setStatus('未播放');
      return;
    }

    if (stagePlayers.length) {
      const active = activeStagePlayer();
      if (!active) {
        /* 只在真的离开舞台时收声；舞台还在屏上、只是一瞬间没有 is-active
           （切换动画中间态）时不要停，否则会莫名其妙断掉且不再续上。 */
        if (!stageInView()) {
          stagePlayers.forEach(player => {
            if (player.playing || player.loading) player.pause({ auto: true });
          });
          lastAutoKey = '';
        }
        return;
      }
      if (active.key !== lastAutoKey) {
        lastAutoKey = active.key;
        stagePlayers.forEach(player => {
          if (player !== active && (player.playing || player.loading)) player.pause({ auto: true });
        });
        active.finished = false;
        active.userPaused = false;
      }
      if (!active.playing && !active.userPaused && !active.finished) {
        active.play({ auto: true }).then(ok => { if (ok) warmNextChapter(active); });
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
        if (soundPillPaint) soundPillPaint();
        kickAuto();
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
    if (soundPillPaint) soundPillPaint();
    kickAuto();
  }

  /* 解锁那一刻舞台可能还在过渡（没有 is-active），随后补几次，
     避免“按钮已经变成 声音开，但一直没响”。 */
  const kickAuto = () => {
    runAuto();
    [500, 1400, 3000].forEach(ms => {
      window.setTimeout(() => {
        if (autoUnlocked && soundEnabled && AUTOPLAY) runAuto();
      }, ms);
    });
  };

  const unlockFromGesture = event => {
    if (!soundEnabled) return;
    if (event.target && event.target.closest &&
        event.target.closest('[data-audio-player], .xh-sound')) return;
    tryUnlock();
  };

  let scrollUnlockTried = false;
  document.addEventListener('pointerdown', unlockFromGesture, { passive: true });
  document.addEventListener('keydown', unlockFromGesture, { passive: true });
  document.addEventListener('touchstart', unlockFromGesture, { passive: true });
  window.addEventListener('wheel', () => { if (soundEnabled) tryUnlock(); }, { passive: true, once: true });
  window.addEventListener('scroll', () => {
    if (soundEnabled && !autoUnlocked && !scrollUnlockTried) {
      scrollUnlockTried = true;
      tryUnlock();
    }
    scheduleAuto();
  }, { passive: true });
  window.addEventListener('resize', scheduleAuto);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      players.forEach(player => { if (player.playing) player.pause({ auto: true }); });
    } else if (AUTOPLAY && soundEnabled && autoUnlocked) {
      scheduleAuto();
    }
  });

  if (AUTOPLAY && soundEnabled) {
    /* 不在页面加载时就创建 AudioContext：没有手势时 resume() 会一直挂着，
       之后再点也可能卡在这个死掉的上下文上。改成第一次手势里再创建。 */
    scheduleAuto();
  }

  window.XiaoheAudioPlayer = {
    pauseAll() {
      players.forEach(player => {
        if (player.playing) player.pause();
      });
    }
  };

  /* ---------- 首页：左下角声音总开关 ----------
     浏览器不给手势就不让出声，所以第一次进来先显示「开启声音」；
     点一下之后整页都能自动切歌，再点就是静音，选择记在 localStorage。 */
  if (AUTOPLAY && stageSection && stagePlayers.length && document.body) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xh-sound';
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.8 6.1h2.4L8 3.4v9.2L5.2 9.9H2.8z"/>' +
      '<path class="w1" d="M10.3 5.7a3.3 3.3 0 0 1 0 4.6"/>' +
      '<path class="w2" d="M12.1 4.1a5.6 5.6 0 0 1 0 7.8"/>' +
      '<path class="slash" d="M2.4 2.4l11.2 11.2"/>' +
      '</svg><span class="xh-sound__text">开启声音</span>';

    const text = btn.querySelector('.xh-sound__text');

    const paint = () => {
      const state = !soundEnabled ? 'off' : (autoUnlocked ? 'on' : 'locked');
      btn.dataset.state = state;
      btn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
      btn.setAttribute('aria-label',
        state === 'off' ? '打开声音' : state === 'locked' ? '点击开启声音' : '关闭声音');
      text.textContent = state === 'off' ? '声音 关' : state === 'locked' ? '开启声音' : '声音 开';
    };
    soundPillPaint = paint;

    const setSound = on => {
      soundEnabled = on;
      try { window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (err) { /* 忽略 */ }
      if (!on) players.forEach(player => { if (player.playing) player.pause({ auto: true }); });
      paint();
    };

    btn.addEventListener('click', () => {
      if (!soundEnabled) {
        setSound(true);
        tryUnlock().then(ok => { if (ok) kickAuto(); paint(); });
        return;
      }
      if (!autoUnlocked) {
        tryUnlock().then(ok => { if (ok) kickAuto(); paint(); });
        return;
      }
      setSound(false);
    });

    /* 插进顶栏（导航与年份之间）；没有顶栏时退回左下角浮动 */
    const bar = document.getElementById('topbar');
    if (bar) {
      const anchor = bar.querySelector('.top-year') || bar.querySelector('.menu-btn');
      bar.insertBefore(btn, anchor);
    } else {
      btn.classList.add('xh-sound--float');
      document.body.appendChild(btn);
    }
    paint();
    window.XiaoheAudioPlayer.setSound = setSound;
  }
})();
