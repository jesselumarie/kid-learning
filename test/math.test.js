import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../site/lessons.js';
import { polygonArea, rectangleArea, splitIsValid, splitFromCuts, measure, checkNumber, evaluateWork } from '../site/math.js';

const correctWork = (lesson, split = lesson.splits[0]) => ({
  measurements: split.rects.map(rect => ({ w: String(rect.w), h: String(rect.h) })),
  areas: split.rects.map(rect => String(rect.w * rect.h)),
  total: String(polygonArea(lesson.polygon)),
  unit: `${lesson.unit}²`,
  reason: lesson.reason.choices.findIndex(choice => choice.correct),
});

test('the two practice figures have the intended areas', () => {
  assert.equal(polygonArea([[0, 0], [7, 0], [7, 3], [9, 3], [9, 8], [0, 8]]), 66);
  assert.equal(polygonArea([[10, 0], [15, 0], [15, 10], [0, 10], [0, 5], [10, 5]]), 100);
  assert.equal(rectangleArea({ x: 1, y: 2, w: 7, h: 8 }), 56);
});

test('ruler measures horizontal and vertical lengths in either direction', () => {
  assert.equal(measure([2, 3], [9, 3]), 7);
  assert.equal(measure([9, 3], [2, 3]), 7);
  assert.equal(measure([2, 3], [2, 8]), 5);
  assert.equal(measure([2, 8], [2, 3]), 5);
  assert.equal(measure([0, 0], [2, 3]), null);
});

test('numeric answers cannot pass through an empty field or a partial parse', () => {
  assert.equal(checkNumber(' 66 ', 66), true);
  assert.equal(checkNumber('66.0', 66), true);
  assert.equal(checkNumber('', 0), false);
  assert.equal(checkNumber(' ', 0), false);
  assert.equal(checkNumber('66 cm', 66), false);
  assert.equal(checkNumber('0x42', 66), false);
  assert.equal(checkNumber('65', 66), false);
});

test('coverage rejects overlapping rectangles even when areas add to the right number', () => {
  const polygon = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.equal(splitIsValid(polygon, [{ x: 0, y: 0, w: 2, h: 4 }, { x: 2, y: 0, w: 2, h: 4 }]), true);
  assert.equal(splitIsValid(polygon, [{ x: 0, y: 0, w: 2, h: 4 }, { x: 1, y: 0, w: 2, h: 4 }]), false);
  assert.equal(splitIsValid(polygon, [{ x: 0, y: 0, w: 2, h: 4 }]), false);
  assert.equal(splitIsValid(polygon, [{ x: 0, y: 0, w: 5, h: 4 }]), false);
});

test('curriculum progresses through 12 complete and mathematically valid lessons', () => {
  assert.equal(LESSONS.length, 12);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, 12);
  assert.deepEqual(LESSONS.map(lesson => lesson.chapter), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  for (const [index, lesson] of LESSONS.entries()) {
    assert.ok(lesson.title && lesson.story && lesson.tip);
    assert.equal(lesson.reason.choices.filter(choice => choice.correct).length, 1);
    assert.ok(lesson.reason.choices.every(choice => choice.feedback));
    assert.equal(lesson.independent, index >= 9);
    assert.equal(lesson.grid, index < 9);
    for (const split of lesson.splits) {
      assert.equal(splitIsValid(lesson.polygon, split.rects), true, `${lesson.id}/${split.id} must cover exactly once`);
      assert.equal(evaluateWork(lesson, split, correctWork(lesson, split)).correct, true);
    }
    if (index < 3) assert.deepEqual(lesson.splits[0].lines, []);
    else assert.ok(lesson.splits.length >= 2);
  }
});

test('all work fields must be right, including units and explanation', () => {
  const lesson = LESSONS[0];
  const split = lesson.splits[0];
  const result = evaluateWork(lesson, split, { measurements: [], areas: [], total: '', unit: '', reason: -1 });
  assert.equal(result.correct, false);
  assert.deepEqual(result.errors.map(error => error.field), ['w-0', 'h-0', 'area-0', 'total', 'unit', 'reason']);
  const work = correctWork(lesson);
  work.unit = lesson.unit;
  assert.deepEqual(evaluateWork(lesson, split, work).errors.map(error => error.field), ['unit']);
  work.unit = `${lesson.unit}²`;
  work.reason = lesson.reason.choices.findIndex(choice => !choice.correct);
  assert.deepEqual(evaluateWork(lesson, split, work).errors.map(error => error.field), ['reason']);
});

test('feedback distinguishes perimeter from area without revealing the answer', () => {
  const lesson = LESSONS[0];
  const work = correctWork(lesson);
  const rect = lesson.splits[0].rects[0];
  work.areas[0] = String(2 * (rect.w + rect.h));
  const message = evaluateWork(lesson, lesson.splits[0], work).errors.find(error => error.field === 'area-0').message;
  assert.match(message, /around|perimeter/i);
  assert.doesNotMatch(message, new RegExp(`\\b${rect.w * rect.h}\\b`));
});

test('garden feedback distinguishes an incorrect sum from overlapping part measurements', () => {
  const lesson = LESSONS.find(item => item.id === 'garden-designer');
  for (const split of lesson.splits) assert.equal(evaluateWork(lesson, split, correctWork(lesson, split)).correct, true);
  const work = correctWork(lesson);
  work.total = '125';
  const result = evaluateWork(lesson, lesson.splits[0], work);
  assert.equal(result.correct, false);
  const sumMessage = result.errors.find(error => error.field === 'total').message;
  assert.match(sumMessage, /add/i);
  assert.doesNotMatch(sumMessage, /twice|overlap/i);

  work.measurements[0].w = '15';
  work.areas[0] = '75';
  const overlapping = evaluateWork(lesson, lesson.splits[0], work);
  assert.match(overlapping.errors.find(error => error.field === 'total').message, /twice|overlap/i);
});

test('drawing each curriculum split produces rectangles with exact coverage', () => {
  for (const lesson of LESSONS) {
    for (const split of lesson.splits) {
      const result = splitFromCuts(lesson.polygon, split.lines);
      assert.equal(result.valid, true, `${lesson.id}/${split.id} must accept its cuts`);
      assert.equal(result.complete, true, `${lesson.id}/${split.id} must finish as rectangles`);
      assert.equal(result.rects.length, split.rects.length);
      assert.equal(splitIsValid(lesson.polygon, result.rects), true);
      assert.deepEqual(
        result.rects.map(rect => JSON.stringify(rect)).sort(),
        split.rects.map(rect => JSON.stringify(rect)).sort(),
      );
    }
  }
});

test('terraces accept a new mixed-direction split ending at a previous cut', () => {
  const lesson = LESSONS.find(item => item.id === 'terraced-patch');
  const firstCut = [[6, 4], [0, 4]];
  const partial = splitFromCuts(lesson.polygon, [firstCut]);
  assert.equal(partial.valid, true);
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.rects, [{ x: 0, y: 4, w: 9, h: 3 }]);

  const result = splitFromCuts(lesson.polygon, [firstCut, [[3, 2], [3, 4]]]);
  assert.deepEqual(result, {
    valid: true,
    complete: true,
    rects: [{ x: 0, y: 0, w: 3, h: 4 }, { x: 3, y: 2, w: 3, h: 2 }, { x: 0, y: 4, w: 9, h: 3 }],
  });
  assert.equal(splitIsValid(lesson.polygon, result.rects), true);
});

test('cuts reject diagonals, outside edges, exterior segments, and dangling ends', () => {
  const polygon = [[0, 0], [4, 0], [4, 4], [0, 4]];
  for (const cuts of [
    [[[0, 0], [4, 4]]],
    [[[0, 0], [0, 4]]],
    [[[0, 2], [5, 2]]],
    [[[0, 2], [2, 2]]],
    [[[0, 2], [4, 2]], [[2, 0], [2, 3]]],
    [[[0, 2], [4, 2]], [[4, 2], [0, 2]]],
  ]) assert.deepEqual(splitFromCuts(polygon, cuts), { valid: false, complete: false, rects: [] });

  const courtyard = LESSONS.find(item => item.id === 'courtyard');
  assert.equal(splitFromCuts(courtyard.polygon, [[[0, 1], [10, 1]]]).valid, false);
});

test('crossing a previous cut can create several rectangles without a preset limit', () => {
  const polygon = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const result = splitFromCuts(polygon, [[[2, 0], [2, 4]], [[0, 2], [4, 2]]]);
  assert.equal(result.valid, true);
  assert.equal(result.complete, true);
  assert.equal(result.rects.length, 4);
  assert.equal(splitIsValid(polygon, result.rects), true);
});
