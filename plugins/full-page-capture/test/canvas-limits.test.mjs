import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseScale, MAX_AREA } from '../src/lib/canvas-limits.mjs';

test('página comum cabe em resolução nativa', () => {
  const r = chooseScale({ width: 1200, height: 8000, dpr: 2 });
  assert.equal(r.scale, 1);
  assert.equal(r.truncar, false);
  assert.equal(r.aviso, null);
});

test('página grande demais em retina cai para resolução simples', () => {
  const r = chooseScale({ width: 1600, height: 60000, dpr: 2 });
  assert.equal(r.scale, 0.5);
  assert.equal(r.truncar, false);
  assert.match(r.aviso, /resolução simples/);
});

test('página que nem reduzida cabe é truncada com aviso', () => {
  const r = chooseScale({ width: 3000, height: 300000, dpr: 2 });
  assert.equal(r.truncar, true);
  assert.match(r.aviso, /cortei/i);
});

test('altura acima da dimensão máxima força redução', () => {
  const r = chooseScale({ width: 800, height: 40000, dpr: 2 });
  assert.equal(r.scale, 0.5);
});

test('a área nativa no limite ainda passa', () => {
  const lado = Math.floor(Math.sqrt(MAX_AREA));
  const r = chooseScale({ width: lado, height: lado, dpr: 1 });
  assert.equal(r.scale, 1);
});
