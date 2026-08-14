(() => {
  const FPC = (globalThis.__FPC ||= {});

  const CSS = `
    :host { all: initial; }
    .contorno {
      position: fixed; pointer-events: none; z-index: 2147483646;
      border: 2px solid #b4c636; background: rgba(180, 198, 54, 0.12);
      transition: all 120ms ease;
    }
    .caixa {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      display: flex; gap: 8px; align-items: center;
      padding: 12px 16px; border-radius: 10px;
      background: #111114; color: #b2a898;
      font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,.4);
    }
    .caixa strong { color: #f4f1ea; font-weight: 600; }
    button {
      font: inherit; padding: 6px 12px; border: 0; border-radius: 6px; cursor: pointer;
      background: #b2a898; color: #111114;
    }
    button.secundario { background: transparent; color: #b2a898; border: 1px solid #4a463f; }
  `;

  function montar() {
    const host = document.createElement('div');
    host.setAttribute('data-fpc-ui', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    shadow.append(estilo);
    document.documentElement.append(host);
    return { host, shadow };
  }

  function posicionar(contorno, el, isDocument) {
    if (isDocument) {
      Object.assign(contorno.style, {
        left: '0px',
        top: '0px',
        width: `${innerWidth - 4}px`,
        height: `${innerHeight - 4}px`,
      });
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(contorno.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width - 4}px`,
      height: `${r.height - 4}px`,
    });
  }

  FPC.confirm = (candidatos) =>
    new Promise((resolve) => {
      const { host, shadow } = montar();
      let indice = 0;

      const contorno = document.createElement('div');
      contorno.className = 'contorno';
      const caixa = document.createElement('div');
      caixa.className = 'caixa';
      const texto = document.createElement('span');
      const sim = document.createElement('button');
      sim.textContent = 'Capturar';
      const trocar = document.createElement('button');
      trocar.className = 'secundario';
      trocar.textContent = 'Outro';
      const cancelar = document.createElement('button');
      cancelar.className = 'secundario';
      cancelar.textContent = 'Cancelar';
      caixa.append(texto, sim, trocar, cancelar);
      shadow.append(contorno, caixa);

      function pintar() {
        const atual = candidatos[indice];
        posicionar(contorno, FPC.elementById(atual.id), atual.isDocument);
        texto.textContent = '';
        const forte = document.createElement('strong');
        forte.textContent = atual.label;
        texto.append('Capturar ', forte, '?');
        trocar.style.display = candidatos.length > 1 ? '' : 'none';
      }

      function fechar(resultado) {
        removeEventListener('keydown', aoTeclar, true);
        host.remove();
        resolve(resultado);
      }

      function aoTeclar(evento) {
        if (evento.key === 'Escape') fechar({ cancelado: true });
        if (evento.key === 'Enter') fechar({ id: candidatos[indice].id });
      }

      sim.addEventListener('click', () => fechar({ id: candidatos[indice].id }));
      cancelar.addEventListener('click', () => fechar({ cancelado: true }));
      trocar.addEventListener('click', () => {
        indice = (indice + 1) % candidatos.length;
        pintar();
      });
      addEventListener('keydown', aoTeclar, true);

      pintar();
    });
})();
