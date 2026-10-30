/* ==========================================================================
   六章主题舞台
   --------------------------------------------------------------------------
   六章不是一个一个独立 section，而是一个连续 sticky 舞台：
   · 正常页面滚动（不劫持滚轮）驱动六个主题；
   · 每个主题的图片从左进入、向右离开；
   · 图片结束后，背景以标题位置为圆心做圆形蒙版扩展到下一主题；
   · 大标题左右换位，并做删除/打字；
   · 小字、播放器和波形先消失，等新背景/标题完成后再出现。
   ========================================================================== */
(() => {
  'use strict';

  const stage = document.getElementById('chapter-stage');
  if (!stage) return;

  const stagePin = document.getElementById('stagePin');
  const bgCurrent = document.getElementById('stageBgCurrent');
  const bgNext = document.getElementById('stageBgNext');
  const imagesWrap = document.getElementById('stageImages');
  const title = document.getElementById('stageTitle');
  const titleText = document.getElementById('stageTitleText');
  const copiesWrap = document.getElementById('stageCopies');

  const THEMES = [
    {
      key: 'nushu',
      title: '女书',
      en: 'NÜSHU',
      sub: '江永女书 · 唯一由女性专用的文字',
      region: '湖南 · 江永',
      heritage: '2006 第一批国家级非遗',
      color: '#A9362E',
      fg: '#F2EDE2',
      accent: '#D2A03F',
      darkText: false,
      motif: '𛆁𛈬𛆓𛆂𛆱𛈅𛈆𛇁𛆊',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><path d="M300 42 542 300 300 558 58 300Z"/><path d="M300 142 442 300 300 458 158 300Z"/><path d="M300 42v458M58 300h484"/></svg>',
      lede: '女书笔画纤细、右斜，字形呈长菱形。江永的女性用它写信、记姊妹往来，写在纸扇、手帕和三朝书上。',
      link: 'themes/02-女书.html',
      images: [
        { src: 'assets/img/nushu.jpg', w: 1100, h: 825, alt: '江永女书手稿，左侧为女书字形，右侧为汉字译文' },
        { src: 'images/主题图版/女书-博物馆.jpg', w: 1000, h: 667, alt: '江永女书生态博物馆内的女书卷轴' },
        { src: 'images/主题图版/女书-墙.jpg', w: 1000, h: 667, alt: '江永女书墙' },
        { src: 'images/图片/23-江永女书-百科.jpg', w: 1024, h: 768, alt: '江永女书字符与汉译' }
      ]
    },
    {
      key: 'butterfly',
      title: '蝴蝶歌',
      en: 'BUTTERFLY SONG',
      sub: '富川瑶家 · 二声部民歌',
      region: '广西 · 富川',
      heritage: '2008 第二批国家级非遗',
      color: '#2C5A4E',
      fg: '#F2EDE2',
      accent: '#E3B85C',
      darkText: false,
      motif: '蝴的蝶 蝶的蝶',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><path d="M300 300C168 120 38 172 82 332c32 118 166 90 218-32 52 122 186 150 218 32 44-160-86-212-218-32Z"/><path d="M300 218v180"/></svg>',
      lede: '衬词「蝴的蝶」贯穿全曲，两个声部同起同收。富川瑶族在节庆、歌会与劳作时演唱，内容多为爱情与日常。',
      link: 'themes/03-蝴蝶歌.html',
      images: [
        { src: 'assets/img/butterfly.jpg', w: 550, h: 366, alt: '富川瑶族蝴蝶歌传承人群' },
        { src: 'images/主题图版/蝴蝶歌-演出现场.jpg', w: 1600, h: 897, alt: '富川瑶族蝴蝶歌演出现场，歌手穿蓝色瑶族服饰' },
        { src: 'images/主题图版/蝴蝶歌-秀水村.jpg', w: 1500, h: 843, alt: '秀水村牌楼前，瑶族群众合唱蝴蝶歌' },
        { src: 'images/图片/24-蝴蝶歌表演-广西新闻网.jpg', w: 550, h: 366, alt: '蝴蝶歌传承人群在舞台上合影' },
        { src: 'images/图片/25-蝴蝶歌简谱-人人文档.jpg', w: 565, h: 753, alt: '蝴蝶歌二声部简谱' }
      ]
    },
    {
      key: 'drum',
      title: '长鼓舞',
      en: 'LONG DRUM DANCE',
      sub: '瑶族长鼓 · 祭仪与节庆',
      region: '湘桂 · 瑶寨',
      heritage: '国家级非遗',
      color: '#C08A2E',
      fg: '#141A16',
      accent: '#8C2822',
      darkText: true,
      motif: '咚 咚 咚 咚',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><circle cx="300" cy="300" r="206"/><circle cx="300" cy="300" r="146"/><circle cx="300" cy="300" r="84"/><path d="M112 430c90-66 286-66 376 0M186 150c58 96 170 210 230 300"/></svg>',
      lede: '长鼓在手中翻转、腾跃，鼓点与步伐相互呼应。它出现在祭仪、节庆与村落聚会中。',
      link: 'themes/04-长鼓舞.html',
      images: [
        { src: 'assets/img/drum.jpg', w: 1200, h: 828, alt: '瑶族长鼓舞表演，舞者手持长鼓腾跃' },
        { src: 'images/主题图版/长鼓舞-连南.jpg', w: 1600, h: 1200, alt: '连南瑶寨长鼓舞展演，舞者围圈击鼓' },
        { src: 'images/主题图版/长鼓舞-舞台.jpg', w: 1600, h: 1200, alt: '长鼓舞舞台演出，演员在圆形舞台上击鼓' },
        { src: 'images/图片/26-瑶族长鼓舞-百科.jpg', w: 1134, h: 783, alt: '瑶族长鼓舞在山间表演' }
      ]
    },
    {
      key: 'bridge',
      title: '富川风雨桥',
      en: 'WIND-RAIN BRIDGE',
      sub: '国保 2013 · 现存 27 座',
      region: '广西 · 富川',
      heritage: '富川瑶族风雨桥群',
      color: '#1D2652',
      fg: '#F2EDE2',
      accent: '#B7C3D6',
      darkText: false,
      motif: '桥 · 水 · 廊',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><path d="M48 430Q300 92 552 430M118 430Q300 178 482 430M24 430h552M90 468h420"/></svg>',
      lede: '桥廊遮风避雨，桥亭设于桥身中段。风雨桥既是通行设施，也是村落聚会、歇脚的地方。',
      link: 'themes/05-风雨桥.html',
      images: [
        { src: 'assets/img/bridge.jpg', w: 1100, h: 774, alt: '富川瑶族风雨桥，三孔石拱上架桥廊与桥亭' },
        { src: 'images/主题图版/风雨桥-回澜.jpg', w: 1080, h: 640, alt: '富川回澜风雨桥与青龙风雨桥' },
        { src: 'images/主题图版/风雨桥-群桥.jpg', w: 1600, h: 1089, alt: '富川瑶族风雨桥群，多座桥廊沿溪而建' },
        { src: 'images/图片/17-富川瑶族风雨桥群-百科.jpg', w: 960, h: 675, alt: '富川瑶族风雨桥群横跨河面' },
        { src: 'images/图片/18-回澜风雨桥-百科.jpg', w: 500, h: 352, alt: '富川回澜风雨桥与两岸村落' }
      ]
    },
    {
      key: 'panwang',
      title: '盘王大歌',
      en: 'PANWANG SONG',
      sub: '瑶族祭仪史诗',
      region: '湘桂 · 瑶族',
      heritage: '盘王节 · 祭仪传统',
      color: '#15120F',
      fg: '#F2EDE2',
      accent: '#D2A03F',
      darkText: false,
      motif: '盘王 · 大歌',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><rect x="118" y="118" width="364" height="364"/><path d="M180 180h240v240H180zM300 96v408M96 300h408"/><circle cx="300" cy="300" r="46"/></svg>',
      lede: '盘王大歌在祭仪中唱述始祖与迁徙，歌声、鼓点与人群构成仪式的时间。',
      link: 'themes/06-盘王大歌.html',
      images: [
        { src: 'assets/img/panwang.jpg', w: 810, h: 810, alt: '盘王印方形绣片，红底几何纹' },
        { src: 'images/主题图版/盘王-江永.jpg', w: 1600, h: 1065, alt: '江永瑶族盘王节祭祀典礼，盘王雕像前的人群' },
        { src: 'images/主题图版/盘王-祭祀.jpg', w: 1600, h: 1067, alt: '江永盘王节祭祀表演，红毯与盘王像' }
      ]
    },
    {
      key: 'brocade',
      title: '瑶族织锦',
      en: 'YAO BROCADE',
      sub: '富川 · 自治区级非遗 2018',
      region: '广西 · 富川',
      heritage: '瑶族织锦技艺',
      color: '#1E2B26',
      fg: '#F2EDE2',
      accent: '#C08A2E',
      darkText: false,
      motif: '织 · 锦',
      svg: '<svg viewBox="0 0 600 600" fill="none" stroke="currentColor" stroke-width="2"><path d="M84 120h432M84 200h432M84 280h432M84 360h432M84 440h432M120 84v432M200 84v432M280 84v432M360 84v432M440 84v432"/><path d="M160 120l360 320M440 120L80 440"/></svg>',
      lede: '经纬在木织机上交错，万字纹与几何纹逐段织出。织锦用于服饰、被面与头帕。',
      link: 'themes/07-富川织锦.html',
      images: [
        { src: 'assets/img/brocade.jpg', w: 640, h: 465, alt: '富川瑶族传统服饰，妇女在门前合影' },
        { src: 'images/主题图版/织锦-万字纹.jpg', w: 1600, h: 1067, alt: '富川瑶族织锦万字纹被面' },
        { src: 'images/主题图版/织锦-织机.jpg', w: 1080, h: 608, alt: '瑶族妇女在织机前织锦' },
        { src: 'images/图片/30-富川瑶族风俗1-百家号.jpg', w: 640, h: 465, alt: '富川瑶族女性传统服饰与头饰' },
        { src: 'images/图片/31-富川瑶族风俗2-百家号.jpg', w: 640, h: 437, alt: '富川瑶族节庆盛装人群' }
      ]
    }
  ];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* 过渡段从章节 55% 开始；胶片在此之前就停到「下一章第一张」，
       换色 / 标题 / 文案在胶片停住之后才发生，避免图与主题错位。 */
  const IMAGE_END = .55;
  /* 卡片在轨道上的排布：4 张卡错开进入，整段在 IMAGE_END 之前走完 */
  const TRACK_STAGGER = .095;
  const TRACK_SPAN = 1 - TRACK_STAGGER * 3;
  /* 端点稍快、中段稍慢：走到展示位时自然多停一会儿 */
  const travelAt = u => u + .06 * Math.sin(Math.PI * 2 * u);
  const uForTravel = target => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (travelAt(mid) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  /* 滚轮联动的最高速度：先按“屏幕速度”定，再换算成 phase。
     线性轨道下 1 个 phase 最多推进约 185vw，320vw/s ≈ 1.7 phase/s。 */
  /* 速度上限已取消：只靠弹簧/指数逼近本身的收敛速度 */

  /* 大小按“离展示位的距离”分档，距离从卡片中心量起（vw） */
  const FOCUS_NEAR = 2;
  const FOCUS_FAR = 14;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /* smoothstep 的反函数：用它算「标题第一个字出现」的 q，擦除从那一刻才开始 */
  const invSmoothstep = y => .5 - Math.sin(Math.asin(clamp(1 - 2 * y, -1, 1)) / 3);

  /* 背景擦除不再用 clip-path（paint 属性，每帧重画整块背景），
     改成：缩放一个圆形容器 + 内部反向缩放，两层都只做 transform（合成器动画）。 */
  /* withCircle：只有"下一层"需要圆形擦除容器；当前层直接平铺，
     否则过渡结束后当前层的内容会被默认隐藏的圆形容器一起藏掉。 */
  const makeBg = (layer, withCircle) => {
    layer.innerHTML = withCircle
      ? '<div class="stage-bg-circle"><div class="stage-bg-inner"><div class="stage-bg-word"></div><div class="stage-bg-svg"></div></div></div>'
      : '<div class="stage-bg-inner stage-bg-inner--plain"><div class="stage-bg-word"></div><div class="stage-bg-svg"></div></div>';
    return {
      layer,
      circle: layer.querySelector('.stage-bg-circle'),
      inner: layer.querySelector('.stage-bg-inner'),
      word: layer.querySelector('.stage-bg-word'),
      svg: layer.querySelector('.stage-bg-svg')
    };
  };

  const bgA = makeBg(bgCurrent, false);
  const bgB = makeBg(bgNext, true);

  const setBg = (bg, theme) => {
    /* 同一主题不重复写 DOM：这里的 innerHTML 重建是每帧卡顿的主要来源 */
    if (bg.key === theme.key) return;
    bg.key = theme.key;
    bg.layer.style.setProperty('--stage-bg', theme.color);
    bg.layer.style.setProperty('--stage-fg', theme.fg);
    bg.layer.style.setProperty('--stage-accent', theme.accent);
    bg.layer.style.color = theme.fg;
    bg.word.textContent = theme.motif;
    bg.svg.innerHTML = theme.svg;
  };

  /* ---------- 六个主题的图片拼成一条连续胶片 ----------
     主题按顺序首尾相接，滚动时整条一起移动：
     每张图在胶片上占 1 个单位，主题 k 占 IMG_COUNTS[k] 个单位。 */
  const imageTrack = document.createElement('div');
  imageTrack.className = 'stage-image-track';
  imagesWrap.appendChild(imageTrack);

  const IMG_COUNTS = THEMES.map(theme => theme.images.length);
  const IMG_START = IMG_COUNTS.map((_, k) =>
    IMG_COUNTS.slice(0, k).reduce((a, b) => a + b, 0));
  const IMG_TOTAL = IMG_COUNTS.reduce((a, b) => a + b, 0);

  const allCards = [];
  THEMES.forEach((theme, themeIndex) => {
    theme.images.forEach((item, j) => {
      const card = document.createElement('div');
      card.className = 'stage-image';
      card.dataset.theme = theme.key;
      card.dataset.index = String(j);
      const img = document.createElement('img');
      img.alt = item.alt;
      /* 先不挂 src：26 张全解码约 95MB 位图，会拖垮整个合成器 */
      card.dataset.src = item.src;
      img.width = item.w;
      img.height = item.h;
      img.loading = 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
      imageTrack.appendChild(card);
      allCards.push({ card, themeIndex, j, n: IMG_START[themeIndex] + j });
    });
  });

  /* 圆形擦除的内侧层：只放「下一主题」的图片，与主轨共用 transform。
     主轨反向蒙版只显示圆外，内层只显示圆内，边界就是硬切。 */
  const incomingLayer = document.createElement('div');
  incomingLayer.className = 'stage-image-incoming';
  imagesWrap.appendChild(incomingLayer);
  const incomingClones = allCards.map(({ card }) => {
    const el = card.cloneNode(true);
    el.classList.add('is-incoming');
    el.style.visibility = 'hidden';
    incomingLayer.appendChild(el);
    return { el, img: el.firstElementChild };
  });
  const cloneOf = new Map();
  allCards.forEach(({ card }, i) => cloneOf.set(card, incomingClones[i].el));

  const copies = THEMES.map((theme, index) => {
    const copy = document.createElement('div');
    copy.className = 'stage-copy' + (index === 0 ? ' is-active' : '');
    copy.dataset.theme = theme.key;
    copy.style.color = theme.fg;
    copy.style.setProperty('--stage-fg', theme.fg);
    copy.style.setProperty('--stage-bg', theme.color);
    copy.innerHTML = [
      '<div class="stage-copy-top">',
      '<span>CHAPTER ' + String(index + 1).padStart(2, '0') + ' / 06</span>',
      '<span>' + theme.heritage + '</span>',
      '<span>' + theme.region + '</span>',
      '</div>',
      '<div class="stage-copy-body">',
      '<p class="stage-lede">' + theme.lede + '</p>',
      '<div class="stage-audio audio-player audio-player--stage" data-audio-player data-key="' + theme.key + '"></div>',
      '</div>',
      '<a class="stage-more" href="' + theme.link + '" aria-label="进入「' + theme.title + '」专题页"><span>进入专题</span><i aria-hidden="true">↗</i></a>'
    ].join('');
    copiesWrap.appendChild(copy);
    return copy;
  });

  let cardWidthVW = 22;
  const measureCardWidth = () => {
    const sample = allCards[0] && allCards[0].card;
    if (!sample) return;
    /* 用 offsetWidth：getBoundingClientRect 会把 scale 算进去，间距会被放大 */
    const width = sample.offsetWidth;
    if (width > 0) cardWidthVW = width / window.innerWidth * 100;
  };
  requestAnimationFrame(measureCardWidth);

  let lastTone = '';
  let imageMomentum = 0;
  let momentumRaf = 0;
  let momentumTimer = 0;
  let primaryTheme = -1;
  let primaryIndex = 0;
  let imageFlow = 0;
  let imageFlowTarget = 0;
  let imageFlowTheme = -1;
  let lastStageProgress = 0;

  /* ---------- 图片缓动：JS 阻尼，不用 CSS 过渡 ----------
     卡片位置每帧都在写；若用 CSS transition，等于每帧重启一次过渡，
     主线程一抖就变成顿挫。这里改成逐帧指数逼近：帧率无关、不重启、
     一次只写四个可见卡片。 ------------------------------------------------ */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 诊断开关：地址栏加 ?stage-lite 可关掉投影与图层提升，用来定位卡顿来源 */
/* ---------- 二分法开关：?off=img,bg,title,wipe,copy,tone,flow,spring ----------
   每一项独立关掉一个子系统，用来定位"哪一块把整体动画搞坏了"。 */
/* 从整条地址里解析：参数写在 # 后面（index.html#index?off=img）也要能生效 */
const OFF = new Set(((location.href.match(/[?&]off=([A-Za-z,]+)/) || [, ''])[1])
  .split(',').map(s => s.trim()).filter(Boolean));
const off = name => OFF.has(name);
const HUD = /[?&]hud=1/.test(location.href);
/* ?imgcount=N：只画离展示位最近的 N 张图，用来找第几张开始卡 */
const DEBUG_COUNT = /[?&]debugcount=1/.test(location.href);
const IMG_COUNT = (() => { const m = location.href.match(/[?&]imgcount=(\d+)/); return m ? Math.max(1, +m[1]) : 99; })();
if (OFF.has('imgshadow')) document.documentElement.classList.add('off-img-shadow');
const hudState = { line: '' };
const hud = (() => {
  if (!HUD) return { textContent: '' };
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;background:rgba(0,0,0,.82);color:#7dff9b;' +
    'font:11px/1.5 ui-monospace,monospace;padding:5px 8px;border-radius:5px;pointer-events:none;letter-spacing:0';
  document.body.appendChild(el);
  /* 实时帧率：取最近 40 帧的中位/最差，方便直接报数字 */
  let last = performance.now();
  const dts = [];
  const loop = t => {
    const dt = t - last;
    last = t;
    dts.push(dt);
    if (dts.length > 40) dts.shift();
    const sorted = [...dts].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] || 0;
    const worst = sorted[sorted.length - 1] || 0;
    const fps = med ? Math.round(1000 / med) : 0;
    el.textContent = hudState.line + '  |  ' + fps + ' fps, worst ' + Math.round(worst) + 'ms';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return el;
})();
  const liteMode = /[?&]stage-lite/.test(location.href);
  const noClipWipe = /[?&]stage-noclip/.test(location.href);
  if (liteMode) document.documentElement.classList.add('stage-lite');
  const visualStates = new WeakMap();
  const visualDirty = new Set();
  let visualPrev = 0;
  let flowPrev = 0;

  const writeCard = (card, s) => {
    /* 一次写 transform，而不是 translate/rotate/scale 三个独立属性：
       Chrome 只在 will-change: transform 时把内容栅格化成固定位图，
       否则 scale 一变就整张图重栅格化（卡顿主因）。
       见 https://developer.chrome.com/blog/re-rastering-composite */
    card.style.transform = 'translate3d(' + s.x.toFixed(2) + 'vw,' + s.y.toFixed(2) + 'vh,0) rotate(' +
      s.rot.toFixed(2) + 'deg) scale(' + s.sc.toFixed(3) + ')';
    const op = s.op.toFixed(3);
    if (card.style.opacity !== op) card.style.opacity = op;
    /* 圆内层与主轨必须同一帧写同一组 transform，否则边界会露出错位 */
    const clone = cloneOf.get(card);
    if (clone) {
      clone.style.transform = card.style.transform;
      if (clone.style.opacity !== op) clone.style.opacity = op;
    }
  };

  /* 只在值真的变了才写样式，避免每帧制造无意义的样式失效 */
  const setStyle = (el, prop, value) => {
    if (el.style[prop] !== value) el.style[prop] = value;
  };

  /* 弹簧只算值，不自己开 rAF：整个页面只有一个 tick 循环（见下面 tick） */
  const stepSprings = dt => {
    const K = 150;
    const C = 22;
    const kEase = 1 - Math.exp(-20 * dt);
    for (const s of visualDirty) {
      s.vx += ((s.tx - s.x) * K - s.vx * C) * dt;
      s.x += s.vx * dt;
      s.y += (s.ty - s.y) * kEase;
      s.rot += (s.trot - s.rot) * kEase;
      s.sc += (s.tsc - s.sc) * kEase;
      s.op += (s.top - s.op) * kEase;
      if (Math.abs(s.tx - s.x) < .06 && Math.abs(s.vx) < .6 &&
          Math.abs(s.ty - s.y) < .06 && Math.abs(s.trot - s.rot) < .03 &&
          Math.abs(s.tsc - s.sc) < .003 && Math.abs(s.top - s.op) < .005) {
        s.x = s.tx; s.vx = 0; s.y = s.ty; s.rot = s.trot; s.sc = s.tsc; s.op = s.top;
        visualDirty.delete(s);
      }
      writeCard(s.card, s);
    }
  };

  const pushCard = (card, x, y, rot, sc, op) => {
    let s = visualStates.get(card);
    if (!s) {
      s = { card, x, y, rot, sc, op, tx: x, ty: y, trot: rot, tsc: sc, top: op, vx: 0 };
      visualStates.set(card, s);
      writeCard(card, s);
      return;
    }
    s.tx = x; s.ty = y; s.trot = rot; s.tsc = sc; s.top = op;
    /* 补完动画（snap）期间直接落位，避免阻尼拖在半路 */
    if (reduceMotion || snapDirect || off('spring')) {
      s.x = x; s.y = y; s.rot = rot; s.sc = sc; s.op = op; s.vx = 0;
      visualDirty.delete(s);
      writeCard(card, s);
      return;
    }
    visualDirty.add(s);
    requestTick();
  };

  /* 胶片两端之外的卡片直接落位：不进缓动循环，省一条常驻 rAF */
  const settleCard = (card, x, y, rot, sc, op) => {
    let s = visualStates.get(card);
    if (!s) {
      s = { card, x, y, rot, sc, op, tx: x, ty: y, trot: rot, tsc: sc, top: op, vx: 0 };
      visualStates.set(card, s);
    } else {
      s.x = x; s.y = y; s.rot = rot; s.sc = sc; s.op = op; s.vx = 0;
      s.tx = x; s.ty = y; s.trot = rot; s.tsc = sc; s.top = op;
      visualDirty.delete(s);
    }
    writeCard(card, s);
  };

  /* 标题宽度按主题缓存：每帧写 textContent 再读 offsetWidth 会强制同步布局 */
  const titleCache = { key: '', w: 0, h: 0 };
  /* 六个标题的实际宽度：圆形擦除的圆心要落在「下一主题标题」的正中间 */
  const titleWidths = [];
  const measureTitleWidths = () => {
    const prevText = titleText.textContent;
    const prevLeft = titleText.style.left;
    const prevRight = titleText.style.right;
    const prevAlign = titleText.style.textAlign;
    titleText.style.left = '0px';
    titleText.style.right = 'auto';
    titleText.style.textAlign = 'left';
    titleWidths.length = 0;
    THEMES.forEach(t => {
      titleText.textContent = t.title;
      titleWidths.push(titleText.offsetWidth);
    });
    titleText.textContent = prevText;
    titleText.style.left = prevLeft;
    titleText.style.right = prevRight;
    titleText.style.textAlign = prevAlign;
  };
  const titleBox = { rect: null };
  const wipeSize = { w: 0, h: 0 };
  /* 标题锚点只在换侧时写：left/right 是布局属性，每帧写会强制重排 */
  let titleAnchor = '';

  const setTone = theme => {
    const tone = theme.darkText ? 'dark' : 'light';
    if (tone !== lastTone) {
      lastTone = tone;
      stage.dataset.tone = tone;
    }
  };

  const render = progress => {
    if (DEBUG_COUNT) window.__renders = (window.__renders | 0) + 1;
    const vh = window.innerHeight;
    const raw = progress * 6;
    const index = clamp(Math.floor(raw), 0, THEMES.length - 1);
    const local = index === THEMES.length - 1 ? Math.min(1, raw - index) : raw - index;
    lastStageProgress = progress;
    /* 连续胶片位置：先把这一章的图片走完，停在「下一章第一张」；
       换主题的色块 / 标题 / 文案在停住之后才发生，切换完成（local = 1）再继续走片。
       否则会出现「图还是女书、底色已经到蝴蝶歌」的错位。 */
    const isLastTheme = index === THEMES.length - 1;
    const filmSpan = isLastTheme ? 1 : IMAGE_END;
    const filmSteps = isLastTheme ? Math.max(1, IMG_COUNTS[index] - 1) : IMG_COUNTS[index];
    const filmLocal = Math.min(local, filmSpan);
    const filmTarget = IMG_START[index] + (filmLocal / filmSpan) * filmSteps;
    if (imageFlowTheme !== index) {
      imageFlowTheme = index;
      /* 首次进入 / 大幅跨章时直接落位，避免整条胶片从上一章滑回来 */
      if (Math.abs(filmTarget - imageFlow) > 3.4) imageFlow = filmTarget;
    }
    imageFlowTarget = filmTarget;
    if (snapDirect || off('flow')) imageFlow = filmTarget;
    const theme = THEMES[index];
    const next = THEMES[index + 1] || null;
    const transitioning = !!next && local >= IMAGE_END;
    const q = transitioning ? clamp((local - IMAGE_END) / (1 - IMAGE_END), 0, 1) : 0;
    /* 擦除进度：等「下一个标题的第一个字」真的出现才开始；
       圆形背景、圆圈内层蒙版共用这个进度。 */
    const wipeStartQ = next
      ? .62 + .26 * invSmoothstep(1 / Math.max(1, next.title.length))
      : 1;
    const wipeT = (next && transitioning) ? clamp((q - wipeStartQ) / Math.max(.01, 1 - wipeStartQ), 0, 1) : 0;
    const wipeQ = (!off('wipe') && next && transitioning) ? 1 - (1 - wipeT) * (1 - wipeT) : 0;

    if (!off('tone')) setTone(q > .5 && next ? next : theme);
    if (!off('bg')) { setBg(bgA, theme); if (next) setBg(bgB, next); }


    const sideOf = i => i % 2 === 0 ? 'left' : 'right';
    const currentSide = sideOf(index);
    const boxWidth = title.clientWidth;
    /* 只在换主题时写文本并量一次：避免“写文本→读宽度”的每帧强制布局 */
    if (titleCache.key !== theme.key || !titleCache.w) {
      if (titleText.textContent !== theme.title) titleText.textContent = theme.title;
      titleCache.key = theme.key;
      titleCache.w = titleText.offsetWidth;
      titleCache.h = titleText.offsetHeight;
    }
    const fullTitleWidth = titleCache.w;
    const travel = Math.max(0, boxWidth - fullTitleWidth);

    /* 圆形蒙版圆心按“当前主题完整标题”计算一次；
       后面逐字删除/打入时不再跟着文字宽度抖动。 */
    /* 圆心必须用「相对背景图层」的坐标：getBoundingClientRect() 是视口坐标，
       缓存下来会带上当时的滚动位置（首屏时标题在视口下方 ~2820px），
       圆从屏幕外长出来就永远盖不满 —— 看起来就是"背景没有动画"。 */
    if (!titleBox.rect) {
      const tRect = title.getBoundingClientRect();
      const lRect = bgB.layer.getBoundingClientRect();
      titleBox.rect = {
        left: tRect.left - lRect.left,
        right: tRect.right - lRect.left,
        top: tRect.top - lRect.top
      };
    }
    const titleBoxRect = titleBox.rect;
    /* 圆形擦除从「下一主题标题」的正中间长出来：
       标题左右交替，圆心也跟着换到下一侧；没有下一主题时用当前标题。 */
    const originSide = next ? sideOf(index + 1) : currentSide;
    const originWidth = next ? (titleWidths[index + 1] || fullTitleWidth) : fullTitleWidth;
    /* 从「下一个标题第一个字」出现的位置长出来：左对齐在左端，右对齐在右端 */
    const originCharW = originWidth / Math.max(1, next ? next.title.length : theme.title.length);
    const wipeOriginX = originSide === 'left'
      ? titleBoxRect.left + originCharW * .5
      : titleBoxRect.right - originCharW * .5;
    const wipeOriginY = titleBoxRect.top + titleCache.h * .5;

    /* 大标题：先横向移动到另一侧，再在目标位置逐字删除，逐字打入下一标题。
       位移用 transform 表达（left/right 只在换侧时改），避免每帧触发布局。 */
    let titleValue = theme.title;
    let titleColor = theme.fg;
    let anchorSide = currentSide;
    let shift = 0;

    if (transitioning) {
      const nextSide = sideOf(index + 1);
      const move = smoothstep(0, .38, q);
      if (q < .38) {
        shift = (currentSide === 'left' ? 1 : -1) * travel * move;
      } else {
        anchorSide = nextSide;
        if (q < .58) {
          const keep = Math.ceil(theme.title.length * (1 - smoothstep(.38, .58, q)));
          titleValue = theme.title.slice(0, keep);
        } else if (q < .62) {
          titleValue = '';
        } else {
          const type = smoothstep(.62, .88, q);
          titleValue = next.title.slice(0, Math.floor(next.title.length * type));
        }
      }
      titleColor = q < .62 ? theme.fg : next.fg;
    }

    if (!off('title')) {
    if (titleAnchor !== anchorSide) {
      titleAnchor = anchorSide;
      if (anchorSide === 'left') {
        titleText.style.left = '0px';
        titleText.style.right = 'auto';
        titleText.style.textAlign = 'left';
      } else {
        titleText.style.left = 'auto';
        titleText.style.right = '0px';
        titleText.style.textAlign = 'right';
      }
    }
    setStyle(titleText, 'transform', shift ? 'translate3d(' + shift.toFixed(1) + 'px,0,0)' : 'none');

    if (titleText.textContent !== titleValue) titleText.textContent = titleValue;
    setStyle(title, 'color', titleColor);
    /* 圆形擦除：只写 transform（合成器属性），不再每帧重画背景 */
    /* 尺寸只变于 resize：每帧读 clientWidth 会在写完样式后强制同步布局 */
    const lw = wipeSize.w || (wipeSize.w = (bgB.layer.clientWidth || window.innerWidth));
    const lh = wipeSize.h || (wipeSize.h = (bgB.layer.clientHeight || window.innerHeight));
    const maxR = Math.max(
      Math.hypot(wipeOriginX, wipeOriginY),
      Math.hypot(lw - wipeOriginX, wipeOriginY),
      Math.hypot(wipeOriginX, lh - wipeOriginY),
      Math.hypot(lw - wipeOriginX, lh - wipeOriginY)
    ) * 1.02;
    const wipeCircle = bgB.circle;
    const wipeInner = bgB.inner;
    if (wipeCircle && wipeInner) {
      const R = Math.round(maxR);
      setStyle(wipeCircle, 'width', (R * 2) + 'px');
      setStyle(wipeCircle, 'height', (R * 2) + 'px');
      setStyle(wipeCircle, 'left', (wipeOriginX - R).toFixed(1) + 'px');
      setStyle(wipeCircle, 'top', (wipeOriginY - R).toFixed(1) + 'px');
      setStyle(wipeInner, 'width', lw + 'px');
      setStyle(wipeInner, 'height', lh + 'px');
      setStyle(wipeInner, 'left', (R - wipeOriginX).toFixed(1) + 'px');
      setStyle(wipeInner, 'top', (R - wipeOriginY).toFixed(1) + 'px');
      setStyle(wipeInner, 'transformOrigin', wipeOriginX.toFixed(1) + 'px ' + wipeOriginY.toFixed(1) + 'px');
      if (imagesWrap) {
        imagesWrap.style.setProperty('--wipe-x', wipeOriginX.toFixed(1) + 'px');
        imagesWrap.style.setProperty('--wipe-y', wipeOriginY.toFixed(1) + 'px');
        imagesWrap.style.setProperty('--wipe-r', (R * wipeQ).toFixed(1) + 'px');
      }
      const vis = wipeQ > .004;
      setStyle(wipeCircle, 'visibility', vis ? 'visible' : 'hidden');
      if (vis) {
        setStyle(wipeCircle, 'transform', 'scale(' + wipeQ.toFixed(4) + ')');
        setStyle(wipeInner, 'transform', 'scale(' + (1 / wipeQ).toFixed(4) + ')');
      }
    }
    }

    /* 图片恢复从左往右的路径：主图放大，前后图片以较小尺寸一起移动 */
    /* ---------- 连续胶片：整条横向移动 ---------- */
    const narrow = window.innerWidth <= 860;
    /* 窄屏没有左右分栏，胶片以屏幕中线为展示位、间距收紧一些 */
    /* 过渡时展示位从当前侧滑到下一侧：否则章节一边界，整条胶片会横跳 36vw */
    const sideCenter = side => narrow ? 50 : (side === 'left' ? 68 : 32);
    const focusCenter = transitioning
      ? sideCenter(currentSide) + (sideCenter(sideOf(index + 1)) - sideCenter(currentSide)) * smoothstep(.3, .85, q)
      : sideCenter(currentSide);
    const stride = narrow ? cardWidthVW * .74 : cardWidthVW * .82;   /* 相邻两张图的间距（vw）：收紧，别拉太开 */
    const bigScale = narrow ? 1.22 : 1.5;
    const smallScale = narrow ? .54 : .56;
    const lanes = narrow ? [4, -2, 5, -4] : [-9, -3, 3, 9];
    const focusNear = narrow ? 3 : FOCUS_NEAR;
    const focusFar = narrow ? 16 : FOCUS_FAR;
    const film = imageFlow;
    const halfCard = cardWidthVW * .5;

    const liveRange = 2.8;                          /* 同时参与动画的卡片范围（±张数） */
    const rankMap = new Map();
    if (IMG_COUNT < allCards.length) {
      allCards.map((c, idx) => ({ idx, d: Math.abs(c.n - film) }))
        .sort((a, b) => a.d - b.d)
        .forEach((e, r) => rankMap.set(e.idx, r));
    }
    const rankOf = idx => rankMap.get(idx) ?? 0;
    allCards.forEach(({ card, n, themeIndex }, order) => {
      if (off('img')) return;
      /* imgstatic：只摆一次、之后完全不动 —— 用来区分"元素存在"还是"每帧更新" */
      if (off('imgstatic') && card.dataset.staticFor === String(index)) return;
      /* 旧主题图片被新底色往左推走；边界不靠淡出，靠圆形蒙版硬切。 */
      let delta = n - film;                       /* 离展示位多少张图 */
      if (themeIndex < THEMES.length - 1) {
        const pushT = smoothstep(themeIndex + .86, themeIndex + 1.05, raw);
        delta -= Math.pow(pushT, 1.5) * 2.2;
      }
      const absD = Math.abs(delta);
      /* 只画最近的 imgCount 张：可以一张一张加，用来找"第几张开始卡" */
      const shown = Math.abs(delta) <= liveRange && rankOf(order) < IMG_COUNT;
      if (!shown) {
        if (card.style.visibility !== 'hidden') card.style.visibility = 'hidden';
        if (!off('imgwill') && card.classList.contains('is-live')) card.classList.remove('is-live');
        const farImg = card.firstElementChild;
        if (farImg && !off('imgsrc') && !off('imgcache') && absD > 3.4 && farImg.getAttribute('src')) farImg.removeAttribute('src');
        settleCard(card, focusCenter - halfCard + delta * stride, 0, 0, smallScale, 0);
        return;
      }
      if (!off('imgvis') && card.style.visibility !== 'visible') card.style.visibility = 'visible';
      const imgEl = card.firstElementChild;
      if (imgEl && !off('imgsrc') && !imgEl.getAttribute('src')) imgEl.src = card.dataset.src;
      if (!off('imgwill')) card.classList.add('is-live');
      const x = focusCenter - halfCard + delta * stride;
      const d = absD * stride;
      const focus = smoothstep(0, 1, 1 - clamp((d - focusNear) / (focusFar - focusNear), 0, 1));
      const rawScale = smallScale + (bigScale - smallScale) * focus;
      /* 关掉缩放观察栅格化代价；否则量化到 0.01，减少无意义的纹理重采样 */
      const scale = off('imgnoscale') ? 1 : Math.round(rawScale * 100) / 100;
      const y = lanes[order % lanes.length] * (1 - focus);
      const rotate = off('imgrot') ? 0 : (order % 2 ? -2.6 : 2.6) * (1 - focus);
      const edge = clamp((liveRange + .6 - absD) / .9, 0, 1);
      const opacity = off('imgop') ? 1 : Math.round(edge * (.72 + .28 * focus) * 100) / 100;
      /* z-index 分档写，避免每帧改堆叠顺序（会逼整层重新合成） */
      if (!off('imgz')) setStyle(card, 'zIndex', String(20 + Math.round(focus * 4) * 20));
      if (off('imgstatic')) card.dataset.staticFor = String(index);
      if (off('imgspring')) settleCard(card, x, y, rotate, scale, opacity);
      else pushCard(card, x, y, rotate, scale, opacity);
    });

    /* 圆内层与主轨同步：主轨显示圆外，内层显示圆内，边界硬切。 */
    const showIncoming = !off('wipe') && !!next && transitioning && wipeQ > .004;
    if (imageTrack) imageTrack.classList.toggle('is-wiping', showIncoming);
    if (incomingLayer) {
      incomingLayer.classList.toggle('is-wiping', showIncoming);
      incomingLayer.style.display = showIncoming ? 'block' : 'none';
      if (showIncoming) {
        allCards.forEach(({ card, themeIndex }, order) => {
          const inc = incomingClones[order];
          if (!inc) return;
          if (themeIndex !== index + 1) { inc.el.style.visibility = 'hidden'; return; }
          const img = inc.img;
          if (img && !img.getAttribute('src') && card.dataset.src) img.src = card.dataset.src;
          inc.el.classList.toggle('is-live', card.classList.contains('is-live'));
          inc.el.style.transform = card.style.transform;
          inc.el.style.opacity = card.style.opacity;
          inc.el.style.zIndex = card.style.zIndex;
          inc.el.style.visibility = card.style.visibility;
        });
      }
    }

    /* 胶片缓动由统一 tick 推进：这里只标记"需要继续动" */
    if (!off('img') && Math.abs(imageFlowTarget - imageFlow) > .01) requestTick();

    /* 小字：当前先退，等背景和大标题完成后下一组再进 */
    let activeCopy = index;
    copies.forEach((copy, i) => {
      let opacity = 0;
      if (!transitioning && i === index) opacity = 1;
      else if (transitioning && i === index) opacity = 1 - smoothstep(0, .28, q);
      else if (transitioning && i === index + 1) opacity = smoothstep(.8, 1, q);
      setStyle(copy, 'opacity', opacity.toFixed(3));
    });
    if (transitioning) {
      activeCopy = q > .84 ? index + 1 : index;
    }
    hudState.line = 'ch ' + (index + 1) + '  local ' + local.toFixed(2) + '  q ' + q.toFixed(2) + '  off: ' + ([...OFF].join(',') || '-');
    copies.forEach((copy, i) => {
      if (off('copy')) return;
      copy.classList.toggle('is-active', i === activeCopy);
      setStyle(copy, 'visibility', i === index || (transitioning && i === index + 1) ? 'visible' : 'hidden');
      setStyle(copy, 'pointerEvents', i === activeCopy ? 'auto' : 'none');
    });
    /* 切换期间整组按钮先退场：稳定到某一主题后才重新出现，避免点到下一章的按钮 */
    if (copiesWrap) copiesWrap.classList.toggle('is-transitioning', transitioning);
  };

  const computeProgress = () => {
    const vh = window.innerHeight;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, stage.offsetHeight - vh);
    return clamp((window.scrollY - stageTop) / range, 0, 1);
  };

  let targetProgress = computeProgress();
  let smoothProgress = targetProgress;
  let pendingProgress = null;

  /* ---------- 单帧调度：一个 rAF 里推进全部缓动，并且只渲染一次 ----------
     以前弹簧和胶片各有一个 rAF，胶片那一个还会再触发 render，
     等于同一帧渲染两次 —— 这就是"图片一出现，背景和大标题一顿一顿"的来源。 */
  let tickRaf = 0;
  let tickPrev = 0;
  let pendingRender = false;

  const requestTick = () => {
    if (tickRaf) return;
    tickRaf = requestAnimationFrame(tick);
  };

  const tick = now => {
    tickRaf = 0;
    const dt = tickPrev ? Math.min(.05, (now - tickPrev) / 1000) : 1 / 60;
    tickPrev = now;
    let moved = false;
    if (Math.abs(imageFlowTarget - imageFlow) > .01) {
      imageFlow += (imageFlowTarget - imageFlow) * (1 - Math.exp(-16 * dt));
      if (Math.abs(imageFlowTarget - imageFlow) < .01) imageFlow = imageFlowTarget;
      moved = true;
    }
    stepSprings(dt);
    if (!snapActive && !autoTrans.active && (pendingRender || moved)) {
      pendingRender = false;
      render(smoothProgress);
    }
    if (visualDirty.size || Math.abs(imageFlowTarget - imageFlow) > .01) requestTick();
    else tickPrev = 0;
  };

  /* 滚动只更新目标，并且请求一帧；真正的渲染在 tick 里做，一帧一次 */
  const requestRender = () => {
    targetProgress = computeProgress();
    smoothProgress = targetProgress;
    pendingRender = true;
    requestTick();
  };

  let scrollDirection = 0;
  let lastScrollY = window.scrollY;
  let snapTimer = 0;
  let snapActive = false;
  let snapRaf = 0;
  let snapExpectedY = 0;
  let snapSettleUntil = 0;
  let snapScrollBehavior = '';
  let snapDirect = false;
  let snapBoostMs = 0;   /* 滚轮给补完动画的提前量（毫秒） */
  /* 自动播放过渡动画的开关：false = 完全由滚动驱动，松手就停 */
  const AUTO_PLAY_TRANSITION = false;
  const autoTrans = { active: false, from: 0, to: 0, startedAt: 0, duration: 1800, boost: 0, raf: 0 };

  const cancelSnap = () => {
    if (snapTimer) {
      clearTimeout(snapTimer);
      snapTimer = 0;
    }
    snapSettleUntil = 0;
    if (!snapActive) return;
    snapActive = false;
    snapExpectedY = 0;
    if (snapRaf) cancelAnimationFrame(snapRaf);
    snapRaf = 0;
    document.documentElement.style.scrollBehavior = snapScrollBehavior;
  };

  const clearImageMomentum = () => {
    if (momentumTimer) {
      clearTimeout(momentumTimer);
      momentumTimer = 0;
    }
    if (momentumRaf) {
      cancelAnimationFrame(momentumRaf);
      momentumRaf = 0;
    }
    imageMomentum = 0;
  };

  /* 滚动停止后让图片带一点惯性余速，避免突然定格 */
  const settleImageMomentum = () => {
    if (snapActive || momentumRaf) return;
    const step = () => {
      if (snapActive) {
        momentumRaf = 0;
        return;
      }
      imageMomentum *= .9;
      if (Math.abs(imageMomentum) < .02) {
        imageMomentum = 0;
        render(targetProgress);
        momentumRaf = 0;
        return;
      }
      render(targetProgress);
      momentumRaf = requestAnimationFrame(step);
    };
    momentumRaf = requestAnimationFrame(step);
  };

  /* ---------- 滚动停止后的“补完” ----------
     舞台是滚动驱动的，停在半路就会定格在半路。停止时检查一次：
     还落在动画中间，就平滑补到最近的一个“已解决”位置。 ---------- */
  const runSnapTo = (targetY, duration) => {
    if (snapActive) return;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, stage.offsetHeight - window.innerHeight);
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 4) return;

    snapActive = true;
    snapDirect = true;
    snapBoostMs = 0;
    clearImageMomentum();

    /* 页面全局设置了 html{scroll-behavior:smooth}；
       自动补完必须临时改成 auto，否则每帧 scrollTo 都会重启浏览器平滑滚动。 */
    const root = document.documentElement;
    snapScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';

    const startedAt = performance.now();
    snapExpectedY = startY;

    const step = now => {
      if (!snapActive) return;
      const t = clamp((now - startedAt + snapBoostMs) / duration, 0, 1);
      const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let nextY = startY + distance * eased;
      /* 用户往前多滚了一点就顺势吸收进来（等于加速），不要跟用户抢 */
      const nativeY = window.scrollY;
      if (nativeY > nextY + 1) {
        snapExpectedY = nativeY;
        const nextProgress2 = clamp((nativeY - stageTop) / range, 0, 1);
        targetProgress = nextProgress2;
        smoothProgress = nextProgress2;
        render(nextProgress2);
        if (t >= 1) { /* 已经到点，走收尾 */ }
        else { snapRaf = requestAnimationFrame(step); return; }
      }
      snapExpectedY = nextY;
      window.scrollTo(0, nextY);

      /* 补完期间直接按 eased 位置渲染，绕开阻尼的“慢半拍” */
      const nextProgress = clamp((nextY - stageTop) / range, 0, 1);
      targetProgress = nextProgress;
      smoothProgress = nextProgress;
      render(nextProgress);

      if (t < 1) {
        snapRaf = requestAnimationFrame(step);
      } else {
        snapActive = false;
        snapDirect = false;
        snapExpectedY = 0;
        snapRaf = 0;
        root.style.scrollBehavior = snapScrollBehavior;
        lastScrollY = window.scrollY;
        snapSettleUntil = performance.now() + 160;
        targetProgress = nextProgress;
        smoothProgress = nextProgress;
        render(nextProgress);
      }
    };
    snapRaf = requestAnimationFrame(step);
  };

  /* 停在主题切换段：补完到下一个主题 */
  const maybeCompleteTransition = () => {
    if (snapActive) return false;
    const vh = window.innerHeight;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = stage.offsetHeight - vh;
    const y = window.scrollY;
    if (range <= 0 || y <= stageTop || y >= stageTop + range) return false;

    const p = clamp((y - stageTop) / range, 0, 1);
    const raw = p * THEMES.length;
    const index = Math.floor(raw);
    const local = raw - index;
    if (index >= THEMES.length - 1 || local < IMAGE_END) return false;

    const segment = range / THEMES.length;
    const targetY = Math.min(stageTop + (index + 1) * segment + 2, stageTop + range);
    if (targetY - y < 6) return false;

    runSnapTo(targetY, clamp(1400 + Math.abs(targetY - y) / vh * 900, 1600, 2600));
    return true;
  };
  /* ---------- 章节切换：时间驱动的擦除 ----------
     进入过渡段后自己按固定节奏跑完（约 1.8 秒），不依赖滚动、也不抢滚动；
     滚轮只往里加“提前量”，想快一点就接着滚。 */
  const stopAutoTransition = () => {
    autoTrans.active = false;
    autoTrans.boost = 0;
    if (autoTrans.raf) {
      cancelAnimationFrame(autoTrans.raf);
      autoTrans.raf = 0;
    }
  };

  const commitAutoTransition = () => {
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, stage.offsetHeight - window.innerHeight);
    const to = autoTrans.to;
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    /* 只在页面还落在后面时才补齐；用户已经滚过头就不要往回拉 */
    const targetY = stageTop + to * range;
    if (window.scrollY < targetY) window.scrollTo(0, targetY);
    root.style.scrollBehavior = prev;
    stopAutoTransition();
    lastScrollY = window.scrollY;
    snapSettleUntil = performance.now() + 160;
    targetProgress = to;
    smoothProgress = to;
    render(to);
  };

  const stepAutoTransition = now => {
    if (!autoTrans.active) return;
    const t = clamp((now - autoTrans.startedAt + autoTrans.boost) / autoTrans.duration, 0, 1);
    const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const p = autoTrans.from + (autoTrans.to - autoTrans.from) * eased;
    targetProgress = p;
    smoothProgress = p;
    render(p);
    if (t < 1) autoTrans.raf = requestAnimationFrame(stepAutoTransition);
    else commitAutoTransition();
  };

  const startAutoTransition = (progress, index) => {
    if (autoTrans.active) return false;
    const to = (index + 1) / THEMES.length;
    if (to <= progress + .002) return false;
    autoTrans.active = true;
    autoTrans.from = progress;
    autoTrans.to = to;
    autoTrans.startedAt = performance.now();
    autoTrans.boost = 0;
    autoTrans.raf = requestAnimationFrame(stepAutoTransition);
    return true;
  };

  const settleStage = () => {
    snapTimer = 0;
    if (snapActive || autoTrans.active) return;
    /* 真的停了才动：滚动还在进行时不抢用户的滚动权 */
    if (performance.now() - lastScrollAt < 140) return;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = stage.offsetHeight - window.innerHeight;
    const y = window.scrollY;
    if (range <= 0 || y <= stageTop || y >= stageTop + range) return;
    const p = clamp((y - stageTop) / range, 0, 1);
    const raw = p * THEMES.length;
    const index = Math.floor(raw);
    const local = raw - index;
    if (index >= THEMES.length - 1) return;
    if (AUTO_PLAY_TRANSITION && local >= IMAGE_END - .01) startAutoTransition(p, index);
  };


  let lastScrollAt = 0;
  const handleScroll = () => {
    lastScrollAt = performance.now();
    if (autoTrans.active) {
      const top0 = stage.getBoundingClientRect().top + window.scrollY;
      const range0 = Math.max(1, stage.offsetHeight - window.innerHeight);
      const p0 = clamp((window.scrollY - top0) / range0, 0, 1);
      if (p0 > autoTrans.to + .002) commitAutoTransition();
      else if (p0 < autoTrans.from - .003) { stopAutoTransition(); render(p0); }
      lastScrollY = window.scrollY;
      return;
    }
    if (performance.now() < snapSettleUntil) {
      lastScrollY = window.scrollY;
      return;
    }
    const y = window.scrollY;
    if (snapActive) {
      /* 只在用户明显往回拉的时候交还控制；往前多滚一点就让它继续跑 */
      if (snapExpectedY && y < snapExpectedY - 48) {
        cancelSnap();
      } else {
        lastScrollY = y;
        return;
      }
    }

    const dy = y - lastScrollY;
    if (y > lastScrollY + 1) scrollDirection = 1;
    else if (y < lastScrollY - 1) scrollDirection = -1;
    lastScrollY = y;

    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, stage.offsetHeight - window.innerHeight);
    const p = clamp((y - stageTop) / range, 0, 1);
    const raw = p * THEMES.length;
    const local = raw - Math.min(THEMES.length - 1, Math.floor(raw));

    if (p > 0 && p < 1 && local < IMAGE_END) {
      /* 不再给图片加惯性回弹：轨迹只由滚动位置决定，
         否则每步滚动都会被 ±3vw 的惯性推一下，看起来忽快忽慢。 */
      imageMomentum = 0;
    } else {
      clearImageMomentum();
    }

    requestRender();

    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = window.setTimeout(settleStage, 260);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => { titleCache.key = ''; titleBox.rect = null; wipeSize.w = 0; wipeSize.h = 0; measureTitleWidths(); });
  window.addEventListener('resize', requestRender);
  window.addEventListener('resize', measureCardWidth);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { titleCache.key = ''; measureTitleWidths(); requestRender(); });
  }
  /* 滚轮：补完动画进行中不打断，而是给它加提前量（滚轮加速）；
     明显往上滚才交还控制。 */
  window.addEventListener('wheel', event => {
    if (autoTrans.active) {
      if (event.deltaY < -24) { stopAutoTransition(); return; }
      autoTrans.boost += clamp(event.deltaY, 0, 180) * .9;
      return;
    }
    if (snapActive) {
      if (event.deltaY < -24) { cancelSnap(); return; }
      snapBoostMs += clamp(event.deltaY, 0, 180) * .55;
      return;
    }
    /* 没在补完时，滚轮只把“空闲检查”往后推，不要取消它——
       否则触控板的连续小滚动会让补完永远排不上队。 */
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = window.setTimeout(settleStage, 260);
  }, { passive: true });
  window.addEventListener('touchstart', cancelSnap, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      cancelSnap();
    }
  });

  /* 菜单里的 #ch-* 直接跳到对应主题所在的滚动段 */
  document.querySelectorAll('a[href^="#ch-"]').forEach(link => {
    link.addEventListener('click', event => {
      const key = link.getAttribute('href').slice(1).replace(/^ch-/, '');
      const index = THEMES.findIndex(theme => theme.key === key);
      if (index < 0) return;
      event.preventDefault();
      const stageTop = stage.getBoundingClientRect().top + window.scrollY;
      const segment = Math.max(1, (stage.offsetHeight - window.innerHeight) / THEMES.length);
      window.scrollTo({ top: stageTop + index * segment, behavior: 'smooth' });
      if (window.history && history.replaceState) {
        history.replaceState(null, '', '#' + link.getAttribute('href').slice(1));
      }
      const menu = document.getElementById('menu');
      if (menu && menu.getAttribute('aria-hidden') === 'false') {
        const close = document.getElementById('menuClose');
        if (close) close.click();
      }
    });
  });

  measureTitleWidths();
  render(smoothProgress);
})();
