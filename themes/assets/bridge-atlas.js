/* 05 风雨桥 · 桥谱（年表 + 相片条 + 名录）
   ------------------------------------------------------------
   数据：富川县人民政府《富川风雨桥（27 座）》2024-03-19
        http://www.gxfc.gov.cn/fcgk/jdjj/t10824361.shtml
   图版：贺州市生态环境局《富川风雨桥摄影展》（摄影：谭玉婷，2021）
        版权未获书面授权，仅作毕设非商业展示。
   交互：拖年表 / 拖相片条 / 点名录；键盘 ← → Home End。
   prefers-reduced-motion 下不做平滑滚动与淡入。
   ------------------------------------------------------------ */
(function () {
  'use strict';

  var host = document.getElementById('bridgeAtlas');
  if (!host) return;

  var BRIDGES = [
    { n:"回澜", y:1602, era:"明", t:"石拱", s:"石拱 · 三孔", p:"朝东镇 · 油沐／沐笼", img:"01", d:"三孔石拱，桥廊、桥亭、楼阁俱全；楼阁砖墙有人物花鸟壁画，脊饰保存较好。桥上立 12 块修桥石碑，其中明代陕西道监察御史何廷枢所书《重建廻澜石亭桥》，是研究这一带风雨桥史的重要材料。" },
    { n:"朝阳", y:1607, era:"明", t:"木梁", s:"木梁", p:"城北镇 · 凤溪", img:"02", d:"石拱之上以横梁分为三跨，跨间架楞木铺桥板；廊亭进深五间，穿斗式木构架、小青瓦屋面，桥头两端建马头墙。" },
    { n:"福寿", y:1608, era:"明", t:"木梁", s:"木梁", p:"城北镇 · 凤溪", img:"03", d:"两岸桥台利用溪中基岩砌石，杉木梁上铺板为桥面；廊亭进深五间，桥头两端建马头墙。" },
    { n:"凤溪新桥", y:1621, era:"明", t:"木梁", s:"木梁", p:"城北镇 · 凤溪", img:"04", d:"跨村中小溪，廊屋进深三间，穿斗式木构架、小青瓦屋面，桥头两端建马头墙。" },
    { n:"青龙", y:1624, era:"明", t:"石拱", s:"石拱 · 单孔", p:"朝东镇 · 黄沙河", img:"05", d:"单孔石拱，中部设桥亭、歇山屋顶；南桥头方形砖木阁楼高三层，每层檐下 32 扇木质花窗，四柱为莲花鼓形柱础，一层内墙嵌多块石碑。与回澜桥合称「阴阳桥」。" },
    { n:"黄侯泉", y:1626, era:"明", t:"石梁", s:"石梁", p:"麦岭镇 · 黄侯泉", img:"06", d:"料石砌台，石梁上架廊；桥亭小青瓦歇山顶，共三层，两端建马头山墙。" },
    { n:"高桥", y:1733, era:"清早中期", t:"砖木", s:"砖木", p:"麦岭镇 · 高桥", img:"07", d:"以河西岸高耸岩石作桥基，24 根大木梁分五层纵横叠架；亭为 24 柱抬梁式构架，三层檐，两端接砖砌挡封墙。" },
    { n:"石漕迴龙", y:1741, era:"清早中期", t:"木梁", s:"木梁", p:"城北镇 · 石漕母", img:"08", d:"料石桥台，共 2 跨；廊亭进深五间，三层檐，顶层做杉木板条卷棚，桥头两端建马头墙。" },
    { n:"东辕", y:1769, era:"清早中期", t:"石梁", s:"石梁", p:"朝东镇 · 白面寨", img:"09", d:"青砖桥面，廊亭进深五间，穿斗式木构架，桥头两端建马头墙。" },
    { n:"鸬鹚塘", y:1770, era:"清早中期", t:"石梁", s:"石梁 · 四跨", p:"麦岭镇 · 宝剑", img:"10", d:"料石墩台，共 4 跨；廊亭进深五间，风雨桥两端均设有拴马石。" },
    { n:"龙归", y:1775, era:"清早中期", t:"木梁", s:"木梁", p:"朝东镇 · 龙归", img:"11", d:"料石墩台，杉木梁上铺板为桥面；廊亭进深五间，桥头两端建马头墙。" },
    { n:"兴隆", y:1813, era:"清早中期", t:"木梁", s:"木梁", p:"朝东镇 · 岔山", img:"12", d:"料石桥台，廊亭进深八间，桥亭设两层、歇山屋顶，是群内廊屋进深较大的一座。" },
    { n:"石垒阳寿", y:1817, era:"清早中期", t:"木梁", s:"木梁", p:"城北镇 · 两源", img:"13", d:"毛石砌台，廊亭进深三间，穿斗式木构架、小青瓦屋面。" },
    { n:"永济福", y:1827, era:"清早中期", t:"石梁", s:"石梁", p:"城北镇 · 巍丰大", img:"14", d:"地面与两岸桥台均用料石，廊亭进深三间；梁架上的坐兽保存较好，桥头两端建马头墙。" },
    { n:"环涧", y:1842, era:"清早中期", t:"木梁", s:"木梁", p:"朝东镇 · 长塘", img:"15", d:"料石桥台，廊亭进深三间、歇山屋顶；桥面已改造为钢筋混凝土板。" },
    { n:"锦桥", y:1842, era:"清早中期", t:"石拱", s:"石拱", p:"朝东镇 · 福溪", img:"16", d:"青石板桥面，廊亭进深三间，均作歇山屋顶，桥头两端建马头墙。" },
    { n:"下井", y:1847, era:"清早中期", t:"石梁", s:"石梁", p:"城北镇 · 下井", img:"17", d:"料石墩台，共 2 跨；廊亭进深五间，穿斗式木构架。" },
    { n:"新田青龙", y:1855, era:"清后期", t:"木梁", s:"木梁", p:"城北镇 · 茅家", img:"18", d:"红砖砌台，杉木梁上铺板；廊亭进深三间、歇山屋顶，桥头两端建马头墙。" },
    { n:"长塘迴龙", y:1866, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 苦竹湾", img:"27", d:"毛石砌台，共 2 跨；廊亭进深三间、歇山屋顶，桥面已改造为钢筋混凝土板。" },
    { n:"龙湾", y:1879, era:"清后期", t:"木梁", s:"木梁", p:"石家乡 · 龙湾刘家", img:"19", d:"料石墩台，廊亭进深七间，穿斗式木构架、小青瓦屋面，桥头两端建马头墙。" },
    { n:"儒子西门", y:1884, era:"清后期", t:"石梁", s:"石梁", p:"朝东镇 · 儒子", img:"20", d:"青砖桥面，廊亭进深三间，桥头两端建马头墙。" },
    { n:"集贤", y:1885, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 油沐沐笼", img:"21", d:"料石墩台，廊亭进深五间，穿斗式木构架、小青瓦屋面。" },
    { n:"双溪", y:1885, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 东水", img:"22", d:"料石墩台，廊亭进深七间，桥头两端建马头墙。" },
    { n:"社尾岗", y:1885, era:"清后期", t:"石拱梁", s:"石拱梁", p:"朝东镇 · 油沐岗湾", img:"23", d:"青石板桥面，廊亭进深三间，硬山屋顶。" },
    { n:"毓秀", y:1885, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 油沐沐笼", img:"24", d:"料石墩台，廊亭进深五间，穿斗式木构架、小青瓦屋面。" },
    { n:"儒子东门", y:1887, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 儒子", img:"25", d:"桥面改为钢筋混凝土板；廊屋进深三间、硬山屋顶，穿斗式木构架。" },
    { n:"钟灵", y:1904, era:"清后期", t:"木梁", s:"木梁", p:"朝东镇 · 福溪", img:"26", d:"料石墩台，杉木梁上铺板；廊亭进深三间，穿斗式木构架、小青瓦屋面。" },
  ];

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var axis = host.querySelector('.atlas-axis');
  var phasesEl = host.querySelector('.axis-phases');
  var ticksEl = host.querySelector('.axis-ticks');
  var cursor = host.querySelector('.axis-cursor');
  var yearEl = host.querySelector('.axis-year');
  var strip = host.querySelector('.atlas-strip');
  var track = host.querySelector('.atlas-track');
  var detail = host.querySelector('.atlas-detail');
  var img = host.querySelector('.atlas-plate img');
  var cap = host.querySelector('.atlas-plate figcaption');
  var kicker = host.querySelector('.atlas-kicker');
  var nameEl = host.querySelector('.atlas-name');
  var typeEl = host.querySelector('.atlas-type');
  var placeEl = host.querySelector('.atlas-place');
  var descEl = host.querySelector('.atlas-desc');
  var rows = [].slice.call(host.querySelectorAll('tr[data-i]'));

  if (!axis || !strip || !detail) return;

  var Y0 = 1596, Y1 = 1910;
  function pct(year) { return (year - Y0) / (Y1 - Y0) * 100; }

  var PHASES = [
    { label: '明', years: '1602—1626', a: 1602, b: 1626 },
    { label: '清早中期', years: '1733—1847', a: 1733, b: 1847 },
    { label: '清后期', years: '1855—1904', a: 1855, b: 1904 }
  ];

  phasesEl.innerHTML = PHASES.map(function (p) {
    return '<div class="axis-phase" style="left:' + pct(p.a).toFixed(3) + '%;width:' +
      (pct(p.b) - pct(p.a)).toFixed(3) + '%"><b>' + p.label + '<i>' + p.years + '</i></b></div>';
  }).join('');

  ticksEl.innerHTML = BRIDGES.map(function (b, i) {
    return '<span class="axis-tick" data-i="' + i + '" style="left:' + pct(b.y).toFixed(3) + '%"></span>';
  }).join('');
  var ticks = [].slice.call(ticksEl.children);

  track.innerHTML = BRIDGES.map(function (b, i) {
    return '<button type="button" class="bthumb" data-i="' + i + '" aria-pressed="false" aria-label="' +
      b.n + '，' + b.y + ' 年，' + b.s + '，' + b.p + '">' +
      '<span class="bthumb-media"><img src="assets/bridge/' + b.img + '.webp" alt="" width="554" height="314" loading="lazy" decoding="async"></span>' +
      '<span>' + b.n + '<b>' + b.y + '</b></span></button>';
  }).join('');
  var thumbs = [].slice.call(track.children);

  function credit(b) {
    return b.n === '长塘迴龙'
      ? '图源：澎湃新闻《贺州这 27 座风雨桥》'
      : '摄影：谭玉婷 · 贺州市生态环境局《富川风雨桥摄影展》2021';
  }

  var sel = -1;
  var token = 0;

  function select(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(BRIDGES.length - 1, i));
    if (i === sel && !opts.force) return;
    sel = i;
    var b = BRIDGES[i];

    thumbs.forEach(function (t, k) { t.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    ticks.forEach(function (t, k) {
      t.classList.toggle('is-on', k <= i);
      t.classList.toggle('is-cur', k === i);
    });
    rows.forEach(function (r) {
      r.classList.toggle('is-cur', Number(r.getAttribute('data-i')) === i);
    });

    cursor.style.left = pct(b.y).toFixed(3) + '%';
    yearEl.textContent = b.y;
    axis.setAttribute('aria-valuenow', b.y);
    axis.setAttribute('aria-valuetext', b.n + '，' + b.y + ' 年，' + b.s + '，' + b.p);

    kicker.textContent = b.era + ' · ' + b.y;
    nameEl.textContent = b.n;
    typeEl.textContent = b.s;
    placeEl.textContent = b.p;
    descEl.textContent = b.d;
    img.alt = b.n + '风雨桥，' + b.s;
    cap.textContent = b.n + '风雨桥　' + credit(b);

    /* 图片先预载再换，避免拖动时闪白 */
    var tok = ++token;
    var next = 'assets/bridge/' + b.img + '.webp';
    var pre = new Image();
    pre.onload = pre.onerror = function () {
      if (tok === token) img.src = next;
    };
    pre.src = next;

    if (opts.reveal !== false) {
      var t = thumbs[i];
      var left = t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: reduce.matches ? 'auto' : 'smooth' });
    }
  }

  /* ---------------- 年表拖拽 ---------------- */
  function yearAt(clientX) {
    var r = axis.getBoundingClientRect();
    var t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Y0 + t * (Y1 - Y0);
  }

  function nearest(year) {
    var best = 0, dist = Infinity;
    BRIDGES.forEach(function (b, i) {
      var d = Math.abs(b.y - year);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  }

  var dragging = false;
  axis.addEventListener('pointerdown', function (e) {
    dragging = true;
    axis.classList.add('is-dragging');
    if (axis.setPointerCapture) axis.setPointerCapture(e.pointerId);
    select(nearest(yearAt(e.clientX)));
    e.preventDefault();
  });
  axis.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    select(nearest(yearAt(e.clientX)));
  });
  function endDrag(e) {
    dragging = false;
    axis.classList.remove('is-dragging');
    if (axis.hasPointerCapture && axis.hasPointerCapture(e.pointerId)) axis.releasePointerCapture(e.pointerId);
  }
  axis.addEventListener('pointerup', endDrag);
  axis.addEventListener('pointercancel', endDrag);

  axis.addEventListener('keydown', function (e) {
    var n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = sel + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = sel - 1;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = BRIDGES.length - 1;
    else return;
    e.preventDefault();
    select(n);
  });

  ticksEl.addEventListener('click', function (e) {
    var t = e.target.closest('.axis-tick');
    if (t) select(Number(t.getAttribute('data-i')));
  });

  /* ---------------- 相片条 ---------------- */
  track.addEventListener('click', function (e) {
    var t = e.target.closest('.bthumb');
    if (!t) return;
    select(Number(t.getAttribute('data-i')), { reveal: false });
  });

  strip.addEventListener('keydown', function (e) {
    var n = null;
    if (e.key === 'ArrowRight') n = Math.min(BRIDGES.length - 1, sel + 1);
    else if (e.key === 'ArrowLeft') n = Math.max(0, sel - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = BRIDGES.length - 1;
    else return;
    e.preventDefault();
    select(n);
    thumbs[n].focus({ preventScroll: true });
  });

  /* 鼠标拖动横向滚动；触屏交给浏览器原生滚动 */
  var scrollDrag = false, startX = 0, startLeft = 0, movedTotal = 0;
  strip.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    scrollDrag = true;
    startX = e.clientX;
    startLeft = strip.scrollLeft;
    movedTotal = 0;
  });
  strip.addEventListener('pointermove', function (e) {
    if (!scrollDrag) return;
    var dx = e.clientX - startX;
    movedTotal = Math.max(movedTotal, Math.abs(dx));
    strip.scrollLeft = startLeft - dx;
  });
  function endScrollDrag() { scrollDrag = false; }
  strip.addEventListener('pointerup', endScrollDrag);
  strip.addEventListener('pointerleave', endScrollDrag);
  strip.addEventListener('click', function (e) {
    if (movedTotal > 6) { e.preventDefault(); e.stopPropagation(); }
    movedTotal = 0;
  }, true);

  /* ---------------- 名录 ---------------- */
  host.querySelectorAll('button.rn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      select(Number(btn.getAttribute('data-i')));
    });
  });

  select(0, { force: true, reveal: false });
})();
