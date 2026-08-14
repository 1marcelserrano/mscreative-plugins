import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFilename } from '../src/lib/filename.mjs';

const date = new Date(2026, 7, 13); // 13 de agosto de 2026, hora local

test('monta data, domínio e título em slug', () => {
  const name = buildFilename({
    url: 'https://www.notion.so/workspace/pagina',
    title: 'Plano Editorial — Agosto',
    date,
  });
  assert.equal(name, '2026-08-13_notion-so_plano-editorial-agosto.png');
});

test('remove acentos e cedilha do título', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: 'Ação & Coração', date });
  assert.equal(name, '2026-08-13_exemplo-com_acao-coracao.png');
});

test('título vazio vira sem-titulo', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: '   ', date });
  assert.equal(name, '2026-08-13_exemplo-com_sem-titulo.png');
});

test('corta o título em 60 caracteres sem deixar hífen sobrando', () => {
  const title = 'a'.repeat(30) + ' ' + 'b'.repeat(40);
  const name = buildFilename({ url: 'https://exemplo.com', title, date });
  const slug = name.split('_')[2].replace('.png', '');
  assert.ok(slug.length <= 60, `slug tem ${slug.length} caracteres`);
  assert.ok(!slug.endsWith('-'), 'slug não pode terminar em hífen');
});

test('descarta caracteres proibidos em nome de arquivo', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: 'a/b\\c:d*e?f"g<h>i|j', date });
  assert.equal(name, '2026-08-13_exemplo-com_a-b-c-d-e-f-g-h-i-j.png');
});

test('url inválida cai em pagina', () => {
  const name = buildFilename({ url: 'nao-e-uma-url', title: 'Teste', date });
  assert.equal(name, '2026-08-13_pagina_teste.png');
});
