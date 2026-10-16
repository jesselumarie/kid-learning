import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chromium' });
console.log('Touch control browser:', browser.version());

async function touchDrag(page, session, a, b) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 10; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10,
    }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function touchTap(page, session, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{
    x: box.x + box.width / 2, y: box.y + box.height / 2,
  }] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

try {
  const cases = [
    { name: 'no-drag baseline', drag: false, capture: false, fill: false },
    ...[false, true].flatMap(capture => [false, true].map(fill => ({
      name: `drag; capture=${capture}; fill=${fill}`, drag: true, capture, fill,
    }))),
    { name: 'drag; capture=true; fill=true; wrapper touch-action=none', drag: true, capture: true, fill: true, wrapper: true },
  ];
  for (const scenario of cases) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await page.setContent(`<!doctype html><html lang="en"><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body{margin:16px;font:16px Arial,sans-serif}
          #surface{touch-action:${scenario.wrapper ? 'none' : 'auto'}}
          svg{display:block;width:358px;height:260px;touch-action:none;user-select:none;background:#eef3ed}
          input,button{display:block;font:inherit;margin-top:20px;padding:14px;touch-action:manipulation}
        </style></head><body>
        <div id="surface"><svg id="board" viewBox="0 0 358 260"><circle id="handle" cx="90" cy="110" r="22" fill="#32766c"/></svg></div>
        <label for="answer">Length</label><input id="answer" inputmode="numeric">
        <button id="record" type="button">Record measurement</button><output id="count">0</output>
        </body></html>`);
      await page.evaluate(capture => {
        window.eventTrace = [];
        window.clickCount = 0;
        for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'focusin']) {
          document.addEventListener(type, event => {
            window.eventTrace.push({
              type, target: event.target.id || event.target.tagName,
              pointerId: event.pointerId, pointerType: event.pointerType,
              primary: event.isPrimary, prevented: event.defaultPrevented,
              time: Math.round(performance.now()), scrollY,
            });
          }, true);
        }
        const board = document.querySelector('#board');
        if (capture) {
          board.addEventListener('pointerdown', event => board.setPointerCapture(event.pointerId));
          board.addEventListener('pointerup', event => {
            if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
          });
        }
        document.querySelector('#record').addEventListener('click', () => {
          document.querySelector('#count').textContent = String(++window.clickCount);
        });
      }, scenario.capture);
      if (scenario.drag) {
        const box = await page.locator('#handle').boundingBox();
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await touchDrag(page, session, start, { x: start.x + 70, y: start.y - 40 });
        await touchDrag(page, session, start, { x: start.x + 90, y: start.y + 40 });
      }
      if (scenario.fill) await page.locator('#answer').fill('10');
      await touchTap(page, session, page.locator('#record'));
      console.log(JSON.stringify({ scenario: scenario.name, ...await page.evaluate(() => ({
        clicks: window.clickCount, activeElement: document.activeElement.id,
        touchAction: Object.fromEntries(['surface', 'board', 'handle', 'answer', 'record'].map(id => [
          id, getComputedStyle(document.getElementById(id)).touchAction,
        ])),
        svgBounds: document.getElementById('board').getBoundingClientRect().toJSON(),
        trace: window.eventTrace,
      })) }));
    } catch (error) {
      console.log(JSON.stringify({ scenario: scenario.name, error: String(error) }));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
