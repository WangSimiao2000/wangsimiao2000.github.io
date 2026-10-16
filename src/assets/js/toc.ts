/**
 * 阅读面板的目录：跟随正文高亮当前章节、显示阅读进度；窄屏时由顶栏「目录」按钮开关。
 * 面板内容每次换页都会整体替换，所以每次打开后重新 bind，返回的函数用于解绑。
 */
export function bindToc(reader: HTMLElement): () => void {
  const scroller = reader.querySelector<HTMLElement>('[data-reader-scroll]');
  const side = reader.querySelector<HTMLElement>('.side-left');
  const list = reader.querySelector<HTMLElement>('[data-toc]');
  const btn = reader.querySelector<HTMLButtonElement>('[data-toc-toggle]');
  const bar = reader.querySelector<HTMLElement>('.read-progress');
  if (!scroller || !side || !list) return () => {};

  const links = [...list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  let active = -1;
  let raf = 0;

  function update() {
    raf = 0;
    const max = scroller!.scrollHeight - scroller!.clientHeight;
    const read = max > 0 ? scroller!.scrollTop / max : 1;
    bar?.style.setProperty('--read', read.toFixed(4));
    // 当前章节：标题已经滚过面板上沿附近的最后一个；滚到底时算最后一节
    const top = scroller!.getBoundingClientRect().top + 72;
    let idx = -1;
    heads.forEach((h, i) => {
      if (h && h.getBoundingClientRect().top <= top) idx = i;
    });
    if (read > 0.995) idx = heads.length - 1;
    if (idx !== active) {
      links[active]?.classList.remove('is-active');
      links[active]?.removeAttribute('aria-current');
      active = idx;
      const a = links[active];
      if (a) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'true');
        // 只滚目录自己，不用 scrollIntoView（它会连带滚动页面）
        const box = list!.getBoundingClientRect();
        const r = a.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) list!.scrollTop += r.top - box.top - box.height / 3;
      }
    }
  }
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  let closeTimer = 0;
  function setOpen(on: boolean) {
    clearTimeout(closeTimer);
    btn?.setAttribute('aria-expanded', String(on));
    if (on) {
      side!.classList.add('is-open');
      void side!.offsetWidth;
      side!.classList.add('is-shown');
    } else {
      side!.classList.remove('is-shown');
      closeTimer = window.setTimeout(() => side!.classList.remove('is-open'), 180);
    }
  }
  const onBtn = () => setOpen(!side.classList.contains('is-shown'));
  const onPick = (e: Event) => {
    if ((e.target as Element).closest('a')) setOpen(false);
  };
  const onOutside = (e: Event) => {
    const t = e.target as Element;
    if (side.classList.contains('is-shown') && !side.contains(t) && !btn?.contains(t)) setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && side.classList.contains('is-shown')) {
      // 先收起目录，这一下 Esc 不关闭面板
      e.stopImmediatePropagation();
      setOpen(false);
      btn?.focus();
    }
  };

  scroller.addEventListener('scroll', onScroll, { passive: true });
  btn?.addEventListener('click', onBtn);
  list.addEventListener('click', onPick);
  document.addEventListener('pointerdown', onOutside);
  window.addEventListener('keydown', onKey, true);
  update();

  return () => {
    cancelAnimationFrame(raf);
    scroller.removeEventListener('scroll', onScroll);
    btn?.removeEventListener('click', onBtn);
    list.removeEventListener('click', onPick);
    document.removeEventListener('pointerdown', onOutside);
    window.removeEventListener('keydown', onKey, true);
  };
}
