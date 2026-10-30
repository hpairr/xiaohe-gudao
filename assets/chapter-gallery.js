/* ==========================================================================
   首页六章 · 滚动驱动的竖向图版
   --------------------------------------------------------------------------
   图片不是叠在一起做交叉淡化，而是三张图从上到下排成一条竖向轨道。
   章节 sticky 后，页面继续滚动时轨道向上/向下移动，像卷轴一样换图。
   ========================================================================== */
(() => {
  'use strict';

  const DATA = {
    nushu: [
      { src: 'assets/img/nushu.jpg', w: 1100, h: 825, caption: '女书手稿与汉译', source: '公开资料图 · 课程演示', alt: '江永女书手稿，左侧为女书字形，右侧为汉字译文' },
      { src: 'images/主题图版/女书-博物馆.jpg', w: 1000, h: 667, caption: '江永女书生态博物馆', source: '永州政府网 · CICPHOTO', alt: '江永女书生态博物馆内，讲解员向观众介绍女书卷轴' },
      { src: 'images/主题图版/女书-墙.jpg', w: 1000, h: 667, caption: '女书墙', source: '永州政府网 · CICPHOTO', alt: '江永女书墙，白底墨书女书字符' }
      ,{ src: 'images/图片/23-江永女书-百科.jpg', w: 1024, h: 768, caption: '女书字符与汉译', source: '百度百科', alt: '江永女书字符与汉字译文对照' }
    ],
    butterfly: [
      { src: 'assets/img/butterfly.jpg', w: 550, h: 366, caption: '蝴蝶歌传承人群', source: '公开资料图 · 课程演示', alt: '富川瑶族蝴蝶歌传承人群' },
      { src: 'images/主题图版/蝴蝶歌-演出现场.jpg', w: 1600, h: 897, caption: '富川演出现场', source: '贺州新闻网', alt: '富川瑶族蝴蝶歌演出现场，歌手穿蓝色瑶族服饰' },
      { src: 'images/主题图版/蝴蝶歌-秀水村.jpg', w: 1500, h: 843, caption: '秀水村合唱', source: '新浪财经', alt: '秀水村牌楼前，瑶族群众合唱蝴蝶歌' }
      ,{ src: 'images/图片/24-蝴蝶歌表演-广西新闻网.jpg', w: 550, h: 366, caption: '蝴蝶歌传承人群', source: '广西新闻网', alt: '富川瑶族蝴蝶歌传承人群在舞台上合影' }
      ,{ src: 'images/图片/25-蝴蝶歌简谱-人人文档.jpg', w: 565, h: 753, caption: '蝴蝶歌简谱', source: '人人文档', alt: '蝴蝶歌二声部简谱' }
    ],
    drum: [
      { src: 'assets/img/drum.jpg', w: 1200, h: 828, caption: '瑶族长鼓舞', source: '公开资料图 · 课程演示', alt: '瑶族长鼓舞表演，舞者手持长鼓腾跃' },
      { src: 'images/主题图版/长鼓舞-连南.jpg', w: 1600, h: 1200, caption: '连南瑶寨展演', source: '南方+', alt: '连南瑶寨长鼓舞展演，舞者围圈击鼓' },
      { src: 'images/主题图版/长鼓舞-舞台.jpg', w: 1600, h: 1200, caption: '长鼓舞舞台', source: '南方+', alt: '长鼓舞舞台演出，演员在圆形舞台上击鼓' }
      ,{ src: 'images/图片/26-瑶族长鼓舞-百科.jpg', w: 1134, h: 783, caption: '瑶族长鼓舞', source: '百度百科', alt: '瑶族长鼓舞表演，舞者在山间击鼓起舞' }
    ],
    bridge: [
      { src: 'assets/img/bridge.jpg', w: 1100, h: 774, caption: '富川风雨桥', source: '公开资料图 · 课程演示', alt: '富川瑶族风雨桥，三孔石拱上架桥廊与桥亭' },
      { src: 'images/主题图版/风雨桥-回澜.jpg', w: 1080, h: 640, caption: '回澜 · 青龙风雨桥', source: '百度百科', alt: '富川回澜风雨桥与青龙风雨桥' },
      { src: 'images/主题图版/风雨桥-群桥.jpg', w: 1600, h: 1089, caption: '富川风雨桥群', source: '百度百科', alt: '富川瑶族风雨桥群，多座桥廊沿溪而建' }
      ,{ src: 'images/图片/17-富川瑶族风雨桥群-百科.jpg', w: 960, h: 675, caption: '风雨桥群', source: '百度百科', alt: '富川瑶族风雨桥群横跨河面' }
      ,{ src: 'images/图片/18-回澜风雨桥-百科.jpg', w: 500, h: 352, caption: '回澜风雨桥', source: '百度百科', alt: '富川回澜风雨桥与两岸村落' }
    ],
    panwang: [
      { src: 'assets/img/panwang.jpg', w: 810, h: 810, caption: '盘王印', source: '公开资料图 · 课程演示', alt: '盘王印方形绣片，红底几何纹' },
      { src: 'images/主题图版/盘王-江永.jpg', w: 1600, h: 1065, caption: '江永盘王节', source: '搜狐 · 江永', alt: '江永瑶族盘王节祭祀典礼，盘王雕像前的人群' },
      { src: 'images/主题图版/盘王-祭祀.jpg', w: 1600, h: 1067, caption: '盘王节祭祀', source: '永州政府网', alt: '江永盘王节祭祀表演，红毯与盘王像' }
    ],
    brocade: [
      { src: 'assets/img/brocade.jpg', w: 640, h: 465, caption: '瑶族服饰', source: '公开资料图 · 课程演示', alt: '富川瑶族传统服饰，妇女在门前合影' },
      { src: 'images/主题图版/织锦-万字纹.jpg', w: 1600, h: 1067, caption: '万字纹被面', source: '百度百科', alt: '富川瑶族织锦万字纹被面，几何纹样' },
      { src: 'images/主题图版/织锦-织机.jpg', w: 1080, h: 608, caption: '织锦技艺', source: '新浪', alt: '瑶族妇女在织机前织锦' }
      ,{ src: 'images/图片/30-富川瑶族风俗1-百家号.jpg', w: 640, h: 465, caption: '富川瑶族服饰', source: '百家号', alt: '富川瑶族女性传统服饰与头饰' }
      ,{ src: 'images/图片/31-富川瑶族风俗2-百家号.jpg', w: 640, h: 437, caption: '瑶族盛装', source: '百家号', alt: '富川瑶族节庆盛装人群' }
    ]
  };

  const galleries = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const make = figure => {
    const chapter = figure.closest('.chapter');
    const key = chapter && chapter.dataset.c;
    const items = DATA[key];
    if (!items || items.length < 2) return null;

    const caption = figure.querySelector('.ch-cap');
    const captionB = caption && caption.querySelector('b');
    const captionS = caption && caption.querySelector('span');
    const oldImage = figure.querySelector('img');
    if (!caption || !oldImage) return null;

    const track = document.createElement('div');
    track.className = 'ch-media-track';

    /* 两组相同的图片首尾相接，组成一张真正的长图 */
    const sequence = items.concat(items);
    const slides = [];
    sequence.forEach((item, index) => {
      const clone = index >= items.length;
      const slide = document.createElement('div');
      slide.className = 'ch-media-slide' + (clone ? ' ch-media-slide--clone' : '');
      if (clone) slide.setAttribute('aria-hidden', 'true');
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = clone ? '' : item.alt;
      img.width = item.w;
      img.height = item.h;
      img.loading = 'eager';
      img.decoding = 'async';
      slide.appendChild(img);
      track.appendChild(slide);
      slides.push(slide);
    });

    const counter = document.createElement('div');
    counter.className = 'ch-media-counter';
    counter.setAttribute('aria-hidden', 'true');
    counter.innerHTML = '<b>01</b><span>/ ' + String(items.length).padStart(2, '0') + '</span>';

    oldImage.remove();
    figure.insertBefore(track, caption);
    figure.insertBefore(counter, caption);

    const gallery = {
      figure,
      chapter,
      items,
      track,
      slides,
      captionB,
      captionS,
      counterB: counter.querySelector('b'),
      active: -1,
      visible: false,
      offset: 0,
      segment: 0,
      loop: 0,

      setMeta(index) {
        if (index === this.active) return;
        this.active = index;
        if (this.captionB) this.captionB.textContent = items[index].caption;
        if (this.captionS) this.captionS.textContent = 'SOURCE / ' + items[index].source;
        if (this.counterB) this.counterB.textContent = String(index + 1).padStart(2, '0');
      },

      measure() {
        const segment = this.slides[0] ? this.slides[0].offsetHeight : 0;
        const total = this.track.scrollHeight;
        this.segment = segment;
        this.loop = total / 2;
      }
    };

    gallery.setMeta(0);
    galleries.push(gallery);
    chapter.__chapterGallery = gallery;
    return gallery;
  };

  document.querySelectorAll('.chapter .ch-media').forEach(make);
  if (!galleries.length) return;

  galleries.forEach(gallery => gallery.measure());

  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target.__chapterGallery) {
          entry.target.__chapterGallery.visible = entry.isIntersecting;
        }
      });
    }, { threshold: 0.15 });
    galleries.forEach(gallery => visibility.observe(gallery.chapter));
  } else {
    galleries.forEach(gallery => { gallery.visible = true; });
  }

  if (!reduceMotion) {
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(80, now - last);
      last = now;

      galleries.forEach(gallery => {
        if (!gallery.visible) return;
        if (!gallery.segment || !gallery.loop) gallery.measure();
        if (!gallery.segment || !gallery.loop) return;

        gallery.offset += (gallery.segment / 5600) * dt;
        if (gallery.offset >= gallery.loop) gallery.offset -= gallery.loop;

        gallery.track.style.transform =
          'translate3d(0,' + (-gallery.offset).toFixed(2) + 'px,0)';

        const index = Math.floor(gallery.offset / gallery.segment) % gallery.items.length;
        gallery.setMeta(index);
      });

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
