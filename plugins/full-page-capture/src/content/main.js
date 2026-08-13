(() => {
  const FPC = (globalThis.__FPC ||= {});
  if (FPC.ready) return;
  FPC.ready = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = FPC.handlers?.[message?.type];
    if (!handler) return false;
    Promise.resolve(handler(message))
      .then(sendResponse)
      .catch((error) => sendResponse({ erro: String(error?.message ?? error) }));
    return true;
  });

  FPC.handlers = {
    'fpc:collect': () => ({
      descriptors: FPC.collect(),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }),
    'fpc:confirm': (message) => FPC.confirm(message.candidates),
    'fpc:freeze': () => {
      FPC.freeze();
      return { ok: true };
    },
    'fpc:restore': () => {
      FPC.restore();
      return { ok: true };
    },
  };
})();
