import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { LESSONS } from '../site/third-grade/addition-subtraction/lessons.js';
import { answerFor, combine, createModel, digits, modelReady, removePlace, trade, validTrade } from '../site/third-grade/addition-subtraction/math.js';

const storageKey = 'kid-learning-arithmetic-v1';
const areaKey = 'kid-learning-area-v1';
const rootUrl = (process.env.TEST_URL || 'http://127.0.0.1:4197').replace(/\/$/, '');
const url = `${rootUrl}/third-grade/addition-subtraction/`;
const server = process.env.TEST_URL ? null : spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4197' }, stdio: 'pipe' });
if (server) await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  let errors = '';
  server.stderr.on('data', data => { errors += data; });
  server.once('exit', code => reject(new Error(`Arithmetic server exited ${code}: ${errors}`)));
});
await mkdir('test-results', { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const failures = [];
const sessions = new WeakMap();
let activePage;
function watch(page) {
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  return page;
}
async function touchSession(page) {
  if (!sessions.has(page)) sessions.set(page, await page.context().newCDPSession(page));
  return sessions.get(page);
}
async function tap(page, locator, touch = false) {
  if (!touch) { await locator.click(); return; }
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, 'Touch control is visible');
  const session = await touchSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
async function drag(page, a, b, touch = false) {
  if (!touch) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    return;
  }
  const session = await touchSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * step / 12, y: a.y + (b.y - a.y) * step / 12 }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
async function readProgress(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}
async function closeSheet(page, touch = false) {
  if (await page.locator('#grade-sheet').isVisible()) await tap(page, page.locator('#close-grade-sheet'), touch);
}
async function selectLesson(page, index, touch = false) {
  await closeSheet(page, touch);
  await tap(page, page.locator(`[data-lesson="${index}"]`), touch);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'lesson-title', 'Lesson navigation moves focus to the new heading');
}
async function fillDigits(page, lesson) {
  const expected = digits(answerFor(lesson));
  for (let place = 0; place < 4; place++) {
    const input = page.locator(`#digit-${place}`);
    if (await input.count()) await input.fill(String(expected[place]));
  }
}
async function solveModel(page, lesson, { touch = false, keyboardTrade = false, dragTrade = false } = {}) {
  let model = createModel(lesson);
  if (lesson.operation === 'add') {
    await tap(page, page.locator('#combine'), touch);
    model = combine(model, lesson);
  }
  for (let step = 0; !modelReady(model, lesson); step++) {
    assert.ok(step < 20, `${lesson.id} model finishes in a small number of steps`);
    const current = model.removed.findIndex(removed => !removed);
    const canRemove = lesson.operation === 'subtract' && current >= 0 && model.counts[current] >= digits(lesson.b)[current];
    if (canRemove) {
      await tap(page, page.locator('#subtract-place'), touch);
      model = removePlace(model, lesson);
    } else {
      const place = [0, 1, 2, 3].find(source => validTrade(model, lesson, source));
      assert.notEqual(place, undefined, `A valid trade exists for ${lesson.id}`);
      const control = page.locator(`[data-trade="${place}"]`);
      assert.equal(await control.isEnabled(), true, `Trade ${place} is enabled for ${lesson.id}`);
      if (dragTrade && !touch) {
        await control.scrollIntoViewIfNeeded();
        const source = await control.boundingBox();
        const destination = await page.locator(`[data-place="${place + (lesson.operation === 'add' ? 1 : -1)}"]`).boundingBox();
        await drag(page, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 });
        dragTrade = false;
      } else if (keyboardTrade && !touch) {
        await control.focus();
        await page.keyboard.press('Enter');
        assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY', 'Keyboard exchange keeps focus on an available control');
        keyboardTrade = false;
      } else await tap(page, control, touch);
      model = trade(model, lesson, place);
    }
  }
  assert.ok((await page.locator('#model-caption').textContent()).trim(), 'Model explains its current state');
}
async function submitGuided(page, lesson, touch = false) {
  await fillDigits(page, lesson);
  await tap(page, page.locator('#guided-form button'), touch);
  assert.equal(await page.locator('#next-lesson').count(), 1, `Completed ${lesson.id}`);
}
async function canvasHasInk(page) {
  return page.locator('#scratch-canvas').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0));
}
async function drawWork(page, touch = false) {
  await page.locator('#scratch-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#scratch-canvas').boundingBox();
  await drag(page, { x: box.x + 30, y: box.y + 40 }, { x: box.x + Math.min(170, box.width - 30), y: box.y + 105 }, touch);
  assert.equal(await canvasHasInk(page), true, 'Writing leaves visible ink');
}
function problems(lesson) { return lesson.problems || [lesson]; }
async function fillIndependent(page, lesson, text = true) {
  if (text) await page.locator('#scratch-text').fill(problems(lesson).map(problem => `${problem.a} ${problem.operation === 'add' ? '+' : '−'} ${problem.b} = ${answerFor(problem)}`).join('\n'));
  for (const [index, problem] of problems(lesson).entries()) await page.locator(`#answer-${index}`).fill(String(answerFor(problem)));
  if (lesson.word) await page.locator(`input[name="operation"][value="${lesson.operation}"]`).check();
}
async function submitIndependent(page, lesson, touch = false) {
  await tap(page, page.locator('#independent-form button[type="submit"]'), touch);
  assert.equal(await page.locator('#next-lesson').count(), 1, `Completed independent ${lesson.id}`);
}

try {
  if (!process.env.MOBILE_ONLY) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const page = watch(await context.newPage());
    activePage = page;
    await page.goto(rootUrl);
    await page.locator('a[href*="third-grade/addition-subtraction"]').click();
    await page.waitForURL('**/third-grade/addition-subtraction/');
    assert.equal(await page.locator('[data-lesson]').count(), 16);
    assert.equal(await page.locator('#contents').getAttribute('href'), '../../');
    await page.locator('#contents').click();
    assert.equal(await page.locator('a[href*="third-grade/area"]').count(), 1, 'Contents links to existing area practice');
    await page.locator('a[href*="third-grade/addition-subtraction"]').click();
    const areaRecord = JSON.stringify({ current: 0, completed: { 'first-patch': { completedAt: '2026-10-16T12:00:00Z' } } });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: areaKey, value: areaRecord });
    await page.screenshot({ path: 'test-results/arithmetic-first-lesson.png', fullPage: true });

    for (const [index, lesson] of LESSONS.slice(0, 13).entries()) {
      await selectLesson(page, index);
      if (index === 0) {
        await fillDigits(page, lesson);
        await page.locator('#guided-form button').click();
        assert.ok((await page.locator('#feedback').textContent()).trim(), 'An answer cannot skip the place-value model');
        assert.equal(await page.locator('#next-lesson').count(), 0);
        await selectLesson(page, 1);
        await selectLesson(page, 0);
        assert.equal(await page.locator('#digit-0').inputValue(), String(digits(answerFor(lesson))[0]), 'Unfinished answer survives switching lessons');
      }
      await solveModel(page, lesson, { keyboardTrade: true, dragTrade: index === 2 });
      if (index === 0) {
        await fillDigits(page, lesson);
        await page.locator('#digit-0').fill(String((digits(answerFor(lesson))[0] + 1) % 10));
        await page.locator('#guided-form button').click();
        assert.ok((await page.locator('#feedback').textContent()).trim(), 'Incorrect result receives feedback');
        assert.equal(await page.locator('#next-lesson').count(), 0);
        await page.locator('#hint-button').click();
        await page.locator('#hint-button').click();
      }
      await submitGuided(page, lesson);
      const result = (await readProgress(page)).completed[lesson.id].result;
      assert.deepEqual(result.answers, [String(answerFor(lesson))]);
      if (index === 0) {
        assert.ok(result.corrections >= 2, 'Corrections include model gating and a wrong answer');
        assert.equal(result.hints, 2);
        assert.equal(result.supported, true);
        await page.reload();
        assert.ok((await readProgress(page)).completed[lesson.id], 'Completion survives reload');
      }
      console.log(`PASS: arithmetic guided lesson ${index + 1}, ${lesson.title}`);
    }

    for (let index = 13; index < 16; index++) {
      const lesson = LESSONS[index];
      await selectLesson(page, index);
      assert.equal(await page.locator('#guided-form').count(), 0, 'Independent work has no supplied answer digits');
      assert.equal(await page.locator('#scratch-text').inputValue(), '');
      await fillIndependent(page, lesson, false);
      await page.locator('#independent-form button[type="submit"]').click();
      assert.ok((await page.locator('#feedback').textContent()).trim(), 'Independent answers require written work');
      assert.equal(await page.locator('#next-lesson').count(), 0);
      await fillIndependent(page, lesson);
      if (index === 13) {
        await page.locator('#answer-0').fill(`${answerFor(lesson)}oops`);
        await page.locator('#independent-form button[type="submit"]').click();
        assert.ok((await page.locator('#feedback').textContent()).trim(), 'A partly numeric answer is rejected');
        assert.equal(await page.locator('#next-lesson').count(), 0);
        await fillIndependent(page, lesson);
        await page.locator(`input[name="operation"][value="${lesson.operation === 'add' ? 'subtract' : 'add'}"]`).check();
        await page.locator('#independent-form button[type="submit"]').click();
        assert.ok((await page.locator('#feedback').textContent()).trim(), 'Word problem must use the correct operation');
        await fillIndependent(page, lesson);
        await page.locator('#model-help').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.id),'model-help','Optional block help keeps keyboard focus on its control');
        assert.equal(await page.locator('#place-blocks').isVisible(), true, 'Optional help shows the place-value model');
      }
      if (lesson.final) {
        await drawWork(page);
        const writingWidth = (await page.locator('#scratch-canvas').boundingBox()).width;
        await page.locator('#model-help').click();
        assert.ok(Math.abs((await page.locator('#scratch-canvas').boundingBox()).width - writingWidth) < 1, 'Optional blocks keep the writing area the same width');
        assert.equal(await canvasHasInk(page), true, 'Showing the optional model preserves written work');
        await page.locator('[data-scratch-action="clear"]').click();
        assert.equal(await canvasHasInk(page), false);
        await drawWork(page);
        await page.locator('#answer-1').fill('');
        await page.locator('#independent-form button[type="submit"]').click();
        assert.equal(await page.locator('#next-lesson').count(), 0, 'Both final answers are required');
        await fillIndependent(page, lesson);
        const writtenDraft = await page.locator('#scratch-text').inputValue();
        await selectLesson(page, 0);
        await selectLesson(page, 15);
        assert.equal(await page.locator('#scratch-text').inputValue(), writtenDraft, 'Independent calculations survive lesson navigation');
        assert.equal(await canvasHasInk(page), true, 'Independent drawing survives lesson navigation');
        await page.reload();
        assert.equal(await canvasHasInk(page), true, 'Final drawing survives reload');
        for (const [problemIndex, problem] of problems(lesson).entries()) assert.equal(await page.locator(`#answer-${problemIndex}`).inputValue(), String(answerFor(problem)));
        await page.screenshot({ path: 'test-results/arithmetic-final-work.png', fullPage: true });
      }
      await submitIndependent(page, lesson);
      await closeSheet(page);
      const result = (await readProgress(page)).completed[lesson.id].result;
      assert.deepEqual(result.answers, problems(lesson).map(problem => String(answerFor(problem))));
      assert.match(result.work.text, /=/);
      if (index === 13 || lesson.final) assert.equal(result.supported, true, 'Optional model help is recorded');
      console.log(`PASS: arithmetic independent lesson ${index + 1}, ${lesson.title}`);
    }

    await page.locator('#view-grade-sheet').click();
    assert.equal(await page.locator('[data-grade-lesson]').count(), 16);
    assert.match(await page.locator('[data-grade-work="final-check"] .grade-written-work').textContent(), new RegExp(String(answerFor(LESSONS[15].problems[1]))));
    assert.equal(await page.locator('.grade-drawing').count(), 1);
    await page.evaluate(() => { window.printRequested = false; window.print = () => { window.printRequested = true; }; });
    await page.locator('#print-grade-sheet').click();
    assert.equal(await page.evaluate(() => window.printRequested), true);
    await page.screenshot({ path: 'test-results/arithmetic-grade-sheet.png', fullPage: true });
    await page.pdf({ path: 'test-results/arithmetic-grade-sheet.pdf', format: 'Letter', printBackground: true });
    const snapshot = (await readProgress(page)).completed[LESSONS[15].id];
    await closeSheet(page);
    await page.locator('#replay').click();
    await page.locator('#scratch-text').fill('A new unfinished attempt');
    await page.locator('#view-grade-sheet').click();
    assert.doesNotMatch(await page.locator('[data-grade-work="final-check"] .grade-written-work').textContent(), /new unfinished attempt/);
    assert.deepEqual((await readProgress(page)).completed[LESSONS[15].id], snapshot, 'Retry cannot replace the submitted record');
    await closeSheet(page);
    assert.equal(await page.locator('#scratch-text').inputValue(), 'A new unfinished attempt');
    await page.reload();
    assert.equal(await page.locator('#scratch-text').inputValue(), 'A new unfinished attempt', 'New draft survives reload separately from the submitted work');
    await page.locator('#grownups').click();
    await page.locator('#reset-progress').click();
    await page.locator('#reset-progress').click();
    await page.locator('.dialog-close').click();
    assert.deepEqual((await readProgress(page)).completed, {});
    assert.equal(await page.evaluate(key => localStorage.getItem(key), areaKey), areaRecord, 'Arithmetic reset preserves area progress');
    console.log('PASS: arithmetic contents links, reports, PDF, stored snapshots, draft persistence, and chapter isolation');
    await context.close();
  }

  if (!process.env.DESKTOP_ONLY) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = watch(await context.newPage());
    activePage = page;
    await page.goto(url);
    const addition = LESSONS.slice(0, 13).find(lesson => lesson.operation === 'add' && answerFor(lesson) >= 1000) || LESSONS[2];
    await selectLesson(page, LESSONS.indexOf(addition), true);
    await solveModel(page, addition, { touch: true });
    await submitGuided(page, addition, true);
    const subtraction = LESSONS.slice(0, 13).find(lesson => lesson.operation === 'subtract' && lesson.a === 1000) || LESSONS[12];
    await selectLesson(page, LESSONS.indexOf(subtraction), true);
    await solveModel(page, subtraction, { touch: true });
    await submitGuided(page, subtraction, true);
    await selectLesson(page, 15, true);
    await drawWork(page, true);
    await tap(page, page.locator('[data-scratch-action="clear"]'), true);
    assert.equal(await canvasHasInk(page), false);
    await drawWork(page, true);
    await page.reload();
    assert.equal(await canvasHasInk(page), true);
    await fillIndependent(page, LESSONS[15], false);
    await submitIndependent(page, LESSONS[15], true);
    await closeSheet(page, true);
    await tap(page, page.locator('#view-grade-sheet'), true);
    assert.equal(await page.locator('.grade-drawing').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Arithmetic report fits a phone');
    await page.screenshot({ path: 'test-results/arithmetic-mobile-grade-sheet.png', fullPage: true });
    await closeSheet(page, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Arithmetic lesson fits a phone');
    console.log('PASS: native phone taps, addition trades, borrowing through zeros, scratch drawing, reload, and final work');
    await context.close();
  }

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }); });
  const blocked = watch(await blockedContext.newPage());
  activePage = blocked;
  await blocked.goto(url);
  await blocked.locator('#grownups').click();
  assert.match(await blocked.locator('#parent-dialog').textContent(), /storage.*unavailable|this session|page is open/i);
  await blocked.locator('.dialog-close').click();
  await selectLesson(blocked, 13);
  await fillIndependent(blocked, LESSONS[13]);
  await submitIndependent(blocked, LESSONS[13]);
  await blocked.locator('#view-grade-sheet').click();
  assert.match(await blocked.locator('#grade-sheet').textContent(), /this session|page is open|cannot.*sav|could not.*sav/i);
  assert.equal(await blocked.locator('#print-grade-sheet').isEnabled(), true);
  console.log('PASS: arithmetic works and prints when browser storage is unavailable');
  await blockedContext.close();
  assert.deepEqual(failures, [], 'No arithmetic runtime or asset errors');
  console.log('All arithmetic browser checks passed.');
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: 'test-results/arithmetic-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  server?.kill();
}
