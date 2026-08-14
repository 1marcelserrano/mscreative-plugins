(() => {
  const FPC = (globalThis.__FPC ||= {});

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const doisQuadros = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  function naTela(img) {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  }

  function domQuieto(quietMs, tetoMs) {
    return new Promise((resolve) => {
      let relogio = setTimeout(fim, quietMs);
      const limite = setTimeout(fim, tetoMs);
      const observador = new MutationObserver(() => {
        clearTimeout(relogio);
        relogio = setTimeout(fim, quietMs);
      });
      observador.observe(document.body, { childList: true, subtree: true, attributes: true });

      function fim() {
        clearTimeout(relogio);
        clearTimeout(limite);
        observador.disconnect();
        resolve();
      }
    });
  }

  FPC.settle = async ({ quietMs = 250, timeoutMs = 2000 } = {}) => {
    const inicio = performance.now();
    await doisQuadros();

    const pendentes = [...document.images].filter((img) => naTela(img) && !img.complete);
    if (pendentes.length) {
      await Promise.race([
        Promise.allSettled(pendentes.map((img) => img.decode().catch(() => {}))),
        dormir(timeoutMs),
      ]);
    }

    const sobra = Math.max(0, timeoutMs - (performance.now() - inicio));
    await domQuieto(quietMs, sobra);
  };
})();
