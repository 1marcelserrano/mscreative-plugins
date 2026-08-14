(() => {
  const FPC = (globalThis.__FPC ||= {});
  const MIN_OVERFLOW = 200;

  function depthOf(el) {
    let depth = 0;
    let node = el;
    while ((node = node.parentElement)) depth += 1;
    return depth;
  }

  function visibleAreaOf(rect) {
    const largura = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const altura = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return largura * altura;
  }

  function rotulo(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classe = el.classList[0] ? `.${el.classList[0]}` : '';
    return `${tag}${id}${classe}`;
  }

  function describe(el, id, isDocument) {
    const rect = isDocument
      ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
      : el.getBoundingClientRect();
    return {
      id,
      scrollHeight: el.scrollHeight,
      clientHeight: isDocument ? innerHeight : el.clientHeight,
      overflowY: isDocument ? 'visible' : getComputedStyle(el).overflowY,
      visibleArea: visibleAreaOf(rect),
      depth: isDocument ? 0 : depthOf(el),
      isDocument,
      label: isDocument ? 'a página inteira' : rotulo(el),
    };
  }

  FPC.elements = [];

  FPC.collect = () => {
    const raiz = document.scrollingElement || document.documentElement;
    FPC.elements = [raiz];
    const descritores = [describe(raiz, 0, true)];

    for (const el of document.body.querySelectorAll('*')) {
      if (el.hasAttribute('data-fpc-ui')) continue;
      if (el.scrollHeight - el.clientHeight < MIN_OVERFLOW) continue;
      const id = FPC.elements.length;
      FPC.elements.push(el);
      descritores.push(describe(el, id, false));
    }
    return descritores;
  };

  FPC.elementById = (id) => FPC.elements[id];
})();
