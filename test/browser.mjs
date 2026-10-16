import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { LESSONS } from '../site/lessons.js';
import { polygonArea, splitFromCuts } from '../site/math.js';

const port = 4199;
const external = process.env.TEST_URL;
const url = external || `http://127.0.0.1:${port}`;
const server = external ? null : spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
if (server) await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => { if (code) reject(new Error(`Server exited ${code}`)); }); });
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });

async function screenPoint(page, lesson, point) {
  return page.locator('#board').evaluate((svg, { polygon, point }) => {
    const points = svg.querySelector('#shape-clip polygon').points;
    const i = polygon.findIndex(p => p[0] !== polygon[0][0]);
    const scale = (points.getItem(i).x-points.getItem(0).x)/(polygon[i][0]-polygon[0][0]);
    const origin = [points.getItem(0).x-polygon[0][0]*scale,points.getItem(0).y-polygon[0][1]*scale];
    const result = new DOMPoint(origin[0]+point[0]*scale,origin[1]+point[1]*scale).matrixTransform(svg.getScreenCTM());
    return { x: result.x, y: result.y };
  }, { polygon: lesson.polygon, point });
}
async function dragBetween(page, a, b) {
  await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{ steps: 10 }); await page.mouse.up();
}
async function touchDrag(page, a, b) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{ type: 'touchStart', touchPoints: [{ x:a.x,y:a.y }] });
  for (let i=1;i<=10;i++) await session.send('Input.dispatchTouchEvent',{ type: 'touchMove', touchPoints: [{ x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10 }] });
  await session.send('Input.dispatchTouchEvent',{ type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
async function drawCuts(page, lesson, lines) {
  await page.locator('#board').scrollIntoViewIfNeeded();
  for (const [a,b] of lines) await dragBetween(page, await screenPoint(page,lesson,a), await screenPoint(page,lesson,b));
  assert.equal(await page.locator('#begin-measuring').isEnabled(), true, `Cuts complete for ${lesson.id}`);
}
async function measureSide(page, lesson, rect, axis, { manual = true, touch = false } = {}) {
  const value = rect[axis];
  const a = axis === 'w' ? [rect.x,rect.y+rect.h] : [rect.x,rect.y];
  const b = axis === 'w' ? [rect.x+rect.w,rect.y+rect.h] : [rect.x,rect.y+rect.h];
  if (manual) {
    if (axis === 'h') await page.locator('#rotate-ruler').click();
    await page.locator('#board').scrollIntoViewIfNeeded();
    const box = await page.locator('[data-drag="zero"] circle:last-child').boundingBox();
    const move = touch ? touchDrag : dragBetween;
    await move(page,{ x: box.x+box.width/2, y: box.y+box.height/2 },await screenPoint(page,lesson,a));
    const marker = await page.locator('[data-drag="marker"] path').first().evaluate(path => { const p = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()); return { x: p.x, y: p.y }; });
    const end = await screenPoint(page,lesson,b);
    await move(page,marker,end);
  } else {
    if (touch) await page.locator('#align-ruler').tap(); else await page.locator('#align-ruler').click();
    while (Number((await page.locator('#ruler-value').textContent()).split(' ')[0]) !== value) {
      const current = Number((await page.locator('#ruler-value').textContent()).split(' ')[0]);
      const control = page.locator(current < value ? '#longer' : '#shorter');
      if (touch) await control.tap(); else await control.click();
    }
  }
  await page.locator('#length-answer').fill(String(value));
  await page.locator('#measurement-form button').click();
  const feedback = await page.locator('#feedback').textContent();
  if (feedback) {
    await page.screenshot({ path: 'test-results/measurement-failure.png', fullPage: true });
    console.log('Measurement state:', await page.locator('#board-desc').textContent(), await page.locator('[data-drag="zero"]').getAttribute('aria-label'), await page.locator('[data-drag="marker"]').getAttribute('aria-valuenow'));
  }
  assert.equal(feedback, '', `Measurement ${axis} ${value} recorded`);
}
async function finishCalculations(page, lesson, plan) {
  for (const [i,rect] of plan.rects.entries()) await page.locator(`#area-${i}`).fill(String(rect.w*rect.h));
  await page.locator('#area-form button').click();
  await page.locator('#total-answer').fill(String(polygonArea(lesson.polygon)));
  await page.locator('#unit-answer').selectOption(`${lesson.unit}²`);
  await page.locator('#total-form button').click();
  await page.locator(`input[name="reason"][value="${lesson.reason.choices.findIndex(choice => choice.correct)}"]`).check();
  await page.locator('#reason-form button').click();
  assert.equal(await page.locator('#next-lesson').count(), 1, `Completed ${lesson.id}`);
}

try {
  if (!process.env.MOBILE_ONLY) {
  await page.goto(url);
  assert.match(await page.title(), /Area Workshop/);
  await page.locator('[data-cell="0-0"]').click();
  assert.match(await page.locator('#board-caption').textContent(), /1 square marked/);
  await page.locator('[data-cell="0-0"]').click();
  await page.screenshot({ path: 'test-results/desktop-explore.png', fullPage: true });
  await page.locator('#begin-measuring').click();
  assert.match(await page.locator('#board-desc').textContent(), /from \(0, 3\) to \(4, 3\)/);
  assert.match(await page.locator('[data-drag="zero"]').getAttribute('aria-label'), /Zero at 0 across/);
  await page.locator('#length-answer').fill('4');
  await page.locator('#measurement-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /First line up/);
  await page.locator('#align-ruler').click();
  await page.locator('#longer').click({ clickCount: 2 });
  await page.locator('#length-answer').fill('5');
  await page.locator('#measurement-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /Write that number/);
  await page.locator('#length-answer').fill('4');
  await page.locator('#measurement-form button').click();
  await page.locator('#rotate-ruler').click();
  await page.locator('[data-drag="zero"]').focus();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await page.locator('[data-drag="marker"]').focus(); await page.keyboard.press('ArrowRight');
  await page.locator('#length-answer').fill('3');
  await page.locator('#measurement-form button').click();
  await page.locator('#area-0').fill('7'); await page.locator('#area-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /Adding the two side lengths/);
  await page.locator('#area-0').fill('14'); await page.locator('#area-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /perimeter/);
  await page.locator('#area-0').fill('12'); await page.locator('#area-form button').click();
  await page.locator('#total-answer').fill('12'); await page.locator('#unit-answer').selectOption('cm');
  await page.locator('#total-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /square centimeters/);
  await page.locator('#unit-answer').selectOption('cm²'); await page.locator('#total-form button').click();
  await page.locator('input[name="reason"][value="0"]').check(); await page.locator('#reason-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /perimeter/);
  await page.locator('input[name="reason"][value="1"]').check(); await page.locator('#reason-form button').click();
  assert.match(await page.locator('#progress-text').textContent(), /1 of 12/);
  await page.reload();
  assert.match(await page.locator('#progress-text').textContent(), /1 of 12/);
  console.log('PASS: square counting, ruler gating, keyboard measurement, misconception feedback, and saved completion');

  for (let i = 1; i < LESSONS.length; i++) {
    const lesson = LESSONS[i];
    await page.locator(`[data-lesson="${i}"]`).click();
    let plan = lesson.splits[i % lesson.splits.length];
    if (lesson.polygon.length > 4) {
      if (i === 7) {
        const lines = [[[6,4],[0,4]],[[3,2],[3,4]]];
        await drawCuts(page,lesson,lines);
        plan = { rects: splitFromCuts(lesson.polygon,lines).rects };
      } else if (lesson.independent) {
        await drawCuts(page,lesson,plan.lines);
        plan = { ...plan, rects: splitFromCuts(lesson.polygon,plan.lines).rects };
      } else await page.locator(`[data-split="${i % lesson.splits.length}"]`).click();
    }
    await page.locator('#begin-measuring').click();
    if (i === 3) await page.screenshot({ path: 'test-results/composite-measure.png', fullPage: true });
    for (const rect of plan.rects) for (const axis of ['w','h']) await measureSide(page,lesson,rect,axis);
    await finishCalculations(page,lesson,plan);
    if (lesson.independent) assert.equal(await page.locator('.support-tag').textContent(), 'SOLVED ON MY OWN');
    console.log(`PASS: complete lesson ${i+1}, ${lesson.title}, with dragged measurements`);
  }
  assert.match(await page.locator('#progress-text').textContent(), /12 of 12/);
  await page.locator('#grownups').click();
  assert.match(await page.locator('#parent-progress').textContent(), /3 of 3 final challenges solved on their own/);
  await page.locator('.dialog-close').click();
  await page.screenshot({ path: 'test-results/completed.png', fullPage: true });

  // Keyboard-only cut is an independent alternative to dragging.
  await page.locator('[data-lesson="9"]').click();
  await page.locator('#keyboard-cut').click();
  for (let i=0;i<7;i++) await page.keyboard.press('ArrowRight');
  for (let i=0;i<3;i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let i=0;i<5;i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#begin-measuring').isEnabled(),true);
  console.log('PASS: keyboard-only independent cut');
  }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', error => failures.push(error.message));
  await mobile.goto(url);
  await mobile.locator('[data-lesson="10"]').tap();
  await mobile.locator('#show-splits').tap();
  await mobile.locator('[data-split="0"]').tap();
  await mobile.locator('#begin-measuring').tap();
  assert.ok((await mobile.locator('#board').boundingBox()).y >= 0, 'New measurement brings mobile board into view');
  await mobile.screenshot({ path: 'test-results/mobile-measure.png', fullPage: true });
  for (const [i,rect] of LESSONS[10].splits[0].rects.entries()) for (const axis of ['w','h']) await measureSide(mobile,LESSONS[10],rect,axis,{manual:i === 0,touch:true});
  await finishCalculations(mobile,LESSONS[10],LESSONS[10].splits[0]);
  assert.equal(await mobile.locator('.support-tag').textContent(),'COMPLETED WITH PRACTICE');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),true,'No mobile horizontal page overflow');
  await mobile.reload();
  assert.match(await mobile.locator('#progress-text').textContent(), /1 of 12/);
  await mobile.locator('#grownups').tap();
  assert.match(await mobile.locator('#parent-progress').textContent(), /0 of 3 final challenges solved on their own/);
  await mobile.locator('#reset-progress').tap();
  await mobile.locator('#reset-progress').tap();
  await mobile.locator('.dialog-close').tap();
  assert.match(await mobile.locator('#progress-text').textContent(), /0 of 12/);
  console.log('PASS: touch dragging and tap controls, mobile layout, supported completion, persistence, and reset');

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => { Object.defineProperty(window,'localStorage',{ get() { throw new DOMException('Unavailable','SecurityError'); } }); });
  const blocked = await blockedContext.newPage();
  await blocked.goto(url);
  assert.match(await blocked.locator('#notebook-title').textContent(), /Meet a square/);
  await blocked.locator('#grownups').click();
  assert.match(await blocked.locator('#parent-progress').textContent(), /storage is unavailable/);
  console.log('PASS: app remains usable when browser storage is unavailable');
  assert.deepEqual(failures,[],'No runtime or asset errors');
  console.log('All browser checks passed.');
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  server?.kill();
}
