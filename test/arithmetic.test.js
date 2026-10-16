import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../site/third-grade/addition-subtraction/lessons.js';
import {
  values, digits, modelValue, createModel, combine, validTrade, trade,
  removePlace, modelReady, answerFor, parseWhole, checkGuided, checkIndependent,
} from '../site/third-grade/addition-subtraction/math.js';

function finishModel(lesson) {
  let model = createModel(lesson);
  if (lesson.operation === 'add') model = combine(model, lesson);
  for (let step = 0; !modelReady(model, lesson) && step < 40; step++) {
    const source = values.findIndex((_, place) => validTrade(model, lesson, place));
    const next = source >= 0 ? trade(model, lesson, source) : removePlace(model, lesson);
    assert.notEqual(next, model, `The model must make progress for ${lesson.id}`);
    model = next;
  }
  assert.equal(modelReady(model, lesson), true, `The model must finish for ${lesson.id}`);
  return model;
}

test('place values and digit counts run from ones through thousands', () => {
  assert.deepEqual(values, [1, 10, 100, 1000]);
  assert.deepEqual(digits(5020), [0, 2, 0, 5]);
  assert.deepEqual(digits(0), [0, 0, 0, 0]);
  assert.equal(modelValue([16, 12, 5, 2]), 2636);
  assert.equal(answerFor({ a: 2348, b: 1576, operation: 'add' }), 3924);
  assert.equal(answerFor({ a: 5020, b: 1867, operation: 'subtract' }), 3153);
});

test('addition combines once and trades the lowest overflowing place without changing value', () => {
  const lesson = { a: 46, b: 27, operation: 'add' };
  const initial = createModel(lesson);
  assert.deepEqual(initial, { counts: [6, 4, 0, 0], combined: false, removed: [false, false, false, false], log: [] });
  assert.equal(validTrade(initial, lesson, 0), false);
  assert.equal(trade(initial, lesson, 0), initial);
  assert.equal(removePlace(initial, lesson), initial);
  const combined = combine(initial, lesson);
  assert.deepEqual(combined.counts, [13, 6, 0, 0]);
  assert.deepEqual(initial.counts, [6, 4, 0, 0]);
  assert.equal(combine(combined, lesson), combined);
  assert.equal(validTrade(combined, lesson, 1), false);
  assert.equal(validTrade(combined, lesson, 0), true);
  const regrouped = trade(combined, lesson, 0);
  assert.deepEqual(regrouped.counts, [3, 7, 0, 0]);
  assert.equal(modelValue(regrouped.counts), modelValue(combined.counts));
  assert.equal(modelReady(regrouped, lesson), true);
  assert.equal(regrouped.log.length, 2);
  assert.ok(regrouped.log.every(entry => typeof entry === 'string'));
});

test('an addition carry can continue through hundreds into thousands', () => {
  const lesson = { a: 625, b: 375, operation: 'add' };
  let model = combine(createModel(lesson), lesson);
  for (const place of [0, 1, 2]) {
    assert.equal(modelReady(model, lesson), false);
    assert.equal(validTrade(model, lesson, place), true);
    model = trade(model, lesson, place);
    assert.equal(modelValue(model.counts), 1000);
  }
  assert.deepEqual(model.counts, [0, 0, 0, 1]);
  assert.equal(modelReady(model, lesson), true);
});

test('subtraction regroups only when the active column needs more blocks', () => {
  const lesson = { a: 52, b: 28, operation: 'subtract' };
  const initial = createModel(lesson);
  assert.equal(initial.combined, true);
  assert.equal(combine(initial, lesson), initial);
  assert.equal(removePlace(initial, lesson), initial);
  assert.equal(validTrade(initial, lesson, 1), true);
  const regrouped = trade(initial, lesson, 1);
  assert.deepEqual(regrouped.counts, [12, 4, 0, 0]);
  assert.equal(modelValue(regrouped.counts), 52);
  assert.equal(validTrade(regrouped, lesson, 1), false);
  const removed = removePlace(regrouped, lesson);
  assert.deepEqual(removed.counts, [4, 4, 0, 0]);
  assert.deepEqual(removed.removed, [true, false, false, false]);
  assert.deepEqual(regrouped.removed, [false, false, false, false]);
  assert.equal(modelReady(removed, lesson), false);
  const finished = finishModel(lesson);
  assert.deepEqual(finished.counts, [4, 2, 0, 0]);
  assert.deepEqual(finished.removed, [true, true, true, true]);
});

test('borrowing across zeros passes through each intervening place', () => {
  const lesson = { a: 1000, b: 468, operation: 'subtract' };
  let model = createModel(lesson);
  const expected = [[0, 0, 10, 0], [0, 10, 9, 0], [10, 9, 9, 0]];
  for (const [index, source] of [3, 2, 1].entries()) {
    assert.deepEqual(values.map((_, place) => validTrade(model, lesson, place)), values.map((_, place) => place === source));
    model = trade(model, lesson, source);
    assert.deepEqual(model.counts, expected[index]);
    assert.equal(modelValue(model.counts), 1000);
  }
  assert.equal(modelValue(finishModel(lesson).counts), 532);
});

test('whole-number parsing accepts correctly grouped commas and rejects partial answers', () => {
  for (const [raw, expected] of [['0', 0], [' 825 ', 825], ['3924', 3924], ['3,924', 3924], ['9,999', 9999]]) {
    assert.equal(parseWhole(raw), expected);
  }
  for (const raw of ['', ' ', '3,92', '39,24', '3,,924', '1,0000', '1.5', '825 apples', '-2', '1e3', '0x10', '10,000']) {
    assert.equal(parseWhole(raw), null, raw);
  }
});

test('all 16 lessons are complete and guided models reach the correct answer', () => {
  assert.equal(LESSONS.length, 16);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, 16);
  const guided = LESSONS.filter(lesson => !lesson.independent);
  assert.equal(guided.length, 13);
  assert.deepEqual(guided.map(({ a, b, operation }) => [a, b, operation]), [
    [23, 14, 'add'], [214, 132, 'add'], [46, 27, 'add'], [268, 154, 'add'], [625, 375, 'add'],
    [75, 32, 'subtract'], [684, 253, 'subtract'], [52, 28, 'subtract'], [432, 178, 'subtract'], [700, 246, 'subtract'], [1000, 468, 'subtract'],
    [2348, 1576, 'add'], [5020, 1867, 'subtract'],
  ]);
  for (const lesson of LESSONS) {
    assert.ok(lesson.title && lesson.prompt && lesson.tip);
    assert.ok([0, 1, 2, 3].includes(lesson.stage));
    assert.equal('answer' in lesson, false);
    if (!lesson.independent) {
      const model = finishModel(lesson);
      assert.equal(modelValue(model.counts), answerFor(lesson));
      assert.equal(checkGuided(lesson, model, digits(answerFor(lesson)).map(String)).correct, true);
    }
  }
});

test('guided answers require the finished model and the digit in each place', () => {
  const lesson = { a: 214, b: 132, operation: 'add' };
  assert.equal(checkGuided(lesson, createModel(lesson), ['6', '4', '3', '0']).correct, false);
  const model = finishModel(lesson);
  assert.equal(checkGuided(lesson, model, ['6', '4', '3', '']).correct, false);
  assert.match(checkGuided(lesson, model, ['6', '3', '4', '0']).message, /tens|place/i);
  assert.match(checkGuided(lesson, model, ['16', '3', '3', '0']).message, /one digit|regroup/i);
  const subtraction = { a: 52, b: 28, operation: 'subtract' };
  const wrongOrder = checkGuided(subtraction, finishModel(subtraction), ['6', '3', '0', '0']);
  assert.equal(wrongOrder.correct, false);
  assert.match(wrongOrder.message, /order|smaller|regroup/i);
});

test('independent word problems require the correct operation, answer, and recorded work', () => {
  for (const lesson of LESSONS.filter(item => item.word)) {
    const answers = [String(answerFor(lesson))];
    assert.equal(checkIndependent(lesson, { answers, operation: lesson.operation, hasWork: true }).correct, true);
    assert.equal(checkIndependent(lesson, { answers, operation: '', hasWork: true }).correct, false);
    assert.equal(checkIndependent(lesson, { answers, operation: lesson.operation === 'add' ? 'subtract' : 'add', hasWork: true }).correct, false);
    assert.equal(checkIndependent(lesson, { answers, operation: lesson.operation, hasWork: false }).correct, false);
    assert.equal(checkIndependent(lesson, { answers: [''], operation: lesson.operation, hasWork: true }).correct, false);
    assert.equal(checkIndependent(lesson, { answers: ['111'], operation: lesson.operation, hasWork: true }).correct, false);
  }
});

test('the final check requires both answers and written work', () => {
  const lesson = LESSONS.find(item => item.final);
  assert.equal(lesson.independent, true);
  assert.deepEqual(lesson.problems, [{ a: 368, b: 457, operation: 'add' }, { a: 3002, b: 1685, operation: 'subtract' }]);
  assert.equal(checkIndependent(lesson, { answers: ['825', '1,317'], hasWork: true }).correct, true);
  assert.equal(checkIndependent(lesson, { answers: ['825'], hasWork: true }).correct, false);
  assert.equal(checkIndependent(lesson, { answers: ['825', ''], hasWork: true }).correct, false);
  assert.equal(checkIndependent(lesson, { answers: ['825', '1317'], hasWork: false }).correct, false);
  assert.equal(checkIndependent(lesson, { answers: ['825', '1327'], hasWork: true }).correct, false);
});
