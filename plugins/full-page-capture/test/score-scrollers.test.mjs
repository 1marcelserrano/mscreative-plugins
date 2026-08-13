import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidates } from '../src/lib/score-scrollers.mjs';

function descriptor(over = {}) {
  return {
    id: 1,
    scrollHeight: 4000,
    clientHeight: 800,
    overflowY: 'auto',
    visibleArea: 800 * 1000,
    depth: 5,
    isDocument: false,
    label: 'div',
    ...over,
  };
}

const documentoParado = descriptor({
  id: 0,
  isDocument: true,
  overflowY: 'visible',
  scrollHeight: 900,
  clientHeight: 900,
  visibleArea: 1200 * 900,
  depth: 0,
  label: 'documento',
});

test('painel interno vence quando o documento não rola', () => {
  const painel = descriptor({ id: 1, scrollHeight: 5000, clientHeight: 800, visibleArea: 900 * 800 });
  const [primeiro] = scoreCandidates([documentoParado, painel]);
  assert.equal(primeiro.id, 1);
});

test('documento vence numa página comum', () => {
  const documento = descriptor({
    id: 0,
    isDocument: true,
    overflowY: 'visible',
    scrollHeight: 6000,
    clientHeight: 900,
    visibleArea: 1200 * 900,
    depth: 0,
  });
  const lateral = descriptor({ id: 2, scrollHeight: 2000, clientHeight: 600, visibleArea: 240 * 600 });
  const [primeiro] = scoreCandidates([documento, lateral]);
  assert.equal(primeiro.id, 0);
});

test('elemento sem área visível não pontua', () => {
  const oculto = descriptor({ id: 3, visibleArea: 0 });
  const resultado = scoreCandidates([documentoParado, oculto]);
  assert.ok(!resultado.some((c) => c.id === 3 && c.score > 0));
});

test('overflow hidden não pontua', () => {
  const travado = descriptor({ id: 4, overflowY: 'hidden' });
  const resultado = scoreCandidates([documentoParado, travado]);
  assert.ok(!resultado.some((c) => c.id === 4 && c.score > 0));
});

test('sobra de rolagem menor que 200px não pontua', () => {
  const raso = descriptor({ id: 5, scrollHeight: 950, clientHeight: 800 });
  const resultado = scoreCandidates([documentoParado, raso]);
  assert.ok(!resultado.some((c) => c.id === 5 && c.score > 0));
});

test('o documento sobra como reserva mesmo sem pontuar', () => {
  const resultado = scoreCandidates([documentoParado]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].isDocument, true);
});

test('empate de área é desempatado pelo elemento mais raso', () => {
  const fundo = descriptor({ id: 6, depth: 12 });
  const raso = descriptor({ id: 7, depth: 3 });
  const [primeiro] = scoreCandidates([fundo, raso, documentoParado]);
  assert.equal(primeiro.id, 7);
});

test('lista sem nenhum candidato devolve lista vazia', () => {
  assert.deepEqual(scoreCandidates([]), []);
});
