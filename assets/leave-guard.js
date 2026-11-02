/* ============================================================
   潇贺古道 · 外链中转守卫（leave-guard.js）
   作用：点开外站链接时，先走 leave.html 中转确认；站内跳转、
        同页锚点、下载链接、mailto/tel 一律不拦。
   接入：在页面里加一行（根目录页面）
           <script src="assets/leave-guard.js" defer></script>
        专题页在 themes/ 下，用
           <script src="../assets/leave-guard.js" defer></script>
   跳过单个链接：<a href="…" data-no-guard>…
   脚本调用：window.leaveGuard.open('https://…')
   ============================================================ */
(function () {
  'use strict';

  if (window.__xiaoheLeaveGuard) return;
  window.__xiaoheLeaveGuard = true;

  /* 中转页地址从本脚本的位置推出来，根目录页与 themes/ 页共用同一份脚本 */
  var script = document.currentScript;
  if (!script || !script.src) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/(^|\/)leave-guard\.js(\?|$)/.test(all[i].src)) { script = all[i]; break; }
    }
  }
  var leaveUrl;
  try {
    leaveUrl = new URL('../leave.html', script.src);
  } catch (err) {
    leaveUrl = new URL('leave.html', location.href);
  }

  function toLeaveUrl(href, newTab) {
    var url = new URL(leaveUrl.href);
    url.searchParams.set('to', href);
    url.searchParams.set('from', location.pathname + location.hash);
    if (newTab) url.searchParams.set('tab', '1');
    return url.href;
  }

  /* 返回需要中转的绝对地址；站内、非 http(s)、同页锚点返回 null */
  function externalUrl(anchor) {
    var url;
    try {
      url = new URL(anchor.getAttribute('href'), document.baseURI);
    } catch (err) {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    /* 站内一律不拦：包含 database.html#/sounds 这类哈希路由与页内锚点 */
    if (url.origin === location.origin) return null;
    return url;
  }

  function onClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    if (anchor.hasAttribute('data-no-guard') || anchor.hasAttribute('download')) return;
    if (anchor.getAttribute('href').charAt(0) === '#') return;

    var url = externalUrl(anchor);
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    var newTab = anchor.target === '_blank' || anchor.target === '_new';
    location.assign(toLeaveUrl(url.href, newTab));
  }

  document.addEventListener('click', onClick, true);

  window.leaveGuard = {
    url: leaveUrl.href,
    hrefFor: toLeaveUrl,
    open: function (href, newTab) {
      location.assign(toLeaveUrl(href, newTab === true));
    }
  };
})();
