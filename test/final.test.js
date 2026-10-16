import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../site/lessons.js';
import { evaluateFinal } from '../site/math.js';

const lesson = LESSONS.at(-1);
test('final problem requires written work, the correct total, and square units', () => {
  const work = { hasWork: true, total: '72', unit: 'ft²' };
  assert.equal(evaluateFinal(lesson,work).correct,true);
  assert.deepEqual(evaluateFinal(lesson,{...work,hasWork:false}).errors.map(error => error.field),['work']);
  assert.deepEqual(evaluateFinal(lesson,{...work,total:'60'}).errors.map(error => error.field),['total']);
  assert.deepEqual(evaluateFinal(lesson,{...work,unit:'ft'}).errors.map(error => error.field),['unit']);
  assert.equal(evaluateFinal(lesson,{...work,total:''}).correct,false);
});
