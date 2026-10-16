import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { progressSummary } from '../site/contents.js';

const chapters = [
  { id: 'area', storageKey: 'kid-learning-area-v1', lessons: [{ id: 'rectangle' }, { id: 'split' }] },
  { id: 'addition-subtraction', storageKey: 'kid-learning-arithmetic-v1', lessons: [{ id: 'add' }, { id: 'subtract' }, { id: 'final-check' }] },
];

test('contents progress counts saved completions only for lessons in that chapter', () => {
  const saved = {
    'kid-learning-area-v1': JSON.stringify({ completed: { rectangle: { completedAt: '2026-10-16' }, removed: {} } }),
    'kid-learning-arithmetic-v1': JSON.stringify({ completed: { add: {}, 'final-check': {}, rectangle: {} } }),
  };
  const storage = { getItem(key) { return saved[key] ?? null; } };
  assert.deepEqual(progressSummary(storage, chapters), [
    { id: 'area', completed: 1, total: 2 },
    { id: 'addition-subtraction', completed: 2, total: 3 },
  ]);
});

test('contents does not invent completion counts when saved records are unavailable', () => {
  for (const storage of [
    { getItem() { return null; } },
    { getItem() { throw new Error('Storage blocked'); } },
    { getItem() { return '{not json'; } },
    { getItem() { return JSON.stringify({ current: 0 }); } },
  ]) {
    assert.deepEqual(progressSummary(storage, chapters), [
      { id: 'area', completed: null, total: 2 },
      { id: 'addition-subtraction', completed: null, total: 3 },
    ]);
  }
  assert.deepEqual(progressSummary({ getItem() { return '{"completed":{}}'; } }, chapters).map(item => item.completed), [0, 0]);
});

test('one invalid chapter record does not hide valid progress for another chapter', () => {
  const storage = { getItem(key) { return key === 'kid-learning-area-v1' ? '{broken' : '{"completed":{"subtract":{}}}'; } };
  assert.deepEqual(progressSummary(storage, chapters), [
    { id: 'area', completed: null, total: 2 },
    { id: 'addition-subtraction', completed: 1, total: 3 },
  ]);
});

test('the root page provides direct chapter navigation under the GitHub Pages project path', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*data-chapter="([^"]+)"[^>]*>/g)];
  assert.deepEqual(links.map(([, href, id]) => [id, new URL(href, 'https://jesselumarie.github.io/kid-learning/').pathname]), [
    ['area', '/kid-learning/third-grade/area/'],
    ['addition-subtraction', '/kid-learning/third-grade/addition-subtraction/'],
  ]);
  assert.doesNotMatch(html, /http-equiv="refresh"|location\.(replace|href)/);
  assert.match(html, /<h1>Math<\/h1>/);
});
