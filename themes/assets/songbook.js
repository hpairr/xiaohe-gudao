/* 06 盘王大歌 · 歌本三个版本
   ------------------------------------------------------------
   事实依据：江华县人民政府《盘王大歌》——有三十六段、二十四段与十二段三种版本，
   后两种是前一种的摘选本；三十六段本包括三十六歌、七曲。
   二十四段、十二段保留哪些段目，公开资料没有对应表，因此这里只示段数与比例，
   不臆造「哪些段被删掉」。
   ------------------------------------------------------------ */
(function () {
  'use strict';

  var host = document.getElementById('songbookBook');
  if (!host) return;

  var linesEl = host.querySelector('.sb-lines');
  var countEl = host.querySelector('.sb-book-count b');
  var metaCount = host.querySelector('#sbCount');
  var metaRatio = host.querySelector('#sbRatio');
  var metaNature = host.querySelector('#sbNature');
  var metaLines = host.querySelector('#sbLinesMeta');
  var tabs = [].slice.call(host.querySelectorAll('.sb-tab'));

  var VERSIONS = {
    '36': { count: 36, ratio: '100%', nature: '全本 · 三十六歌、七曲', lines: '约八千行' },
    '24': { count: 24, ratio: '67%', nature: '摘选本', lines: '未见公开统计' },
    '12': { count: 12, ratio: '33%', nature: '摘选本', lines: '未见公开统计' }
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = '36';

  function render(v) {
    var item = VERSIONS[v];
    if (!item) return;
    current = v;
    var html = '';
    for (var i = 1; i <= item.count; i++) {
      html += '<span class="sb-line" style="--k:' + i + '"></span>';
    }
    linesEl.innerHTML = html;
    countEl.textContent = item.count;
    metaCount.textContent = item.count;
    metaRatio.textContent = item.ratio;
    metaNature.textContent = item.nature;
    metaLines.textContent = item.lines;
    tabs.forEach(function (t) {
      t.setAttribute('aria-pressed', t.getAttribute('data-v') === v ? 'true' : 'false');
    });
    if (reduce.matches) {
      [].slice.call(linesEl.children).forEach(function (el) { el.style.animation = 'none'; });
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { render(t.getAttribute('data-v')); });
  });

  host.querySelector('.sb-tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    var idx = tabs.indexOf(document.activeElement);
    if (idx < 0) idx = tabs.findIndex(function (t) { return t.getAttribute('data-v') === current; });
    var next = idx;
    if (e.key === 'ArrowRight') next = Math.min(tabs.length - 1, idx + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    e.preventDefault();
    tabs[next].focus();
    render(tabs[next].getAttribute('data-v'));
  });

  render('36');
})();
