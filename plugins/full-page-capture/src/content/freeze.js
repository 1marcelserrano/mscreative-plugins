(() => {
  const FPC = (globalThis.__FPC ||= {});
  let guardados = null;
  let estiloGlobal = null;

  const CSS_GLOBAL = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
    ::-webkit-scrollbar { display: none !important; }
  `;

  FPC.freeze = () => {
    if (guardados) return;
    guardados = [];

    estiloGlobal = document.createElement('style');
    estiloGlobal.setAttribute('data-fpc-ui', '');
    estiloGlobal.textContent = CSS_GLOBAL;
    document.documentElement.append(estiloGlobal);

    for (const el of document.body.querySelectorAll('*')) {
      if (el.hasAttribute('data-fpc-ui')) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      guardados.push({
        el,
        pos,
        visibility: el.style.visibility,
        position: el.style.position,
      });
    }
  };

  FPC.hideFixed = () => {
    if (!guardados) return;
    for (const item of guardados) {
      if (item.pos === 'fixed') item.el.style.visibility = 'hidden';
      else item.el.style.position = 'static';
    }
  };

  FPC.restore = () => {
    if (!guardados) return;
    for (const item of guardados) {
      item.el.style.visibility = item.visibility;
      item.el.style.position = item.position;
    }
    guardados = null;
    estiloGlobal?.remove();
    estiloGlobal = null;
  };
})();
