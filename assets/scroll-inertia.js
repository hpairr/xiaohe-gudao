/* ------------------------------------------------------------------
   滚动惯性（鼠标 / 触控板）
   —— 接管 wheel，把滚动位置做成"位置追目标"的缓动：
      滚轮停下后，页面还会继续滑行一小段再收住。
   关闭方式：地址加 ?no-inertia，或系统开启"减弱动态效果"。
   触屏设备不接管（保留原生滚动）。
   ------------------------------------------------------------------ */
(() => {
  const href = location.href;
  if (/[?&]no-inertia/.test(href)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  const root = document.documentElement;
  const EASE = 6.5;          /* 越小滑得越久 */
  const EPS = 0.5;           /* 收尾阈值（px） */

  let target = window.scrollY;
  let current = target;
  let raf = 0;
  let prev = 0;
  let writing = false;

  const maxY = () => Math.max(0, root.scrollHeight - window.innerHeight);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const write = y => {
    writing = true;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    root.style.scrollBehavior = prevBehavior;
    writing = false;
  };

  const step = now => {
    const dt = prev ? Math.min(.05, (now - prev) / 1000) : 1 / 60;
    prev = now;
    const diff = target - current;
    current += diff * (1 - Math.exp(-EASE * dt));
    if (Math.abs(diff) < EPS) {
      current = target;
      write(current);
      raf = 0;
      prev = 0;
      return;
    }
    write(current);
    raf = requestAnimationFrame(step);
  };

  const kick = () => {
    if (raf) return;
    prev = 0;
    raf = requestAnimationFrame(step);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    prev = 0;
  };

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (document.body.classList.contains('menu-open')) return;          /* 目录打开时让位 */
    if (event.target && event.target.closest && event.target.closest('[data-native-scroll]')) return;
    if (maxY() <= 0) return;

    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? window.innerHeight : 1);
    /* 以真实位置为基准，避免长时间的累积漂移 */
    current = window.scrollY;
    target = clamp(target + event.deltaY * unit, 0, maxY());
    kick();
  }, { passive: false });

  /* 外部滚动（键盘、滚动条、锚点跳转、舞台自动补完）：立刻同步，不与它抢 */
  window.addEventListener('scroll', () => {
    if (writing) return;
    const y = window.scrollY;
    if (raf) {
      /* 程序化的大跳（补完动画等）会在这里出现，直接把惯性交还 */
      if (Math.abs(y - current) > 80) {
        stop();
        target = current = y;
      }
      return;
    }
    target = current = y;
  }, { passive: true });

  window.addEventListener('resize', () => {
    stop();
    target = current = window.scrollY;
  });
})();
