/* ==========================================================================
   潇贺古道 · 六章声音播放器
   --------------------------------------------------------------------------
   · 音频只保留 MP3 一种格式，存放在 assets/audio/。
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
  /* 自动播放时的目标音量（手动点播放仍是 MANUAL_GAIN） */
  const AUTO_GAIN = 0.62;
  const MANUAL_GAIN = 0.9;
  /* 换曲的节奏：旧声先淡出，新声错开 SWITCH_LAG 再起来，听感是「消散 → 接上」 */
  const FADE_OUT = 1.05;
  const FADE_IN = 0.9;
  const SWITCH_LAG = 0.38;
  /* 双击本地文件打开（file://）：浏览器禁止 fetch 读本地文件、也不让
     createMediaElementSource/captureStream 拿到本地音频（CORS 会把信号吃掉），
     所以改从 assets/audio/data/{key}.js 取同一段 mp3 的 base64 —— <script> 加载
     本地脚本不受这条限制。解码后仍然走 Web Audio 分析，波形是真实频谱。
     数据脚本缺席（被人删了/只拷贝了部分文件）时才退回 <audio>：声音在，波形静止。 */
  const FILE_MODE = window.location.protocol === 'file:';
  /* 声音总开关的本地记忆：off = 用户主动关掉，不再自动出声 */
  const SOUND_KEY = 'xiaohe-sound';
  /* 音量（0–1）与跨页播放状态的本地记忆 */
  const VOLUME_KEY = 'xiaohe-volume';
  const STATE_KEY = 'xiaohe-audio-state';
  /* 跨页续播的时间窗：超过这么久还打开，就当是新的一次访问 */
  const RESUME_WINDOW = 30000;

  let masterVolume = 1;
  try {
    /* 注意：没有存过时 getItem 返回 null，Number(null) 是 0 ——
       直接比较会把首次访问的音量设成静音，必须先判空 */
    const rawVolume = window.localStorage.getItem(VOLUME_KEY);
    if (rawVolume !== null && rawVolume !== '') {
      const saved = Number(rawVolume);
      if (isFinite(saved) && saved >= 0 && saved <= 1) masterVolume = saved;
    }
  } catch (err) { /* 隐私模式忽略 */ }

  const META = {
    nushu: {
      title: '金坨女',
      sub: '女书歌曲 · 12 秒选段',
      credit: 'B站 · BV1QTrTY2EAF',
      href: 'https://www.bilibili.com/video/BV1QTrTY2EAF/'
    },
    butterfly: {
      title: '流水欢歌迎客来',
      sub: '蝴蝶歌现场 · 12 秒选段',
      credit: 'B站 · BV1B8411S74T',
      href: 'https://www.bilibili.com/video/BV1B8411S74T/'
    },
    drum: {
      title: '汪嘟',
      sub: '瑶族长鼓舞 · 12 秒选段',
      credit: 'B站 · BV1pZKszGEtK',
      href: 'https://www.bilibili.com/video/BV1pZKszGEtK/'
    },
    bridge: {
      title: '风雨桥边',
      sub: '富川推广曲 · 12 秒选段',
      credit: 'B站 · BV14b4y1U7su',
      href: 'https://www.bilibili.com/video/BV14b4y1U7su/'
    },
    panwang: {
      title: '万段曲',
      sub: '盘王大歌 · 12 秒选段',
      credit: 'B站 · BV1JUyABpEbb',
      href: 'https://www.bilibili.com/video/BV1JUyABpEbb/'
    },
    brocade: {
      title: '瑶族织锦现场声',
      sub: '织机与讲述 · 12 秒选段',
      credit: 'B站 · BV1K34y1e7wh',
      href: 'https://www.bilibili.com/video/BV1K34y1e7wh/'
    }
  };

  const body = document.body;
  /* 转成绝对地址：软导航 pushState 之后 document.baseURI 会变成专题页 URL，
     相对路径会解析到 /themes/ 下面去，音频就 404 了 */
  const audioBase = new URL(
    (body.dataset.audioBase || 'assets/audio/').replace(/\/?$/, '/'),
    window.location.href
  ).href;
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

  /* 音源只保留 MP3 一种格式。
     线上 / 本地服务器：fetch mp3 → decodeAudioData。
     file://：fetch 被禁，改由数据脚本 assets/audio/data/{key}.js 交出同一段 mp3 的 base64。 */
  const loadDataScript = key => new Promise((resolve, reject) => {
    const ready = window.XiaoheAudioData && window.XiaoheAudioData[key];
    if (ready) return resolve(ready);
    const el = document.createElement('script');
    el.src = audioBase + 'data/' + key + '.js';
    el.async = true;
    el.onload = () => {
      const data = window.XiaoheAudioData && window.XiaoheAudioData[key];
      if (data) resolve(data);
      else reject(new Error('audio data missing: ' + key));
    };
    el.onerror = () => reject(new Error('audio data script failed: ' + key));
    document.head.appendChild(el);
  });

  const loadData = key => {
    if (dataCache[key]) return dataCache[key];

    dataCache[key] = (async () => {
      /* 浏览器到 CDN 偶尔会把某一个文件挂住：给每次请求设超时，超时就换带查询串的地址重试一次。 */
      const attempt = async (url, ms) => {
        const ctrl = window.AbortController ? new AbortController() : null;
        const timer = ctrl ? window.setTimeout(() => ctrl.abort(), ms) : 0;
        try {
          const res = await fetch(url, {
            cache: 'force-cache',
            signal: ctrl ? ctrl.signal : undefined
          });
          const buf = res.ok ? await res.arrayBuffer() : null;
          if (!buf || buf.byteLength < 1024) throw new Error('empty audio body');
          return buf;
        } finally {
          if (timer) window.clearTimeout(timer);
        }
      };

      if (FILE_MODE) return loadDataScript(key);
      try {
        return await attempt(audioBase + key + '.mp3', 4000);
      } catch (err) {
        return await attempt(audioBase + key + '.mp3?r=' + Date.now(), 6000);
      }
    })();
    /* 失败不留在缓存里：本地数据脚本被删掉时会一路退回 <audio>，下次还能再试 */
    dataCache[key].catch(() => { delete dataCache[key]; });
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
      elAudio: null,
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
      /* 本次是否接在另一首的淡出之后起来（决定要不要错开 SWITCH_LAG） */
      delayIn: false,
      /* 正在淡出中：此时不算“在播”，但声音还没散完 */
      fading: false,
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
      /* 软导航后旧 body 已被换掉：停止画波形，但声音继续——音频节点活在 JS 里，和 DOM 无关 */
      if (!el.isConnected) {
        player.raf = 0;
        return;
      }
      if (!player.playing || !player.analyser) return;
      player.analyser.getByteFrequencyData(player.data);
      const bins = player.data.length;
      for (let i = 0; i < player.bars.length; i++) {
        const pos = i / Math.max(1, player.bars.length - 1);
        const bin = Math.min(bins - 1, Math.round(1 + Math.pow(pos, 1.5) * bins * 0.72));
        const target = player.data[bin] / 255;
        /* 上一帧的值可能是 undefined/NaN（见 adoptLive 处说明）：一旦是 NaN，
           scaleY(NaN) 会被浏览器当成非法值直接忽略，这根条就永远停在上一帧。
           所以先兜底成 0.06 再淡出，宁可短暂归零，也不要整根冻住。 */
        const prev = player.levels[i];
        const base = Number.isFinite(prev) ? prev : 0.06;
        player.levels[i] = target > base ? target : base * 0.82;
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

    /* ---------- 本地直接打开（file://）的最后兜底 ----------
       正常情况下 file:// 也走 Web Audio：音源从 assets/audio/data/{key}.js 取
       （见 loadData）。只有那份数据脚本读不到时才落到这里——
       用 <audio> 元素直接播：声音照常，波形退化为静止条。 */
    const fadeElement = (audio, to, lag, dur) => {
      const from = audio.volume;
      const startAt = performance.now() + (lag || 0) * 1000;
      const step = now => {
        const t = Math.min(1, Math.max(0, (now - startAt) / (dur * 1000)));
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const drawElement = () => {
      if (!el.isConnected) { player.raf = 0; return; }
      const audio = player.elAudio;
      if (!audio || !player.playing) return;
      player.time.textContent = formatTime(audio.currentTime);
      player.raf = requestAnimationFrame(drawElement);
    };

    const pauseElement = auto => {
      const audio = player.elAudio;
      if (!audio) return;
      if (!player.playing) {
        if (player.loading) {
          player.loading = false;
          el.classList.remove('is-loading');
          toggle.disabled = false;
          setStatus(auto ? '自动播放已暂停' : '已暂停');
        }
        return;
      }
      player.offset = audio.currentTime;
      player.playing = false;
      player.fading = true;
      fadeElement(audio, 0.0001, 0, 0.55);
      window.clearTimeout(player.stopTimer);
      player.stopTimer = window.setTimeout(() => {
        audio.pause();
        player.fading = false;
      }, 620);
      setPlayingUI(false);
      stopDraw();
      setStatus(auto ? '自动播放已暂停' : '已暂停');
      writeState();
    };

    const playFile = async ({ auto = false } = {}) => {
      if (auto && (!AUTOPLAY || !soundEnabled)) return false;
      if (player.playing) return true;
      if (player.loading) return false;

      players.forEach(other => {
        if (other !== player && (other.playing || other.loading)) {
          player.delayIn = true;
          other.pause({ auto: true });
        }
      });

      try {
        if (!player.elAudio) {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = audioBase + key + '.mp3';
          audio.addEventListener('ended', () => { if (player.playing) finish(); });
          player.elAudio = audio;
        }
        const audio = player.elAudio;
        player.loading = true;
        player.finished = false;
        player.userPaused = false;
        el.classList.add('is-loading');
        el.classList.remove('is-unavailable');
        setStatus('正在载入声音…');

        if (player.offset > 0.2) {
          try { audio.currentTime = player.offset; } catch (err) { /* 还不到可 seek 的阶段 */ }
        }
        await audio.play();

        player.loading = false;
        player.playing = true;
        player.auto = auto;
        live = player;
        el.classList.remove('is-loading');
        el.classList.add('is-ready');
        toggle.disabled = false;
        setPlayingUI(true);
        /* 这一路只有 <audio>，没有 AnalyserNode：波形是静止的，状态里说清楚，
           免得又出现「明明写着播放中，波形却冻着」的误判 */
        setStatus('播放中 · 波形不可用');
        audio.volume = 0;
        fadeElement(
          audio,
          Math.max(0.0001, (auto ? AUTO_GAIN : MANUAL_GAIN) * masterVolume),
          player.delayIn ? SWITCH_LAG : 0,
          FADE_IN
        );
        drawElement();
        writeState();
        return true;
      } catch (err) {
        player.loading = false;
        player.playing = false;
        el.classList.remove('is-loading', 'is-playing');
        el.classList.add('is-unavailable');
        toggle.disabled = true;
        setPlayingUI(false);
        setStatus('音频不可用');
        return false;
      }
    };

    const pause = ({ auto = false } = {}) => {
      player.token++;               /* 作废还在载入的那一次 play */
      if (player.elAudio) { pauseElement(auto); return; }
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
        /* 慢慢消失：淡出期间仍算“正在散音”，下一首会错开 SWITCH_LAG 再起 */
        gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);
        player.fading = true;
      }

      const source = player.source;
      if (source) {
        source.onended = null;
        try { source.stop(now + FADE_OUT + 0.06); } catch (err) { /* already stopped */ }
        window.clearTimeout(player.stopTimer);
        player.stopTimer = window.setTimeout(() => {
          if (player.source === source) player.source = null;
          player.fading = false;
        }, (FADE_OUT + 0.1) * 1000);
      } else {
        player.fading = false;
      }

      setPlayingUI(false);
      stopDraw();
      setStatus(auto ? '自动播放已暂停' : '已暂停');
      writeState();
    };

    const finish = () => {
      if (player.elAudio) {
        player.playing = false;
        player.offset = 0;
        player.finished = true;
        try { player.elAudio.pause(); player.elAudio.currentTime = 0; } catch (err) { /* 已停止 */ }
        setPlayingUI(false);
        stopDraw();
        setStatus('播放完毕');
        player.time.textContent = '00:00';
        live = player;
        writeState();
        return;
      }
      player.playing = false;
      player.offset = 0;
      player.source = null;
      player.finished = true;
      setPlayingUI(false);
      stopDraw();
      setStatus('播放完毕');
      player.time.textContent = '00:00';
      live = player;
      writeState();
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
        if (other !== player && (other.playing || other.loading)) {
          player.delayIn = true;      /* 有旧声在散，新声错开半拍再起 */
          other.pause({ auto: true });
        }
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
        const level = Math.max(0.0001, (auto ? AUTO_GAIN : MANUAL_GAIN) * masterVolume);
        /* 接在别的曲子淡出之后：错开 SWITCH_LAG，让「先消散、后起来」听得分明 */
        const t0 = now + (player.delayIn ? SWITCH_LAG : 0);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0.0001, now);
        gain.setValueAtTime(0.0001, t0);
        const fadeIn = Math.min(FADE_IN + 0.25, Math.max(0.4, buffer.duration - player.offset));
        gain.linearRampToValueAtTime(level, t0 + fadeIn);

        const remaining = buffer.duration - player.offset;
        if (remaining > 2.2) {
          const fadeStart = t0 + remaining - 1.35;
          if (fadeStart > t0 + fadeIn) gain.setValueAtTime(level, fadeStart);
          gain.linearRampToValueAtTime(0.0001, t0 + remaining);
        } else {
          gain.linearRampToValueAtTime(0.0001, t0 + Math.max(0.35, remaining));
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(player.analyser);
        source.start(t0, player.offset);
        player.source = source;
        player.startedAt = t0 - player.offset;
        player.fading = false;
        player.playing = true;
        player.loading = false;
        el.classList.remove('is-loading');
        el.classList.add('is-ready');
        player.auto = auto;
        live = player;
        writeState();
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
        /* file:// 下预存数据没接上（文件被删/只拷了部分）：退回 <audio>。
           有声音、没有波形，但比「点了没反应」好，也比假装在放频谱诚实。
           注意只接管“取不到数据/解不开”这类错误——没手势的 NotAllowedError
           换 <audio> 也一样放不出来，别把提示词换成更含糊的那一条。 */
        if (FILE_MODE && err.name !== 'NotAllowedError' && err.name !== 'InvalidStateError') {
          return playFile({ auto });
        }
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
    player.syncUI = () => setPlayingUI(player.playing);
    player.startDraw = draw;
    players.push(player);
    return player;
  };

  document.querySelectorAll('[data-audio-player]').forEach(makePlayer);

  /* ---------- 谁在发声：不能靠查 DOM ----------
     软导航只替换 body，旧的播放器元素被丢弃，但 AudioBufferSourceNode 与
     GainNode 活在 JS 里照样发声。所以“当前是哪一首”必须自己记，不能靠
     document.querySelector 反查，否则一跨页就找不到声音了。 */
  let live = null;          /* 正在发声（含淡出中）的 player */
  let resumeIntent = null;  /* 上一页留下的续播意图 { key, position } */

  let chapterPlayers = players.filter(player => player.isChapter);
  let stagePlayers = players.filter(player => player.isStage);
  let themePlayer = players.find(player => player.el.classList.contains('audio-player--theme')) || null;

  /* body 换过之后重新分组：只认还挂在文档里的界面 */
  const recomputeGroups = () => {
    const alive = players.filter(player => player.el.isConnected);
    chapterPlayers = alive.filter(player => player.isChapter);
    stagePlayers = alive.filter(player => player.isStage);
    themePlayer = alive.find(player => player.el.classList.contains('audio-player--theme')) || null;
  };

  const livePosition = player => {
    if (!player) return 0;
    if (player.elAudio) return Math.max(0, player.elAudio.currentTime || 0);
    if (!player.playing || !player.buffer || !audioContext) return player.offset || 0;
    return Math.min(player.buffer.duration, Math.max(0, audioContext.currentTime - player.startedAt));
  };

  /* ---------- 跨页交接：离开页面时把“放的是哪首、放到哪”存下来 ---------- */
  const writeState = () => {
    try {
      window.sessionStorage.setItem(STATE_KEY, JSON.stringify({
        key: live ? live.key : '',
        position: livePosition(live),
        playing: !!(live && (live.playing || live.fading)),
        at: Date.now()
      }));
    } catch (err) { /* 隐私模式忽略 */ }
  };

  (() => {
    let saved = null;
    try { saved = JSON.parse(window.sessionStorage.getItem(STATE_KEY) || 'null'); } catch (err) { return; }
    if (!saved || !saved.key || !saved.playing || !saved.at) return;
    if (Date.now() - saved.at > RESUME_WINDOW) return;
    /* 补上「页面加载 + 跳转」这段时间，音乐听起来才像是接着刚才那口气 */
    resumeIntent = {
      key: saved.key,
      position: Math.max(0, (Number(saved.position) || 0) + (Date.now() - saved.at) / 1000)
    };
  })();

  /* ---------- 音量 ---------- */
  const applyMasterVolume = () => {
    const player = live;
    if (!player || !player.gain || !audioContext) return;
    const level = Math.max(0.0001, (player.auto ? AUTO_GAIN : MANUAL_GAIN) * masterVolume);
    const gain = player.gain.gain;
    const now = audioContext.currentTime;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    }
    gain.linearRampToValueAtTime(level, now + 0.25);
  };

  /* ---------- 绑定新出现的播放器界面（软导航之后） ---------- */
  const bindNewPlayers = () => {
    document.querySelectorAll('[data-audio-player]').forEach(el => {
      if (el.dataset.audioBound === '1') return;
      const bound = makePlayer(el);
      if (bound) el.dataset.audioBound = '1';
    });
  };

  /* 把正在响的那一路音频交给新界的播放器，声音本身不中断 */
  const adoptLive = () => {
    if (!live || !(live.playing || live.fading)) return;
    const target = players.find(player =>
      player !== live && player.el.isConnected && player.key === live.key && !player.buffer
    );
    if (!target) return;

    target.buffer = live.buffer;
    target.source = live.source;
    target.analyser = live.analyser;
    target.gain = live.gain;
    target.data = live.data;
    /* 首页每章 46 根条，专题页 88 根：不能把旧数组整个交过去。
       多出来的下标是 undefined，draw() 会算出 NaN，scaleY(NaN) 被浏览器忽略，
       后半段波形就永远冻在待机高度（从首页点进专题正是这个毛病）。
       这里按比例重采样成新播放器的条数。 */
    target.levels = target.bars.map((bar, i) => {
      const from = live.levels;
      if (!from || !from.length) return 0.15;
      const j = Math.round(i * (from.length - 1) / Math.max(1, target.bars.length - 1));
      const value = from[Math.min(from.length - 1, Math.max(0, j))];
      return Number.isFinite(value) ? value : 0.15;
    });
    target.startedAt = live.startedAt;
    target.offset = live.offset;
    target.playing = live.playing;
    target.fading = live.fading;
    target.auto = live.auto;
    target.token = live.token;

    /* 旧对象交出发音权：不再 stop 同一个 source，也不再画波形 */
    live.source = null;
    live.playing = false;
    live.fading = false;
    if (live.raf) cancelAnimationFrame(live.raf);
    live = target;

    target.el.classList.add('is-ready');
    target.syncUI();
    target.startDraw();
  };


  /* 六章舞台：滚出 #chapter-stage（索引/尾声/首屏）就不再算“在章里”，
     否则舞台进度会停在最后一章，声音会一直响到页面结束。
     let：软导航换 body 之后要把它置空，切到专题页的逻辑。 */
  let stageSection = document.getElementById('chapter-stage');
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
    if (!AUTOPLAY || !soundEnabled) return;

    /* 专题页：接过上一页正在放的那一首，从原位置接着响；
       没有交接状态（直接打开专题页）就放本专题自己的声音 */
    if (!stageSection) {
      if (!themePlayer) return;
      if (!autoUnlocked) {
        if (!themePlayer.playing) themePlayer.setStatus('未播放');
        return;
      }
      if (themePlayer.playing || themePlayer.userPaused || themePlayer.finished) return;
      const intent = resumeIntent;
      resumeIntent = null;
      if (intent && intent.key === themePlayer.key) {
        themePlayer.offset = Math.max(0, intent.position);
      }
      themePlayer.play({ auto: true });
      return;
    }

    if (!autoUnlocked) {
      const active = activeStagePlayer() || activeChapterPlayer();
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
        /* 导航控件不参与解锁：解锁会改「声音」簇的宽度，顶栏随之重排，
           pointerup 就落不到原来的按钮上——第一次点「目录 / 菜单」会失效。 */
        event.target.closest('[data-audio-player], .xh-sound, .nav-menu-btn, .nav-more')) return;
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
    },
    /* 自测用：控制台敲 XiaoheAudioPlayer.debug() 就能看到真实状态 */
    debug() {
      return {
        /* file = 双击打开的本地文件（音源走 assets/audio/data 的数据脚本，波形照常）；
           webaudio = http/https 打开。两种情况都该有实时频谱，
           若这里是 file 而波形不动，先查 data 脚本有没有跟着拷贝。 */
        mode: FILE_MODE ? 'file' : 'webaudio',
        key: live ? live.key : null,
        playing: !!(live && (live.playing || live.fading)),
        context: audioContext ? audioContext.state : 'none',
        position: Math.round(livePosition(live) * 10) / 10,
        unlocked: autoUnlocked,
        enabled: soundEnabled,
        volume: Math.round(masterVolume * 100) / 100,
        bound: players.filter(player => player.el.isConnected).length
      };
    },
    /* 软导航换完 body 之后由 soft-nav.js 调用：绑定新界面、接管仍在响的音频 */
    refresh() {
      /* 六章舞台已经不在这份文档里了，否则滚动逻辑还会按首页跑 */
      if (stageSection && !stageSection.isConnected) stageSection = null;
      bindNewPlayers();
      adoptLive();
      recomputeGroups();
      attachControls();
      scheduleAuto();
    }
  };

  /* ---------- 声音控制条 ----------
     浏览器不给手势就不让出声：第一次进来只有一个「开启声音」按钮，
     解锁之后展开完整控制（上一章/下一章、音量）。
     元素只建一次，软导航换 body 之后由 attachControls() 重新挂上去。 */
  let controls = null;
  let paintControls = null;

  const buildControls = () => {
    if (controls || !document.body) return;
    const wrap = document.createElement('div');
    wrap.className = 'xh-sound-cluster';
    wrap.innerHTML = [
      '<button class="xh-sound" type="button" aria-pressed="false">',
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ',
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M2.8 6.1h2.4L8 3.4v9.2L5.2 9.9H2.8z"/>',
      '<path class="w1" d="M10.3 5.7a3.3 3.3 0 0 1 0 4.6"/>',
      '<path class="w2" d="M12.1 4.1a5.6 5.6 0 0 1 0 7.8"/>',
      '<path class="slash" d="M2.4 2.4l11.2 11.2"/>',
      '</svg>',
      '<span class="xh-sound__text">开启声音</span>',
      '</button>',
      '<div class="xh-sound__tools">',
      '<button class="xh-sound__step" type="button" data-step="-1" aria-label="上一章声音">',
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" ',
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M10 3L5 8l5 5"/></svg>',
      '</button>',
      '<button class="xh-sound__step" type="button" data-step="1" aria-label="下一章声音">',
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" ',
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M6 3l5 5-5 5"/></svg>',
      '</button>',
      '<input class="xh-sound__vol" type="range" min="0" max="100" step="2" aria-label="音量">',
      '</div>'
    ].join('');

    const btn = wrap.querySelector('.xh-sound');
    const text = wrap.querySelector('.xh-sound__text');
    const tools = wrap.querySelector('.xh-sound__tools');
    const vol = wrap.querySelector('.xh-sound__vol');
    const steps = wrap.querySelectorAll('.xh-sound__step');

    const setSound = on => {
      soundEnabled = on;
      try { window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (err) { /* 忽略 */ }
      if (!on) players.forEach(player => {
        if (player.playing || player.fading || player.loading) player.pause({ auto: true });
      });
      if (paintControls) paintControls();
    };

    paintControls = () => {
      const state = !soundEnabled ? 'off' : (autoUnlocked ? 'on' : 'locked');
      wrap.dataset.state = state;
      btn.dataset.state = state;
      btn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
      btn.setAttribute('aria-label',
        state === 'off' ? '打开声音' : state === 'locked' ? '点击开启声音' : '暂停或继续声音');
      text.textContent = state === 'off' ? '声音 关' : state === 'locked' ? '开启声音' : '声音 开';
      /* 上一章/下一章只在首页六章成立；专题页只有一个声音，藏起来 */
      tools.hidden = state !== 'on' || stagePlayers.length < 2;
      vol.value = String(Math.round(Math.sqrt(Math.max(0, masterVolume)) * 100));
    };

    btn.addEventListener('click', () => {
      if (!soundEnabled) {
        setSound(true);
        tryUnlock().then(ok => { if (ok) kickAuto(); if (paintControls) paintControls(); });
        return;
      }
      if (!autoUnlocked) {
        tryUnlock().then(ok => { if (ok) kickAuto(); if (paintControls) paintControls(); });
        return;
      }
      setSound(false);
    });

    steps.forEach(step => {
      step.addEventListener('click', () => {
        const dir = Number(step.dataset.step) || 1;
        const list = stagePlayers;
        if (list.length < 2) return;
        const here = live ? list.indexOf(live) : -1;
        const index = here >= 0 ? here : 0;
        const next = list[(index + dir + list.length) % list.length];
        /* 声音跟着六章走，所以“下一章声音”= 滚到那一章，由滚动逻辑接管切换 */
        if (next && next.chapter) {
          next.chapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
          markAudioUnlocked();
        }
      });
    });

    vol.addEventListener('input', () => {
      const raw = Math.max(0, Math.min(100, Number(vol.value) || 0)) / 100;
      /* 线性滑杆在低音量区太灵敏，按听感曲线压一下 */
      masterVolume = Math.max(0, Math.min(1, raw * raw));
      try { window.localStorage.setItem(VOLUME_KEY, String(masterVolume)); } catch (err) { /* 忽略 */ }
      applyMasterVolume();
    });

    wrap.querySelector('.xh-sound').addEventListener('pointerdown', event => {
      event.stopPropagation();
    });

    controls = wrap;
    window.XiaoheAudioPlayer.setSound = setSound;
    soundPillPaint = paintControls;
  };

  /* 挂到顶栏；专题页没有 #topbar 就挂到 top-nav；都没有就浮在左下角 */
  const attachControls = () => {
    if (!controls) return;
    const bar = document.getElementById('topbar');
    if (bar) {
      const anchor = bar.querySelector('.top-year') || bar.querySelector('.menu-btn');
      bar.insertBefore(controls, anchor || null);
      controls.classList.remove('xh-sound-cluster--float');
    } else {
      const nav = document.getElementById('themeNav') || document.querySelector('.top-nav');
      if (nav) {
        nav.appendChild(controls);
        controls.classList.remove('xh-sound-cluster--float');
      } else if (document.body) {
        controls.classList.add('xh-sound-cluster--float');
        document.body.appendChild(controls);
      }
    }
    if (paintControls) paintControls();
  };

  if (document.body) {
    buildControls();
    attachControls();
  }

  /* 离开页面前把“放到哪了”记下来，下一个页面接着放 */
  window.addEventListener('pagehide', writeState);
  window.addEventListener('beforeunload', writeState);
})();
