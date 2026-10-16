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
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const page = await context.newPage();
let activePage = page;
const touchSessions = new WeakMap();
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
  let session = touchSessions.get(page);
  if (!session) { session = await page.context().newCDPSession(page); touchSessions.set(page,session); }
  await session.send('Input.dispatchTouchEvent',{ type: 'touchStart', touchPoints: [{ x:a.x,y:a.y }] });
  for (let i=1;i<=10;i++) {
    await session.send('Input.dispatchTouchEvent',{ type: 'touchMove', touchPoints: [{ x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10 }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await session.send('Input.dispatchTouchEvent',{ type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
async function touchTap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box,'Touch target is visible');
  let session = touchSessions.get(page);
  if (!session) { session = await page.context().newCDPSession(page); touchSessions.set(page,session); }
  // Use the same native input stream as drags, with a rendered frame between
  // contact and release. A physical tap is not a zero-duration touch sequence.
  await session.send('Input.dispatchTouchEvent',{ type: 'touchStart', touchPoints: [{ x:box.x+box.width/2,y:box.y+box.height/2 }] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await session.send('Input.dispatchTouchEvent',{ type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
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
    if (axis === 'h') {
      if (touch) await touchTap(page,page.locator('#rotate-ruler')); else await page.locator('#rotate-ruler').click();
      await page.waitForFunction(() => document.querySelector('[data-drag="marker"]').getAttribute('aria-orientation') === 'vertical');
    }
    await page.locator('#board').scrollIntoViewIfNeeded();
    const box = await page.locator('[data-drag="zero"] circle:last-child').boundingBox();
    const move = touch ? touchDrag : dragBetween;
    await move(page,{ x: box.x+box.width/2, y: box.y+box.height/2 },await screenPoint(page,lesson,a));
    const marker = await page.locator('[data-drag="marker"] path').first().evaluate(path => { const p = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()); return { x: p.x, y: p.y }; });
    const end = await screenPoint(page,lesson,b);
    await move(page,marker,end);
  } else {
    if (touch) await touchTap(page,page.locator('#align-ruler')); else await page.locator('#align-ruler').click();
    try {
      await page.waitForFunction(({ x,y }) => document.querySelector('[data-drag="zero"]').getAttribute('aria-label').includes(`Zero at ${x} across, ${y} down.`), { x:a[0], y:a[1] }, { timeout: 3000 });
    } catch (error) {
      console.log('Alignment activation events:',await page.evaluate(() => window.touchTrace));
      await page.screenshot({ path: 'test-results/alignment-failure.png', fullPage: true });
      throw error;
    }
    while (Number((await page.locator('#ruler-value').textContent()).split(' ')[0]) !== value) {
      const current = Number((await page.locator('#ruler-value').textContent()).split(' ')[0]);
      const control = page.locator(current < value ? '#longer' : '#shorter');
      if (touch) await touchTap(page,control); else await control.click();
      await page.waitForFunction(expected => Number(document.querySelector('#ruler-value').textContent.split(' ')[0]) === expected, current + (current < value ? 1 : -1));
    }
  }
  if (touch) {
    await touchTap(page,page.locator('#length-answer'));
    await page.waitForFunction(() => document.activeElement?.id === 'length-answer',null,{ timeout: 3000 });
  }
  await page.locator('#length-answer').fill(String(value));
  if (touch) await touchTap(page,page.locator('#measurement-form button')); else await page.locator('#measurement-form button').click();
  await page.waitForFunction(() => !document.querySelector('#length-answer') || document.querySelector('#length-answer').value === '' || document.querySelector('#feedback').textContent !== '');
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

async function rulerDimensions(page) {
  return page.locator('[data-ruler]').evaluate(ruler => ({
    width: Number(ruler.querySelectorAll('[data-ruler-bar]')[1].getAttribute('width')),
    height: Number(ruler.querySelectorAll('[data-ruler-bar]')[1].getAttribute('height')),
    ticks: [...ruler.querySelectorAll('[data-tick] text')].map(tick => Number(tick.getAttribute('x'))),
    screenLength: Number((Math.hypot(ruler.getScreenCTM().a,ruler.getScreenCTM().b)*Number(ruler.querySelectorAll('[data-ruler-bar]')[1].getAttribute('width'))).toFixed(3)),
  }));
}

async function canvasHasInk(page) {
  return page.locator('#scratch-canvas').evaluate(canvas => canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index) => index%4 === 3 && value > 0));
}

async function drawOnScratchpad(page, touch = false) {
  await page.locator('#scratch-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#scratch-canvas').boundingBox();
  await (touch ? touchDrag : dragBetween)(page,{x:box.x+30,y:box.y+40},{x:box.x+150,y:box.y+100});
  assert.equal(await canvasHasInk(page),true,'Scratchpad drawing leaves visible ink');
}

try {
  if (!process.env.MOBILE_ONLY) {
  await page.goto(url);
  assert.match(await page.title(), /Area practice/);
  await page.locator('[data-cell="0-0"]').click();
  assert.match(await page.locator('#board-caption').textContent(), /1 square marked/);
  await page.locator('[data-cell="0-0"]').click();
  await page.screenshot({ path: 'test-results/desktop-explore.png', fullPage: true });
  await page.locator('#begin-measuring').click();
  const fixedRuler = await rulerDimensions(page);
  assert.equal(fixedRuler.width,448);
  assert.deepEqual(fixedRuler.ticks,Array.from({length:16},(_,i) => i*28));
  assert.match(await page.locator('#board-desc').textContent(), /from \(0, 3\) to \(4, 3\)/);
  assert.match(await page.locator('[data-drag="zero"]').getAttribute('aria-label'), /Zero at 0 across/);
  await page.locator('#length-answer').fill('4');
  await page.locator('#measurement-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /First line up/);
  await page.locator('#align-ruler').click();
  await page.locator('#longer').click({ clickCount: 2 });
  assert.deepEqual(await rulerDimensions(page),fixedRuler,'Moving the marker leaves ruler dimensions unchanged');
  await page.locator('#length-answer').fill('5');
  await page.locator('#measurement-form button').click();
  assert.match(await page.locator('#feedback').textContent(), /Write that number/);
  await page.locator('#length-answer').fill('4');
  await page.locator('#measurement-form button').click();
  await page.locator('#rotate-ruler').click();
  assert.deepEqual(await rulerDimensions(page),fixedRuler,'Rotation leaves ruler dimensions unchanged');
  assert.match(await page.locator('#rotate-ruler').textContent(),/Rotate horizontal/);
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
    if (lesson.final) {
      assert.equal(await page.locator('#stepper').isVisible(),false);
      assert.equal(await page.locator('#area-form, #total-form, #reason-form, .equation, .sum-block').count(),0,'Final problem has no filled-in calculations');
      assert.equal(await page.locator('#scratch-text').inputValue(),'');
      assert.equal(await canvasHasInk(page),false);
      assert.deepEqual(await rulerDimensions(page),fixedRuler,'Final ruler has the same fixed dimensions');
      await page.screenshot({path:'test-results/final-blank.png',fullPage:true});
      await page.locator('#scratch-text').fill('4 × 3 = 12\n12 × 5 = 60\n12 + 60 = 72 square feet');
      await page.locator('#final-answer').fill('72');
      await page.locator('#final-unit').selectOption('ft²');
      await page.reload();
      assert.match(await page.locator('#scratch-text').inputValue(),/12 \+ 60 = 72/);
      assert.equal(await page.locator('#final-answer').inputValue(),'72');
      await page.locator('#final-form button').click();
      assert.match(await page.locator('.final-result').textContent(),/Answer correct: 72 ft²/);
      console.log('PASS: independent final problem, blank work area, saved calculations, answer and units');
      continue;
    }
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
    assert.deepEqual(await rulerDimensions(page),fixedRuler,`Fixed ruler in lesson ${i+1}`);
    if (i === 3) await page.screenshot({ path: 'test-results/composite-measure.png', fullPage: true });
    for (const rect of plan.rects) for (const axis of ['w','h']) await measureSide(page,lesson,rect,axis);
    await finishCalculations(page,lesson,plan);
    if (lesson.independent) assert.equal(await page.locator('.support-tag').textContent(), 'COMPLETED WITHOUT HELP');
    console.log(`PASS: complete lesson ${i+1}, ${lesson.title}, with dragged measurements`);
  }
  assert.match(await page.locator('#progress-text').textContent(), /12 of 12/);
  await page.locator('#grownups').click();
  assert.match(await page.locator('#parent-progress').textContent(), /3 of 3 independent problems completed without help/);
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

  const assessment = await browser.newContext({viewport:{width:1440,height:1050}});
  const finalPage = await assessment.newPage();
  activePage = finalPage;
  await finalPage.goto(url);
  await finalPage.locator('[data-lesson="11"]').click();
  await finalPage.locator('#final-answer').fill('72');
  await finalPage.locator('#final-unit').selectOption('ft²');
  await finalPage.locator('#final-form button').click();
  assert.match(await finalPage.locator('#feedback').textContent(),/calculations/);
  await drawOnScratchpad(finalPage);
  await finalPage.locator('[data-scratch-action="eraser"]').click();
  const canvasBox = await finalPage.locator('#scratch-canvas').boundingBox();
  await dragBetween(finalPage,{x:canvasBox.x+30,y:canvasBox.y+40},{x:canvasBox.x+150,y:canvasBox.y+100});
  assert.equal(await canvasHasInk(finalPage),false,'Eraser removes ink');
  await finalPage.locator('[data-scratch-action="undo"]').click();
  assert.equal(await canvasHasInk(finalPage),true,'Undo restores erased ink');
  await finalPage.setViewportSize({width:900,height:1000});
  assert.equal(await canvasHasInk(finalPage),true,'Drawing survives canvas resize');
  await finalPage.reload();
  assert.equal(await canvasHasInk(finalPage),true,'Drawing survives reload');
  await finalPage.locator('#board').scrollIntoViewIfNeeded();
  await dragBetween(finalPage,await screenPoint(finalPage,LESSONS[11],[4,3]),await screenPoint(finalPage,LESSONS[11],[8,3]));
  await finalPage.waitForFunction(() => document.querySelectorAll('.piece-label').length === 2);
  assert.equal(await finalPage.locator('.piece-label').count(),2,'Final problem accepts an optional split');
  await finalPage.reload();
  assert.equal(await finalPage.locator('.piece-label').count(),2,'Final split survives reload');
  assert.equal(await canvasHasInk(finalPage),true,'Splitting leaves scratchpad work intact');
  await finalPage.locator('#final-answer').fill('70');
  await finalPage.locator('#final-form button').click();
  assert.match(await finalPage.locator('#feedback').textContent(),/add the areas/);
  await finalPage.locator('#final-answer').fill('72');
  await finalPage.locator('#final-unit').selectOption('ft');
  await finalPage.locator('#final-form button').click();
  assert.match(await finalPage.locator('#feedback').textContent(),/square units/);
  await finalPage.locator('#final-unit').selectOption('ft²');
  await finalPage.locator('#final-form button').click();
  assert.match(await finalPage.locator('.final-result').textContent(),/Answer correct/);
  await finalPage.locator('#grownups').click();
  assert.match(await finalPage.locator('#parent-progress').textContent(),/0 of 3 independent problems completed without help/);
  await finalPage.locator('.dialog-close').click();
  await finalPage.locator('#replay').click();
  assert.equal(await canvasHasInk(finalPage),false);
  assert.equal(await finalPage.locator('#final-answer').inputValue(),'');
  console.log('PASS: final work required, eraser, undo, resize, reload, incorrect totals/units, and restart');
  await assessment.close();
  activePage = page;
  }

  if (!process.env.DESKTOP_ONLY) {
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  activePage = mobile;
  mobile.on('pageerror', error => failures.push(error.message));
  await mobile.goto(url);
  await mobile.evaluate(() => {
    window.touchTrace = [];
    for (const type of ['touchstart','touchend','touchcancel','pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','mousedown','mouseup','click','focusin']) document.addEventListener(type,event => {
      window.touchTrace.push({ type, target: event.target.closest('button')?.id || event.target.id || event.target.tagName, pointerId:event.pointerId, time: Math.round(performance.now()), scrollY });
      if (window.touchTrace.length > 60) window.touchTrace.shift();
    },true);
  });
  await touchTap(mobile,mobile.locator('[data-lesson="10"]'));
  await touchTap(mobile,mobile.locator('#show-splits'));
  await touchTap(mobile,mobile.locator('[data-split="0"]'));
  await touchTap(mobile,mobile.locator('#begin-measuring'));
  assert.ok((await mobile.locator('#board').boundingBox()).y >= 0, 'New measurement brings mobile board into view');
  await mobile.screenshot({ path: 'test-results/mobile-measure.png', fullPage: true });
  for (const [i,rect] of LESSONS[10].splits[0].rects.entries()) for (const axis of ['w','h']) await measureSide(mobile,LESSONS[10],rect,axis,{manual:i === 0,touch:true});
  await finishCalculations(mobile,LESSONS[10],LESSONS[10].splits[0]);
  assert.equal(await mobile.locator('.support-tag').textContent(),'COMPLETED WITH HELP');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),true,'No mobile horizontal page overflow');
  await mobile.reload();
  assert.match(await mobile.locator('#progress-text').textContent(), /1 of 12/);
  await touchTap(mobile,mobile.locator('#grownups'));
  assert.match(await mobile.locator('#parent-progress').textContent(), /0 of 3 independent problems completed without help/);
  await touchTap(mobile,mobile.locator('#reset-progress'));
  await touchTap(mobile,mobile.locator('#reset-progress'));
  await touchTap(mobile,mobile.locator('.dialog-close'));
  assert.match(await mobile.locator('#progress-text').textContent(), /0 of 12/);
  const countTarget = mobile.locator('[data-count-cell="0-0"]');
  const countBox = await countTarget.boundingBox();
  assert.ok(countBox.width >= 44 && countBox.height >= 44,'Phone counting alternative has full-size tap targets');
  await touchTap(mobile,countTarget);
  assert.equal(await mobile.locator('[data-count-cell="0-0"]').getAttribute('aria-pressed'),'true');
  await touchTap(mobile,mobile.locator('[data-cell="0-0"]'));
  await touchTap(mobile,mobile.locator('#begin-measuring'));
  assert.match(await mobile.locator('#notebook-title').textContent(),/Measure the width/);
  await touchTap(mobile,mobile.locator('[data-lesson="11"]'));
  const label = await mobile.locator('.final-dimension').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)*el.getScreenCTM().a);
  assert.ok(label >= 13,'Phone final dimension labels are readable');
  const dimensionBoxes = await mobile.locator('.final-dimension').evaluateAll(els => els.map(el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  const diagramBox = await mobile.locator('#board').boundingBox();
  for (const [i,a] of dimensionBoxes.entries()) {
    assert.ok(a.x >= diagramBox.x && a.right <= diagramBox.x+diagramBox.width,'Final labels fit within the phone diagram');
    for (const b of dimensionBoxes.slice(i+1)) assert.ok(a.right<=b.x || b.right<=a.x || a.bottom<=b.y || b.bottom<=a.y,'Final dimension labels do not overlap');
  }
  await drawOnScratchpad(mobile,true);
  await touchTap(mobile,mobile.locator('[data-scratch-action="clear"]'));
  assert.equal(await canvasHasInk(mobile),false,'Touch clear removes drawing');
  await drawOnScratchpad(mobile,true);
  await mobile.reload();
  assert.equal(await canvasHasInk(mobile),true);
  await mobile.screenshot({path:'test-results/mobile-final.png',fullPage:true});
  await touchTap(mobile,mobile.locator('#final-answer'));
  await mobile.locator('#final-answer').fill('72');
  await mobile.locator('#final-unit').selectOption('ft²');
  await touchTap(mobile,mobile.locator('#final-form button'));
  assert.match(await mobile.locator('.final-result').textContent(),/Answer correct: 72 ft²/);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),true,'Final mobile page fits viewport');
  console.log('PASS: native touch scratchpad drawing, clear, restored work, and final submission');
  await touchTap(mobile,mobile.locator('[data-lesson="3"]'));
  await mobile.locator('#board').scrollIntoViewIfNeeded();
  await touchDrag(mobile,await screenPoint(mobile,LESSONS[3],[4,2]),await screenPoint(mobile,LESSONS[3],[4,5]));
  await touchTap(mobile,mobile.locator('#begin-measuring'));
  assert.match(await mobile.locator('#notebook-title').textContent(),/Measure the width/);
  console.log('PASS: touch dragging and tap controls, mobile layout, supported completion, persistence, and reset');
  }

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => { Object.defineProperty(window,'localStorage',{ get() { throw new DOMException('Unavailable','SecurityError'); } }); });
  const blocked = await blockedContext.newPage();
  await blocked.goto(url);
  assert.match(await blocked.locator('#notebook-title').textContent(), /Count square units/);
  await blocked.locator('#grownups').click();
  assert.match(await blocked.locator('#parent-progress').textContent(), /storage is unavailable/);
  console.log('PASS: app remains usable when browser storage is unavailable');
  assert.deepEqual(failures,[],'No runtime or asset errors');
  console.log('All browser checks passed.');
} catch (error) {
  console.log('Last touch events:',await activePage.evaluate(() => window.touchTrace));
  await activePage.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  server?.kill();
}
