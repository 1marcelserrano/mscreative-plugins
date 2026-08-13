import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStitch } from '../src/lib/plan-stitch.mjs';

const rect = { x: 0, y: 0, width: 1200, height: 800 };

test('dois quadros sem sobreposição empilham na altura', () => {
  const plano = planStitch([{ scrollTop: 0, rect }, { scrollTop: 800, rect }], { dpr: 1, scale: 1 });
  assert.equal(plano.width, 1200);
  assert.equal(plano.height, 1600);
  assert.deepEqual(plano.placements[1], {
    sx: 0, sy: 0, sw: 1200, sh: 800, dx: 0, dy: 800, dw: 1200, dh: 800,
  });
});

test('o último quadro se sobrepõe e não estica a imagem', () => {
  const plano = planStitch(
    [{ scrollTop: 0, rect }, { scrollTop: 800, rect }, { scrollTop: 1300, rect }],
    { dpr: 1, scale: 1 },
  );
  assert.equal(plano.height, 2100);
  assert.equal(plano.placements[2].dy, 1300);
});

test('densidade de pixel 2 dobra origem e destino', () => {
  const plano = planStitch([{ scrollTop: 0, rect }, { scrollTop: 800, rect }], { dpr: 2, scale: 1 });
  assert.equal(plano.width, 2400);
  assert.equal(plano.height, 3200);
  assert.deepEqual(plano.placements[1], {
    sx: 0, sy: 0, sw: 2400, sh: 1600, dx: 0, dy: 1600, dw: 2400, dh: 1600,
  });
});

test('resolução simples reduz o destino mas não a origem', () => {
  const plano = planStitch([{ scrollTop: 0, rect }], { dpr: 2, scale: 0.5 });
  assert.equal(plano.width, 1200);
  assert.equal(plano.height, 800);
  assert.deepEqual(plano.placements[0], {
    sx: 0, sy: 0, sw: 2400, sh: 1600, dx: 0, dy: 0, dw: 1200, dh: 800,
  });
});

test('painel interno recorta pelo retângulo dele', () => {
  const painel = { x: 320, y: 64, width: 880, height: 736 };
  const plano = planStitch([{ scrollTop: 0, rect: painel }], { dpr: 2, scale: 1 });
  assert.equal(plano.width, 1760);
  assert.equal(plano.height, 1472);
  assert.deepEqual(plano.placements[0], {
    sx: 640, sy: 128, sw: 1760, sh: 1472, dx: 0, dy: 0, dw: 1760, dh: 1472,
  });
});

test('um quadro só vira uma imagem do tamanho do quadro', () => {
  const plano = planStitch([{ scrollTop: 0, rect }], { dpr: 1, scale: 1 });
  assert.equal(plano.height, 800);
  assert.equal(plano.placements.length, 1);
});

test('lista vazia é erro', () => {
  assert.throws(() => planStitch([], { dpr: 1, scale: 1 }), /sem quadros/);
});
