(() => {
  const FPC = (globalThis.__FPC ||= {});

  function rectDoAlvo(el, isDocument) {
    if (isDocument) return { x: 0, y: 0, width: innerWidth, height: innerHeight };
    const b = el.getBoundingClientRect();
    const x = Math.max(0, b.left);
    const y = Math.max(0, b.top);
    return {
      x,
      y,
      width: Math.min(b.width, innerWidth - x),
      height: Math.min(b.height, innerHeight - y),
    };
  }

  FPC.step = async ({ id, index }) => {
    const el = FPC.elementById(id);
    const isDocument = el === (document.scrollingElement || document.documentElement);
    const alturaVisivel = isDocument ? innerHeight : el.clientHeight;

    el.scrollTop = index * alturaVisivel;
    if (index > 0) FPC.hideFixed();
    await FPC.settle();

    const scrollTop = el.scrollTop;
    const total = el.scrollHeight;

    return {
      scrollTop,
      rect: rectDoAlvo(el, isDocument),
      fim: scrollTop + alturaVisivel >= total - 1,
      total,
    };
  };
})();
