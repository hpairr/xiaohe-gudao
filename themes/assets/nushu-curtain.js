/* ==========================================================================
   女书专题 · 字帘 / 单字查阅
   --------------------------------------------------------------------------
   这版是「平面网格 + 每列绕顶部横杆的极轻摆动」：
   没有重力下垂，也没有指针推帘 / 点字回弹；只保留 0.28–0.34° 的整列轻摆。
   点击一个字：字从帘上飞进右侧字格；再点一个字，前一个字飞回原位。
   滚动/滚轮时飞字立即落位，避免 fixed 幽灵和页面错位。

   帘上 144 个女书字，每个女书字形只出现一次（数据见 nushu-dict.js）。
   窄屏（<=1180）字格变成底部纸卡；<=720 帘子改 8 列 × 18 行。
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.NUSHU_DICT;
  if (!DATA || !DATA.entries || !DATA.entries.length) return;

  /* 运行时再去一次重：即使数据里有重复字形，帘上也只会出现一次 */
  var entries = [];
  var seenGlyph = Object.create(null);
  DATA.entries.forEach(function (item) {
    if (!item || !item.g || seenGlyph[item.g]) return;
    seenGlyph[item.g] = true;
    entries.push(item);
  });
  if (entries.length !== 144) {
    console.warn('[nushu-curtain] 帘上应为 144 字，当前 ' + entries.length + ' 字');
  }

  var TOTAL = (DATA.meta && DATA.meta.total) || 396;
  var EMPTY_GLOSS =
    '一字一音，常可记写多个同音汉字。';
  var DROPS = [18, 34, 8, 28, 44, 12, 38, 22, 46, 6, 30, 16];

  var curtain = document.getElementById('lexCurtain');
  var card = document.getElementById('lexCard');
  if (!curtain || !card) return;

  var slot = document.getElementById('lexSlot');
  var slotGlyph = document.getElementById('lexSlotGlyph');
  var focusEl = document.getElementById('lexFocus');
  var pronEl = document.getElementById('lexPron');
  var toneEl = document.getElementById('lexTone');
  var glossEl = document.getElementById('lexGloss');
  var serialEl = document.getElementById('lexSerial');
  var hanCountEl = document.getElementById('lexHanCount');
  var hanListEl = document.getElementById('lexHanList');
  var allDetails = document.getElementById('lexAll');
  var closeBtn = document.getElementById('lexClose');

  var scrim = document.createElement('div');
  scrim.className = 'lex-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  scrim.addEventListener('click', function () {
    if (state.current) close();
  });
  document.body.appendChild(scrim);

  var mqSheet = window.matchMedia('(max-width: 1180px)');
  var mqSmall = window.matchMedia('(max-width: 720px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var rootStyle = getComputedStyle(document.documentElement);
  var C_ON = (rootStyle.getPropertyValue('--on') || '#F2EDE2').trim();
  var C_MAIN = (rootStyle.getPropertyValue('--main') || '#A9362E').trim();

  /* hero 里的绳参数，原样保留 */
  var R_GRAV = 1500;       // 重力 px/s²
  var R_DRAG = 2.20;       // 空气阻尼(每秒)
  var R_ITER = 14;         // 距离约束松弛次数
  var R_SUB = 1 / 120;     // 固定子步长
  var R_SLACK = 0.03;      // 绳比行距长 3% → 自然微微下垂
  var R_COMP = 0.06;       // 受力时允许临时拉长 6%
  var R_GAIN_HOVER = 0.70; // 划过时的推力（hero 的 R_GAIN_HOVER）
  var R_FOLLOW = 3.2;      // 帘子跟手程度
  var R_IMP = 6;           // 单次事件的位移上限
  var FLOW = 0.55;         // hero 的 uSway：静止时的极轻呼吸

  var state = {
    cols: 0,
    rows: 0,
    current: null,
    buttons: [],
    flights: [],
    entered: false,
    visible: false,
    transformed: false
  };

  var detached = Object.create(null); // 被取走/正在归位的结点：node index -> true
  var rope = null;
  var restX = null;
  var restY = null;
  var colX = null;
  var colSeeds = null;
  var glyphSize = 30;
  var time = 0;
  var frameLast = 0;
  var io = null;
  var rzTimer = 0;

  /* ------------------------------------------------------------------ utils */
  function pad3(n) {
    return ('000' + n).slice(-3);
  }

  function splitPron(pron) {
    var match = String(pron || '').match(/^(.*?)(\d+)$/);
    if (!match) return { syllable: String(pron || ''), tone: '' };
    return { syllable: match[1], tone: match[2] };
  }

  function rectCenter(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function glyphSizeOf(el) {
    return parseFloat(getComputedStyle(el).fontSize) || 30;
  }

  function restCenter(node) {
    var r = curtain.getBoundingClientRect();
    return { x: r.left + restX[node], y: r.top + restY[node] };
  }

  function onMQ(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* ------------------------------------------------------------------ build */
  function build() {
    cancelFlights();
    settleDetachedExcept(-1);

    var keep = state.current ? state.current.entry : null;
    var cols = mqSmall.matches ? 8 : 12;
    var rows = Math.ceil(entries.length / cols);

    state.cols = cols;
    state.rows = rows;
    curtain.style.setProperty('--cols', String(cols));
    curtain.style.setProperty('--rows', String(rows));
    curtain.innerHTML = '';
    state.buttons = [];
    detached = Object.create(null);
    rope = null;
    state.transformed = false;

    var frag = document.createDocumentFragment();
    for (var c = 0; c < cols; c++) {
      var col = document.createElement('div');
      col.className = 'lex-col';
      col.style.setProperty('--drop', DROPS[c % DROPS.length] + 'px');
      col.style.setProperty('--sway-dur', (10.5 + (c % 5) * 1.05).toFixed(2) + 's');
      col.style.setProperty('--sway-delay', (-(c * 0.83)).toFixed(2) + 's');
      col.style.setProperty('--enter-delay', (c * 42) + 'ms');

      for (var r = 0; r < rows; r++) {
        var entry = entries[c * rows + r];
        if (!entry) continue;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lex-glyph';
        btn.dataset.i = String(entry.i);
        btn.title = entry.f + ' · ' + entry.p;
        btn.setAttribute(
          'aria-label',
          entry.f + '，江永方言读音 ' + entry.p + '，对应 ' + Array.from(entry.h).length + ' 个汉字'
        );
        btn.setAttribute('aria-pressed', 'false');
        btn.tabIndex = -1;

        var glyph = document.createElement('span');
        glyph.className = 'lex-g';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = entry.g;
        btn.appendChild(glyph);

        var item = {
          entry: entry,
          btn: btn,
          col: c,
          row: r,
          node: state.buttons.length
        };
        btn.addEventListener('click', (function (bound) {
          return function () {
            select(bound);
          };
        })(item));
        col.appendChild(btn);
        state.buttons.push(item);
      }
      frag.appendChild(col);
    }
    curtain.appendChild(frag);

    measureRest();
    buildRope();

    state.current = null;
    if (keep) {
      var kept = null;
      for (var i = 0; i < state.buttons.length; i++) {
        if (state.buttons[i].entry.i === keep.i) {
          kept = state.buttons[i];
          break;
        }
      }
      if (kept) {
        state.current = { entry: kept.entry, btn: kept.btn, node: kept.node };
        detached[kept.node] = true;
        kept.btn.classList.add('is-out');
        kept.btn.setAttribute('aria-pressed', 'true');
      } else {
        clearCard();
      }
    } else {
      clearCard();
    }

    state.buttons.forEach(function (item) {
      item.btn.setAttribute('aria-pressed', 'false');
    });
    if (state.current) state.current.btn.setAttribute('aria-pressed', 'true');

    var first = state.current ? state.current.btn : state.buttons[0] && state.buttons[0].btn;
    if (first) setRoving(first);

    watchVisibility();
  }

  function measureRest() {
    var rect = curtain.getBoundingClientRect();
    var n = state.buttons.length;
    restX = new Float32Array(n);
    restY = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var item = state.buttons[i];
      var r = item.btn.getBoundingClientRect();
      restX[i] = r.left + r.width / 2 - rect.left;
      restY[i] = r.top + r.height / 2 - rect.top;
      item.restX = restX[i];
      item.restY = restY[i];
    }
    glyphSize = state.buttons[0] ? glyphSizeOf(state.buttons[0].btn) : 30;
  }

  function buildRope() {
    var cols = state.cols;
    var rows = state.rows;
    var n = state.buttons.length;
    var nodes = new Float32Array(n * 4);
    var gain = new Float32Array(cols);
    colX = new Float32Array(cols);
    colSeeds = new Float32Array(cols);
    var seg = 0;

    for (var c = 0; c < cols; c++) {
      gain[c] = 0.90 + 0.20 * (((c * 53 + 17) % 97) / 97);
      colSeeds[c] = ((c * 37) % 97) / 97;
      var x0 = restX[c * rows];
      var y0 = restY[c * rows];
      var y1 = restY[c * rows + rows - 1];
      colX[c] = x0;
      seg = ((y1 - y0) / (rows - 1)) * (1 + R_SLACK);
      for (var r = 0; r < rows; r++) {
        var i = c * rows + r;
        var k = i * 4;
        var ry = y0 + r * seg;
        nodes[k] = x0;
        nodes[k + 1] = ry;
        nodes[k + 2] = x0;
        nodes[k + 3] = ry;
      }
    }

    rope = {
      cols: cols,
      rows: rows,
      step: seg,
      nodes: nodes,
      gain: gain,
      acc: 0
    };
    state.transformed = false;
  }

  /* 首帧立即按绳长落位，避免先闪一下整齐网格 */
  function applyRestTransformsOnce() {
    if (!rope || mqReduce.matches) return;
    applyTransforms();
  }

  /* ----------------------------------------------------------- rope physics */
  function isOffChain(node) {
    return detached[node] === true;
  }

  function ropeStep(h) {
    var R = rope;
    if (!R) return;
    var cols = R.cols;
    var rows = R.rows;
    var step = R.step;
    var nd = R.nodes;
    var g = R_GRAV * h * h;
    var d = 1 - R_DRAG * h;
    var c, y, i, k, x, yy, qx, qy, dx, dy, len, err, ux, uy, corr;

    /* 1) Verlet：重力 + 空气阻尼 */
    for (c = 0; c < cols; c++) {
      var acc = g * R.gain[c];
      for (y = 1; y < rows; y++) {
        if (isOffChain(c * rows + y)) continue;
        k = (c * rows + y) * 4;
        x = nd[k];
        yy = nd[k + 1];
        qx = nd[k + 2];
        qy = nd[k + 3];
        nd[k + 2] = x;
        nd[k + 3] = yy;
        nd[k] = x + (x - qx) * d;
        nd[k + 1] = yy + (yy - qy) * d + acc;
      }
    }

    /* 2) 距离约束：同一条绳不可拉长，也不可压短 */
    for (i = 0; i < R_ITER; i++) {
      for (c = 0; c < cols; c++) {
        var anchorY = isOffChain(c * rows) ? -1 : 0;
        if (anchorY < 0) {
          for (var ay = 1; ay < rows; ay++) {
            if (!isOffChain(c * rows + ay)) {
              anchorY = ay;
              break;
            }
          }
        }
        if (anchorY < 0) continue;

        var ka = (c * rows + anchorY) * 4;
        nd[ka] = colX[c];
        nd[ka + 1] = restY[c * rows + anchorY];
        nd[ka + 2] = nd[ka];
        nd[ka + 3] = nd[ka + 1];

        for (y = anchorY + 1; y < rows; y++) {
          var iaCell = c * rows + anchorY;
          var ibCell = c * rows + y;
          var want = step;

          if (y - anchorY > 1) {
            iaCell = c * rows + (y - 1);
            var gap = 1;
            while (gap < 4 && y - gap > anchorY && isOffChain(c * rows + (y - gap))) gap++;
            if (gap > 1) {
              iaCell = c * rows + (y - gap);
              want = step * gap;
            }
          }
          if (isOffChain(ibCell) || isOffChain(iaCell)) continue;

          var ia = iaCell * 4;
          var ib = ibCell * 4;
          dx = nd[ib] - nd[ia];
          dy = nd[ib + 1] - nd[ia + 1];
          len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          err = len - want;
          if (!(err > 1e-3 || err < -1e-3)) continue;

          var kk = (err > 0 && len > want * (1 + R_COMP)) ? 0.5 : 1.0;
          ux = dx / len;
          uy = dy / len;
          corr = err * 0.5 * kk;
          var iaIsAnchor = (iaCell - c * rows) === anchorY;
          if (iaIsAnchor) {
            nd[ib] -= ux * corr * 2;
            nd[ib + 1] -= uy * corr * 2;
          } else {
            nd[ib] -= ux * corr;
            nd[ib + 1] -= uy * corr;
            nd[ia] += ux * corr;
            nd[ia + 1] += uy * corr;
          }
        }
      }
    }
  }

  function ropePush(x, y, mdx, mdy, follow, gain) {
    var R = rope;
    if (!R) return;
    var cols = R.cols;
    var rows = R.rows;
    var nd = R.nodes;
    var rad = Math.max(40, R.step * 8);
    var rad2 = rad * rad;
    var inv = 1 / rad;
    var dmax = rows > 1 ? rows - 1 : 1;
    var mag = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mag < 0.05) return;
    var lim = R_IMP * gain;
    var kf = follow < lim / mag ? follow : lim / mag;
    var vx = mdx * kf;
    var vy = mdy * kf;

    for (var c = 0; c < cols; c++) {
      if (Math.abs(nd[c * rows * 4] - x) > rad + Math.abs(vx)) continue;
      for (var r = 1; r < rows; r++) {
        if (isOffChain(c * rows + r)) continue;
        var k = (c * rows + r) * 4;
        var ddx = nd[k] - x;
        var ddy = nd[k + 1] - y;
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 > rad2) continue;
        var q = 1 - Math.sqrt(d2) * inv;
        var depth = r / dmax;
        var hang = 0.30 + 0.70 * depth * depth;
        var w = q * q * hang;
        nd[k] += vx * w;
        nd[k + 2] += vx * w;
        nd[k + 1] += vy * w * 0.6;
        nd[k + 3] += vy * w * 0.6;
      }
    }
  }

  var lastPointerX = -1;
  var lastPointerY = -1;

  function pointerPos(event) {
    var r = curtain.getBoundingClientRect();
    return [event.clientX - r.left, event.clientY - r.top];
  }

  function sweep(pos, mdx, mdy) {
    var sp = Math.sqrt(mdx * mdx + mdy * mdy);
    if (sp < 0.35) return;
    ropePush(pos[0], pos[1], mdx, mdy, R_FOLLOW, R_GAIN_HOVER);
  }

  /* --------------------------------------------------------------- transforms */
  function applyTransforms() {
    if (!rope) return;
    var nodes = rope.nodes;
    var rows = state.rows;
    var cols = state.cols;
    var flow = FLOW;
    for (var i = 0; i < state.buttons.length; i++) {
      var item = state.buttons[i];
      var k = i * 4;
      var dx = nodes[k] - restX[i];
      var dy = nodes[k + 1] - restY[i];
      var depth = rows > 1 ? item.row / (rows - 1) : 0;
      var hang = 0.30 + 0.70 * depth * depth;
      var ph = time * 0.40 + colSeeds[item.col] * 6.2831853;
      var idle = (Math.sin(ph) * 0.76 + Math.sin(ph * 0.63 + 1.3) * 0.24) *
        0.030 * flow * hang * glyphSize;
      item.btn.style.transform =
        'translate3d(' + (dx + idle).toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
    }
    state.transformed = true;
  }

  function clearTransforms() {
    for (var i = 0; i < state.buttons.length; i++) {
      state.buttons[i].btn.style.transform = '';
    }
    state.transformed = false;
  }

  function frame(now) {
    var dt = Math.min((now - frameLast) / 1000, 0.05);
    frameLast = now;

    if (mqReduce.matches) {
      if (state.transformed) clearTransforms();
      requestAnimationFrame(frame);
      return;
    }
    if (!state.visible || !rope) {
      requestAnimationFrame(frame);
      return;
    }

    time += dt;
    rope.acc = Math.min(rope.acc + dt, 0.12);
    while (rope.acc >= R_SUB) {
      ropeStep(R_SUB);
      rope.acc -= R_SUB;
    }
    applyTransforms();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- entrance / visibility */
  function watchVisibility() {
    if (io) {
      io.disconnect();
      io = null;
    }
    if (!('IntersectionObserver' in window)) {
      state.visible = true;
      state.entered = true;
      curtain.classList.add('is-in', 'is-live');
      return;
    }
    io = new IntersectionObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var entering = list[i].isIntersecting;
        state.visible = entering;
        curtain.classList.toggle('is-live', entering);
        if (entering) {
          state.entered = true;
          curtain.classList.add('is-in');
        }
      }
    }, { threshold: 0.04 });
    io.observe(curtain);
  }

  /* ------------------------------------------------------------------ select */
  function select(item) {
    if (state.current && state.current.entry.i === item.entry.i) {
      close();
      return;
    }

    var old = state.current;
    cancelFlights();
    settleDetachedExcept(old ? old.node : -1);

    state.buttons.forEach(function (x) {
      x.btn.setAttribute('aria-pressed', 'false');
    });
    if (old) old.btn.classList.add('is-out');

    state.current = { entry: item.entry, btn: item.btn, node: item.node };
    item.btn.classList.add('is-out');
    item.btn.setAttribute('aria-pressed', 'true');
    detached[item.node] = true;

    if (mqSheet.matches) openSheet();
    updateCard(item.entry);

    if (mqReduce.matches) {
      if (old) {
        reattach(old.node);
        old.btn.classList.remove('is-out');
      }
      revealSlot(item.entry, false);
      return;
    }

    if (mqSheet.matches) {
      /* 窄屏：纸卡从底部上来，字在字格里弹出；不做跨屏飞行 */
      if (old) {
        reattach(old.node);
        old.btn.classList.remove('is-out');
      }
      pendingSlot();
      revealSlot(item.entry, true);
      return;
    }

    /* 桌面：旧字从字格飞回帘上，新字从帘上飞进字格 */
    pendingSlot();
    if (old) {
      var oldNode = old.node;
      var oldBtn = old.btn;
      flyGhost(old.entry.g, rectCenter(slot), rectCenter(oldBtn), {
        fromSize: glyphSizeOf(slotGlyph),
        toSize: glyphSize,
        fromColor: C_MAIN,
        toColor: C_ON,
        keep: 0,
        onDone: function () {
          reattach(oldNode);
          oldBtn.classList.remove('is-out');
        }
      });
    }
    flyGhost(item.entry.g, rectCenter(item.btn), rectCenter(slot), {
      fromSize: glyphSize,
      toSize: glyphSizeOf(slotGlyph),
      fromColor: C_ON,
      toColor: C_MAIN,
      keep: 320,
      onDone: function () {
        revealSlot(item.entry, false);
      }
    });
  }

  function close() {
    if (!state.current) return;
    var old = state.current;
    cancelFlights();
    settleDetachedExcept(old.node);

    state.current = null;
    state.buttons.forEach(function (x) {
      x.btn.setAttribute('aria-pressed', 'false');
    });

    if (!mqReduce.matches && !mqSheet.matches) {
      flyGhost(old.entry.g, rectCenter(slot), rectCenter(old.btn), {
        fromSize: glyphSizeOf(slotGlyph),
        toSize: glyphSize,
        fromColor: C_MAIN,
        toColor: C_ON,
        keep: 0,
        onDone: function () {
          reattach(old.node);
          old.btn.classList.remove('is-out');
        }
      });
    } else {
      reattach(old.node);
      old.btn.classList.remove('is-out');
    }

    clearCard();
    if (mqSheet.matches) closeSheet();

    var active = document.activeElement;
    if (old.btn && (active === closeBtn || active === document.body || !active)) {
      old.btn.focus({ preventScroll: true });
    }
  }

  function reattach(node) {
    if (!rope || !restX) return;
    var k = node * 4;
    rope.nodes[k] = restX[node];
    rope.nodes[k + 1] = restY[node];
    rope.nodes[k + 2] = restX[node];
    rope.nodes[k + 3] = restY[node];
    delete detached[node];
  }

  function settleDetachedExcept(keep) {
    var keys = Object.keys(detached);
    for (var i = 0; i < keys.length; i++) {
      var node = Number(keys[i]);
      if (node === keep) continue;
      reattach(node);
      var item = state.buttons[node];
      if (item) item.btn.classList.remove('is-out');
    }
  }

  /* ------------------------------------------------------------------ card */
  function updateCard(entry) {
    var pron = splitPron(entry.p);
    var chars = Array.from(entry.h);

    focusEl.textContent = entry.f;
    pronEl.textContent = pron.syllable;
    toneEl.textContent = pron.tone;
    toneEl.title = pron.tone ? '江永方言调值 ' + pron.tone : '';
    glossEl.textContent = entry.d;
    serialEl.textContent = pad3(entry.i + 1) + ' / ' + TOTAL;

    hanCountEl.textContent = '（' + chars.length + '）';
    hanListEl.innerHTML = '';
    chars.forEach(function (ch) {
      var span = document.createElement('span');
      span.className = 'lex-han' + (ch === entry.f ? ' is-focus' : '');
      span.textContent = ch;
      hanListEl.appendChild(span);
    });
    allDetails.hidden = chars.length < 2;
    allDetails.open = false;

    card.classList.add('is-filled');
    card.classList.remove('is-pending');
    closeBtn.hidden = false;
    card.setAttribute('aria-label', '女书字义查阅卡：' + entry.f + '，读音 ' + entry.p);
  }

  function clearCard() {
    card.classList.remove('is-filled', 'is-pending');
    slotGlyph.textContent = '';
    focusEl.textContent = '—';
    pronEl.textContent = '—';
    toneEl.textContent = '';
    toneEl.removeAttribute('title');
    glossEl.textContent = EMPTY_GLOSS;
    serialEl.textContent = '— / ' + TOTAL;
    hanListEl.innerHTML = '';
    hanCountEl.textContent = '';
    allDetails.hidden = true;
    allDetails.open = false;
    closeBtn.hidden = true;
    card.setAttribute('aria-label', '女书字义查阅卡');
  }

  function pendingSlot() {
    card.classList.add('is-pending');
    slotGlyph.textContent = '';
  }

  function revealSlot(entry, pop) {
    slotGlyph.textContent = entry.g;
    card.classList.remove('is-pending');
    card.classList.add('is-filled');
    if (pop && !mqReduce.matches) {
      slotGlyph.animate(
        [
          { opacity: 0, transform: 'scale(.55)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
      );
    }
  }

  function openSheet() {
    if (!mqSheet.matches) return;
    card.classList.add('is-open');
    card.inert = false;
    scrim.classList.add('is-on');
  }

  function closeSheet() {
    card.classList.remove('is-open');
    scrim.classList.remove('is-on');
    if (mqSheet.matches) card.inert = true;
  }

  /* ----------------------------------------------------------------- flights */
  function flyGhost(glyph, from, to, opts) {
    var ghost = document.createElement('span');
    ghost.className = 'lex-fly';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = glyph;
    ghost.style.fontSize = (opts.toSize || 64) + 'px';
    ghost.style.color = opts.fromColor || C_ON;
    document.body.appendChild(ghost);

    var w = ghost.offsetWidth || 40;
    var h = ghost.offsetHeight || 40;
    var targetSize = opts.toSize || 64;
    var startScale = (opts.fromSize || targetSize) / targetSize;
    var x0 = from.x - w / 2;
    var y0 = from.y - h / 2;
    var x1 = to.x - w / 2;
    var y1 = to.y - h / 2;

    var anim = ghost.animate(
      [
        {
          transform: 'translate(' + x0.toFixed(2) + 'px,' + y0.toFixed(2) + 'px) scale(' + startScale.toFixed(3) + ')',
          color: opts.fromColor || C_ON
        },
        {
          transform: 'translate(' + x1.toFixed(2) + 'px,' + y1.toFixed(2) + 'px) scale(1)',
          color: opts.toColor || C_MAIN
        }
      ],
      { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
    );

    var flight = { ghost: ghost, anim: anim, onDone: opts.onDone, done: false };
    state.flights.push(flight);

    anim.onfinish = function () {
      if (flight.done) return;
      flight.done = true;
      if (opts.onDone) opts.onDone();
      if (opts.keep) {
        window.setTimeout(function () {
          removeGhost(flight);
        }, opts.keep);
      } else {
        removeGhost(flight);
      }
    };
    return flight;
  }

  function removeGhost(flight) {
    if (flight.ghost && flight.ghost.parentNode) {
      flight.ghost.parentNode.removeChild(flight.ghost);
    }
    var index = state.flights.indexOf(flight);
    if (index >= 0) state.flights.splice(index, 1);
  }

  function cancelFlights() {
    state.flights.slice().forEach(function (flight) {
      flight.done = true;
      try {
        flight.anim.cancel();
      } catch (err) {
        /* 忽略：动画可能已经结束 */
      }
      if (flight.ghost && flight.ghost.parentNode) {
        flight.ghost.parentNode.removeChild(flight.ghost);
      }
    });
    state.flights = [];
    if (state.current) revealSlot(state.current.entry, false);
  }

  /* 滚轮/滚动一旦发生，飞字立刻落位：fixed 幽灵不跟滚动 */
  function finishFlights() {
    if (!state.flights.length) return;
    var flights = state.flights.slice();
    state.flights = [];
    flights.forEach(function (flight) {
      if (flight.done) {
        removeGhost(flight);
        return;
      }
      flight.done = true;
      try {
        flight.anim.cancel();
      } catch (err) {
        /* 忽略 */
      }
      removeGhost(flight);
      if (flight.onDone) flight.onDone();
    });
    if (state.current) revealSlot(state.current.entry, false);
  }

  window.addEventListener('wheel', function () {
    if (state.flights.length) finishFlights();
  }, { passive: true });
  window.addEventListener('scroll', function () {
    if (state.flights.length) finishFlights();
  }, { passive: true });

  /* ------------------------------------------------------------------ events */
  function setRoving(btn) {
    for (var i = 0; i < state.buttons.length; i++) {
      state.buttons[i].btn.tabIndex = -1;
    }
    if (btn) btn.tabIndex = 0;
  }

  curtain.addEventListener('focusin', function (event) {
    var btn = event.target.closest ? event.target.closest('.lex-glyph') : null;
    if (btn) setRoving(btn);
  });

  curtain.addEventListener('keydown', function (event) {
    var key = event.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' &&
        key !== 'ArrowRight' && key !== 'Home' && key !== 'End') {
      return;
    }
    var active = document.activeElement;
    var index = -1;
    for (var i = 0; i < state.buttons.length; i++) {
      if (state.buttons[i].btn === active) {
        index = i;
        break;
      }
    }
    if (index < 0) return;

    var col = Math.floor(index / state.rows);
    var row = index % state.rows;
    if (key === 'ArrowDown' && row < state.rows - 1) row++;
    else if (key === 'ArrowUp' && row > 0) row--;
    else if (key === 'ArrowRight' && col < state.cols - 1) col++;
    else if (key === 'ArrowLeft' && col > 0) col--;
    else if (key === 'Home') row = 0;
    else if (key === 'End') row = state.rows - 1;
    else return;

    var next = state.buttons[col * state.rows + row];
    if (!next) return;
    event.preventDefault();
    setRoving(next.btn);
    next.btn.focus();
  });

  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.current) close();
  });

  onMQ(mqSmall, function () {
    build();
  });

  onMQ(mqSheet, function () {
    if (mqSheet.matches) {
      if (state.current) {
        card.classList.add('is-open');
        card.inert = false;
        scrim.classList.add('is-on');
      } else {
        card.classList.remove('is-open');
        card.inert = true;
        scrim.classList.remove('is-on');
      }
    } else {
      card.classList.remove('is-open');
      card.inert = false;
      scrim.classList.remove('is-on');
    }
  });

  window.addEventListener('resize', function () {
    if (state.flights.length) finishFlights();
    window.clearTimeout(rzTimer);
    rzTimer = window.setTimeout(build, 180);
  }, { passive: true });

  /* -------------------------------------------------------------------- init */
  build();
  if (mqSheet.matches) card.inert = true;
  clearCard();
})();
