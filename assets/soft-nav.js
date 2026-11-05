/* ==========================================================================
   潇贺古道 · 首页 → 专题 同页切换（soft-nav.js）
   --------------------------------------------------------------------------
   为什么需要它：六章每章有自己的声音，进专题页时如果整页跳转，浏览器的
   AudioContext 会随旧文档一起销毁，音乐必然断掉；换文档后也拿不到手势，
   新页面无法自己恢复播放。所以在首页拦下「进专题」的点击，在同一份文档里
   换掉 head 样式与 body 内容 —— 音频节点活在 JS 里，不受 DOM 替换影响。

   几个必须处理的地方：
   · pushState 之后 document.baseURI 变成专题页 URL，所有相对路径会错位：
     因此 body 内的 src/href/srcset 一律先按专题页 URL 转成绝对地址。
   · 音频坐标要换掉：换了 body 之后 chapter-stage 已不在文档里，
     必须让 audio-player 知道“这里是专题页”，否则滚动逻辑还在按六章跑。
   · 只做一次：同一份文档里连续换两次，专题页脚本的全局监听会叠加。
     第二次起走正常跳转（整页加载，状态干净）。
   · 任何一步失败都退回普通跳转，宁可掉声音也不能把页面搞坏。
   ========================================================================== */
(() => {
  'use strict';

  if (window.__xiaoheSoftNav) return;
  window.__xiaoheSoftNav = true;

  /* 只接管首页进专题；其它链接（数据库、返回主页、外链）保持整页跳转 */
  const THEME_PATH = /\/themes\/[^/?]+\.html?$/i;
  let used = false;
  let busy = false;

  const absolutize = (root, baseUrl) => {
    const FIX = ['src', 'href', 'poster', 'data-src'];
    root.querySelectorAll('*').forEach(node => {
      FIX.forEach(attr => {
        const value = node.getAttribute && node.getAttribute(attr);
        if (!value) return;
        if (value.startsWith('#') || value.startsWith('data:') || value.startsWith('mailto:') ||
            value.startsWith('tel:') || /^[a-z]+:\/\//i.test(value)) return;
        try { node.setAttribute(attr, new URL(value, baseUrl).href); } catch (err) { /* 保持原样 */ }
      });
      const srcset = node.getAttribute && node.getAttribute('srcset');
      if (srcset && !/^[a-z]+:\/\//i.test(srcset)) {
        const fixed = srcset.split(',').map(part => {
          const bits = part.trim().split(/\s+/);
          try { bits[0] = new URL(bits[0], baseUrl).href; } catch (err) { /* 保持原样 */ }
          return bits.join(' ');
        }).join(', ');
        node.setAttribute('srcset', fixed);
      }
    });
  };

  const swapStyles = (doc, baseUrl) => {
    const keep = [];
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(node => keep.push(node));
    keep.forEach(node => node.remove());

    const incoming = [];
    doc.head.querySelectorAll('link[rel="stylesheet"], style').forEach(node => incoming.push(node));
    incoming.forEach(node => {
      if (node.tagName === 'STYLE') {
        const style = document.createElement('style');
        style.textContent = node.textContent;
        document.head.appendChild(style);
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL(node.getAttribute('href'), baseUrl).href;
      if (node.media) link.media = node.media;
      document.head.appendChild(link);
    });
  };

  const runScript = script => new Promise(resolve => {
    const el = document.createElement('script');
    if (script.src) {
      /* 音频引擎已经在跑，绝不能第二次执行（会建出第二套 AudioContext） */
      if (/audio-player\.js(\?|$)/.test(script.src)) return resolve();
      el.src = script.src;
      el.async = false;
      el.onload = resolve;
      el.onerror = resolve;
      document.body.appendChild(el);
      return;
    }
    el.textContent = script.textContent;
    document.body.appendChild(el);
    resolve();
  });

  const applyDoc = async (doc, url) => {
    /* 1. 样式：先把新的一份挂上，再摘旧的，避免中间态白屏 */
    swapStyles(doc, url);

    /* 2. 标题与描述 */
    const title = doc.querySelector('title');
    if (title) document.title = title.textContent;
    const desc = doc.querySelector('meta[name="description"]');

    /* 3. body 内容（脚本单独收集，稍后按序执行） */
    const scripts = Array.from(doc.body.querySelectorAll('script'));
    const holder = doc.createElement('div');
    holder.innerHTML = doc.body.innerHTML;
    holder.querySelectorAll('script').forEach(node => node.remove());
    absolutize(holder, url);

    document.body.className = doc.body.className;
    Array.from(document.body.attributes).forEach(attr => {
      if (attr.name !== 'class') document.body.removeAttribute(attr.name);
    });
    Array.from(doc.body.attributes).forEach(attr => {
      if (attr.name !== 'class') document.body.setAttribute(attr.name, attr.value);
    });
    document.body.innerHTML = holder.innerHTML;

    /* 4. 先把地址换成专题页：专题页的头部内联脚本靠 location.search 判断要不要播开场 */
    history.pushState({ softNav: true }, '', url);

    /* 5. 执行专题页自己的头部内联脚本（开场的 is-arriving 序列）与正文脚本 */
    for (const script of Array.from(doc.head.querySelectorAll('script:not([src])'))) {
      await runScript(script);
    }
    for (const script of scripts) {
      if (script.src) {
        script.src = new URL(script.src, url).href;
      }
      await runScript(script);
    }

    /* 6. 换掉六章的坐标：chapter-stage 已经不在文档里了 */
    if (window.XiaoheAudioPlayer && window.XiaoheAudioPlayer.refresh) {
      window.XiaoheAudioPlayer.refresh();
    }

    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('xiaohe:softnav', { detail: { url } }));
  };

  /* 预取 + 缓存：卡片一点就开始取，等整屏被主题色盖住时文档已经在手上 */
  const docCache = new Map();
  const fetchDoc = url => {
    if (docCache.has(url)) return docCache.get(url);
    const task = fetch(url, { credentials: 'same-origin' }).then(res => {
      if (!res.ok) throw new Error('soft nav fetch failed: ' + res.status);
      return res.text();
    });
    docCache.set(url, task);
    task.catch(() => docCache.delete(url));
    return task;
  };

  const navigate = async (href, url) => {
    busy = true;
    try {
      const html = await fetchDoc(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.body) throw new Error('soft nav: empty document');
      await applyDoc(doc, url);
      used = true;
    } catch (err) {
      /* 任何意外：老实整页跳转（宁可掉声音，也不能把页面搞坏） */
      if (window.console && console.warn) console.warn('[soft-nav] 回退到整页跳转：', err);
      window.location.href = href;
    } finally {
      busy = false;
    }
  };

  document.addEventListener('click', event => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download') || anchor.hasAttribute('data-no-softnav')) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    let url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (!THEME_PATH.test(url.pathname)) return;

    /* 首页的主题卡片有自己的颜色过渡（runHandoff）：它已经 preventDefault，
       1.42 秒后整屏被主题色盖住时再调 XiaoheSoftNav.go()。这里只顺手预取 HTML，
       等换文档时就不用现等网络。 */
    if (event.defaultPrevented) {
      fetchDoc(url.href).catch(() => {});
      return;
    }

    /* 没有过渡动画的入口（例如舞台上的「进入专题」）：直接换 */
    if (used || busy) return;
    event.preventDefault();
    navigate(href, url.href);
  }, false);

  /* 给首页的过渡动画调用：整屏被主题色盖住的那一刻换文档 */
  const go = href => {
    let url;
    try { url = new URL(href, window.location.href); } catch (err) {
      window.location.href = href;
      return;
    }
    if (used || busy) { window.location.href = href; return; }
    navigate(href, url.href);
  };

  window.XiaoheSoftNav = { go };

  /* 软导航后按后退：地址回到首页但 DOM 还是专题页，重新加载最干净 */
  window.addEventListener('popstate', () => {
    if (used) window.location.reload();
  });
})();
