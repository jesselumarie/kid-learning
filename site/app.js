import { LESSONS } from './lessons.js';
import { checkNumber, evaluateWork, polygonArea, splitFromCuts } from './math.js';

const $ = (selector) => document.querySelector(selector);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const colors = ['#b5d3bb', '#f0cc82', '#e8ac98', '#b6cddd', '#d4bfdc', '#cad89a'];
const chapterNames = ['Meet the squares', 'Break it into parts', 'Think it through', 'Try it on your own'];
const storageKey = 'kid-learning-area-v1';
let storageAvailable = true;
let progress = { current: 0, completed: {} };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved.completed === 'object' && saved.completed !== null) {
    progress.completed = Object.fromEntries(Object.entries(saved.completed).filter(([id]) => LESSONS.some(lesson => lesson.id === id)));
    progress.current = Number.isInteger(saved.current) && LESSONS[saved.current] ? saved.current : 0;
  }
} catch { storageAvailable = false; }

let index = progress.current;
let lesson, state, layout, drag;
const board = $('#board');
const escape = (text) => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const split = () => state.customSplit || lesson.splits[Math.max(0, state.splitIndex)];
const unit = () => `${lesson.unit}²`;
const isRect = () => lesson.polygon.length === 4;
const completeCount = () => Object.keys(progress.completed).length;

function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); }
  catch { storageAvailable = false; }
}

function startLesson(next, focus = false) {
  index = next;
  lesson = LESSONS[index];
  progress.current = index;
  state = {
    phase: 'split', splitIndex: isRect() ? 0 : -1, drawnLines: [], showChoices: !lesson.independent, customSplit: null, cursor: null, cutStart: null,
    grid: lesson.grid, counted: new Set(), measuring: 0, supported: false, hints: 0,
    work: { measurements: [], areas: [], total: '', unit: '', reason: -1 },
    ruler: { x: 0, y: 0, vertical: false, value: 2 },
  };
  const width = Math.max(...lesson.polygon.map(p => p[0]));
  const height = Math.max(...lesson.polygon.map(p => p[1]));
  const scale = Math.min(80, 500 / (width + 2), 330 / (height + 1));
  layout = { scale, x: (720 - width * scale) / 2, y: (400 - height * scale) / 2 };
  saveProgress();
  render();
  if (focus) $('#workspace').focus({ preventScroll: true });
}

function renderNav() {
  $('#lesson-nav').innerHTML = chapterNames.map((name, chapter) => `<div class="chapter"><div class="chapter-heading"><span>${chapter + 1}</span>${name}</div>${LESSONS.map((item, i) => item.chapter !== chapter ? '' : `<button class="lesson-link ${i === index ? 'active' : ''} ${progress.completed[item.id] ? 'completed' : ''}" data-lesson="${i}" ${i === index ? 'aria-current="step"' : ''} aria-label="Lesson ${i + 1}: ${escape(item.title)}${progress.completed[item.id] ? ', completed' : ''}"><span class="lesson-status">${progress.completed[item.id] ? '✓' : String(i + 1).padStart(2, '0')}</span><span class="lesson-name">${escape(item.title)}</span></button>`).join('')}</div>`).join('');
  const completed = completeCount();
  $('#progress-text').textContent = `${completed} of ${LESSONS.length} explored`;
  $('#progress-percent').textContent = `${Math.round(completed / LESSONS.length * 100)}%`;
  $('#progress-fill').style.width = `${completed / LESSONS.length * 100}%`;
}

function render() {
  renderNav();
  $('#lesson-meta').textContent = `CHAPTER ${lesson.chapter + 1} / ${chapterNames[lesson.chapter].toUpperCase()} · ${String(index + 1).padStart(2, '0')}`;
  $('#lesson-title').textContent = lesson.title;
  $('#lesson-story').textContent = lesson.story;
  $('#lesson-badge').textContent = lesson.independent ? '✧ YOUR TURN' : '✧ ONE STEP AT A TIME';
  const current = { split: 0, measure: 1, area: 2, total: 2, reason: 3, done: 4 }[state.phase];
  $('#stepper').innerHTML = [isRect() ? 'Explore' : 'Split', 'Measure', 'Calculate', 'Explain'].map((name, i) => `<li class="${i === current ? 'active' : i < current ? 'complete' : ''}" ${i === current ? 'aria-current="step"' : ''}><span>${i < current ? '✓' : i + 1}</span>${name}</li>`).join('');
  $('#model-unit').textContent = lesson.unit;
  $('#grid-toggle').setAttribute('aria-pressed', state.grid);
  $('#grid-toggle span').textContent = state.grid ? 'Grid on' : 'Grid off';
  $('#big-idea').textContent = state.phase === 'done' ? lesson.reason.choices.find(choice => choice.correct).feedback : lesson.independent ? 'Take your time. Help is here whenever you want it.' : lesson.tip;
  $('#hint-button').hidden = state.phase === 'done';
  $('#hint-text').textContent = '';
  $('#feedback').textContent = '';
  $('#feedback').className = '';
  renderBoard();
  renderTask();
  renderTools();
}

function xy([x, y]) { return [layout.x + x * layout.scale, layout.y + y * layout.scale]; }
function lineSvg(a, b, attrs = '') { const [x1, y1] = xy(a); const [x2, y2] = xy(b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`; }
function rectSvg(rect, attrs = '') { const [x, y] = xy([rect.x, rect.y]); return `<rect x="${x}" y="${y}" width="${rect.w * layout.scale}" height="${rect.h * layout.scale}" ${attrs}/>`; }
function pointsString(points) { return points.map(p => xy(p).join(',')).join(' '); }
function target() {
  const pieceIndex = Math.floor(state.measuring / 2);
  const axis = state.measuring % 2 === 0 ? 'w' : 'h';
  const rect = split().rects[pieceIndex];
  if (!rect) return null;
  return { pieceIndex, axis, length: rect[axis], a: axis === 'w' ? [rect.x, rect.y + rect.h] : [rect.x, rect.y], b: axis === 'w' ? [rect.x + rect.w, rect.y + rect.h] : [rect.x, rect.y + rect.h] };
}

function renderBoard() {
  const active = state.phase === 'measure' ? target() : null;
  const showParts = state.splitIndex >= 0;
  const boundary = `Coordinates count ${lesson.unit} across, then down from the top-left origin. The shape boundary joins these corners in order and returns to the start: ${lesson.polygon.map(([x,y]) => `(${x}, ${y})`).join('; ')}.`;
  const taskDescription = active ? `Measure rectangle ${letters[active.pieceIndex]} ${active.axis === 'w' ? 'width' : 'height'}, from (${active.a.join(', ')}) to (${active.b.join(', ')}). Focus the ruler zero handle and use arrows to move it. Use Turn to change direction. Focus the end marker and use arrows to change its reading.` : 'To draw with keys, focus this table. Arrow keys move the cut cursor; Enter starts or finishes a cut; Escape cancels it.';
  let svg = `<title id="board-title">${escape(lesson.title)}: ${isRect() ? 'rectangle' : 'composite shape'}</title><desc id="board-desc">${boundary} ${taskDescription}</desc><defs><pattern id="unit-grid" width="${layout.scale}" height="${layout.scale}" patternUnits="userSpaceOnUse" x="${layout.x}" y="${layout.y}"><path d="M ${layout.scale} 0 L 0 0 0 ${layout.scale}" fill="none" stroke="#48735e" stroke-opacity=".25" stroke-width="1.2"/></pattern><clipPath id="shape-clip"><polygon points="${pointsString(lesson.polygon)}"/></clipPath></defs>`;
  svg += `<polygon points="${pointsString(lesson.polygon.map(([x,y]) => [x + .11,y + .13]))}" fill="#e8e9da"/>`;
  if (showParts) split().rects.forEach((rect, i) => { svg += rectSvg(rect, `fill="${colors[i]}" fill-opacity="${active && active.pieceIndex !== i ? '.5' : '.9'}"`); });
  else svg += `<polygon points="${pointsString(lesson.polygon)}" fill="${colors[0]}" fill-opacity=".85"/>`;
  if (state.grid) svg += `<polygon points="${pointsString(lesson.polygon)}" fill="url(#unit-grid)"/>`;
  if (state.phase === 'split' && isRect() && state.grid) {
    const rect = split().rects[0];
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const key = `${x}-${y}`;
      svg += rectSvg({ x, y, w: 1, h: 1 }, `fill="${state.counted.has(key) ? '#f1c467' : 'transparent'}" fill-opacity=".85" stroke="#48735e" stroke-opacity=".2" data-cell="${key}" tabindex="0" role="button" aria-pressed="${state.counted.has(key)}" aria-label="Square in row ${y + 1}, column ${x + 1}" style="cursor:pointer"`);
      if (state.counted.has(key)) { const [cx, cy] = xy([x + .5, y + .5]); svg += `<text x="${cx}" y="${cy}" dominant-baseline="central" text-anchor="middle" fill="#826024" font-size="18" pointer-events="none">✓</text>`; }
    }
  }
  svg += `<polygon points="${pointsString(lesson.polygon)}" fill="none" class="shape-stroke" pointer-events="none"/>`;
  if (showParts && !isRect()) {
    split().lines.forEach(([a,b]) => { svg += lineSvg(a,b, 'stroke="#fffef9" stroke-width="4" stroke-dasharray="7 5" pointer-events="none"'); });
    split().rects.forEach((rect, i) => { const [x, y] = xy([rect.x + rect.w / 2, rect.y + rect.h / 2]); svg += `<circle cx="${x}" cy="${y}" r="15" fill="#fffef9" fill-opacity=".75"/><text x="${x}" y="${y + 1}" class="piece-label" text-anchor="middle" dominant-baseline="central">${letters[i]}</text>`; });
  }
  if (state.phase === 'split' && !isRect() && !showParts) {
    state.drawnLines.forEach(([a,b]) => { svg += lineSvg(a,b, 'stroke="#3c7868" stroke-width="3" stroke-dasharray="7 5"'); });
    lesson.polygon.forEach(point => { const [x, y] = xy(point); svg += `<circle cx="${x}" cy="${y}" r="6" stroke="#397969" stroke-width="2" fill="#fffef9"/>`; });
    if (drag?.kind === 'split') svg += lineSvg(drag.start,drag.end,'stroke="#bd8840" stroke-width="3" stroke-dasharray="6 4"');
    if (state.cursor) {
      const [cx,cy] = xy(state.cursor);
      if (state.cutStart) svg += lineSvg(state.cutStart,state.cursor,'stroke="#bd8840" stroke-width="3" stroke-dasharray="6 4"');
      svg += `<circle cx="${cx}" cy="${cy}" r="13" fill="#fff6d8" stroke="#aa772c" stroke-width="2"/><path d="M ${cx-19} ${cy} h38 M ${cx} ${cy-19} v38" stroke="#aa772c" stroke-width="2"/>`;
    }
  }
  state.work.measurements.forEach((entry, i) => {
    const rect = split().rects[i];
    if (entry.w) { const a = [rect.x,rect.y + rect.h + .27]; const b = [rect.x + rect.w,rect.y + rect.h + .27]; const [tx,ty] = xy([rect.x + rect.w / 2,rect.y + rect.h + .82]); svg += lineSvg(a,b,'stroke="#477562" stroke-width="1.5"') + `<text x="${tx}" y="${ty}" class="dimension-label" text-anchor="middle">${entry.w} ${lesson.unit}</text>`; }
    if (entry.h) { const [tx,ty] = xy([rect.x - .42,rect.y + rect.h / 2]); svg += `<text x="${tx}" y="${ty}" class="dimension-label" text-anchor="end" dominant-baseline="central">${entry.h}</text>`; }
  });
  if (active) {
    svg += lineSvg(active.a,active.b,'stroke="#d36d4e" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 9"');
    for (const p of [active.a,active.b]) { const [x,y] = xy(p); svg += `<circle cx="${x}" cy="${y}" r="7" fill="#fffef9" stroke="#cb6e50" stroke-width="2"/>`; }
    svg += rulerSvg();
  }
  if (state.phase === 'done') {
    const bottom = Math.max(...lesson.polygon.map(p => p[1]));
    const [x,y] = xy([Math.max(...lesson.polygon.map(p => p[0])) / 2,bottom + 1.8]);
    svg += `<text x="${x}" y="${Math.min(472,y)}" text-anchor="middle" font-size="24" font-weight="750" fill="#396e5c">Total area: ${polygonArea(lesson.polygon)} ${unit()}</text>`;
  }
  board.innerHTML = svg;
  if (state.phase === 'split' && isRect()) $('#board-caption').innerHTML = `<span class="count-prompt">${state.counted.size ? `${state.counted.size} ${state.counted.size === 1 ? 'square' : 'squares'} marked. Tap again to unmark.` : 'Tap the squares. Each one covers one square unit.'}</span>`;
  else if (state.phase === 'split' && state.splitIndex < 0) $('#board-caption').textContent = state.cursor ? `Cut cursor: ${state.cursor[0]} across, ${state.cursor[1]} down. ${state.cutStart ? 'Enter to finish cut. Escape to cancel.' : 'Enter to start a cut.'}` : 'Draw a straight cut from a corner to an opposite edge.';
  else if (active) $('#board-caption').innerHTML = `<span><i class="swatch" style="background:${colors[active.pieceIndex]}"></i>Measure rectangle ${letters[active.pieceIndex]}: <strong>${active.axis === 'w' ? 'width ↔' : 'height ↕'}</strong></span>`;
  else $('#board-caption').innerHTML = split().rects.map((rect,i) => `<span><i class="swatch" style="background:${colors[i]}"></i>Rectangle ${letters[i]}</span>`).join('<span aria-hidden="true"> · </span>');
}

function rulerSvg() {
  const { x, y, vertical, value } = state.ruler;
  const s = layout.scale;
  const [px, py] = xy([x,y]);
  const length = Math.max(5, value + 1);
  const width = length * s;
  const mobile = window.innerWidth <= 680;
  const height = mobile ? 62 : 40;
  const positionLabel = `Zero at ${Number(x.toFixed(1))} across, ${Number(y.toFixed(1))} down. ${vertical ? 'Vertical' : 'Horizontal'}. Use arrow keys to move one unit.`;
  let svg = `<g data-ruler transform="translate(${px} ${py}) rotate(${vertical ? 90 : 0})"><g class="ruler-body" data-drag="body" tabindex="0" role="button" aria-label="Move ruler. ${positionLabel}"><rect data-ruler-bar x="-14" y="0" width="${width + 28}" height="${height + 3}" rx="5" fill="#d3a343" opacity=".22" transform="translate(0 4)"/><rect data-ruler-bar x="-14" y="0" width="${width + 28}" height="${height}" rx="5" fill="#f4d984" fill-opacity=".94" stroke="#b89648" stroke-width="1.2"/>`;
  for (let i = 0; i <= 19; i++) {
    svg += `<g data-tick="${i}" style="display:${i <= length ? 'inline' : 'none'}"><path d="M ${i*s} 0 v${mobile ? 19 : 13}" stroke="#8b7036" stroke-width="1.3"/><text x="${i*s}" y="${mobile ? 46 : 29}" text-anchor="middle" font-size="${mobile ? 22 : 14}" font-weight="700" fill="#755d2b">${i}</text></g>`;
  }
  svg += `</g><g data-drag="zero" class="ruler-body" tabindex="0" role="button" aria-label="Ruler zero handle. ${positionLabel}"><circle cx="0" cy="0" r="${mobile ? 42 : 24}" fill="transparent"/><circle cx="0" cy="0" r="${mobile ? 10 : 7}" fill="#fffdf1" stroke="#9d7b2d" stroke-width="2"/></g><g data-drag="marker" data-base-value="${value}" class="ruler-marker" tabindex="0" role="slider" aria-label="Ruler end marker" aria-orientation="${vertical ? 'vertical' : 'horizontal'}" aria-valuemin="0" aria-valuemax="18" aria-valuenow="${value}" aria-valuetext="${value} ${lesson.unit}"><rect x="${value*s-(mobile ? 42 : 24)}" y="-24" width="${mobile ? 84 : 48}" height="${height+42}" fill="transparent"/><path d="M ${value*s} -17 v${height+25}" stroke="#b35e43" stroke-width="2.5"/><path d="M ${value*s-8} -21 h16 l-8 12 Z" fill="#b35e43"/><circle cx="${value*s}" cy="${height+8}" r="${mobile ? 9 : 6}" fill="#b35e43"/></g></g>`;
  return svg;
}

function renderTools() {
  if (state.phase === 'measure') {
    $('#toolbox').innerHTML = `<div class="tool-group"><button id="align-ruler" title="Place the ruler’s zero at the start of this side">⌖ Line up zero</button><button id="rotate-ruler" aria-label="Turn ruler ${state.ruler.vertical ? 'horizontal' : 'vertical'}">↻ Turn</button></div><div class="tool-group ruler-reading"><button id="shorter" aria-label="Move ruler marker back one unit">−</button><output id="ruler-value" aria-live="off">${state.ruler.value} ${lesson.unit}</output><button id="longer" aria-label="Move ruler marker forward one unit">+</button></div>`;
  } else if (state.phase === 'split' && !isRect()) {
    $('#toolbox').innerHTML = `<span class="small-tool-note">${state.splitIndex < 0 ? `${state.drawnLines.length ? state.drawnLines.length + ' cut drawn. Keep going.' : 'Drag a cut, or use arrow keys + Enter.'}` : `${split().rects.length} rectangles. One whole shape.`}</span><div class="tool-group">${state.splitIndex < 0 ? '<button id="keyboard-cut">⌨ Draw with keys</button>' : ''}<button id="clear-split">↺ Clear cuts</button></div>`;
  } else {
    $('#toolbox').innerHTML = `<span class="small-tool-note">${state.phase === 'split' ? 'Every square counts. Try counting by rows.' : state.phase === 'done' ? 'A complete answer includes square units.' : 'Your measurements are marked on the shape.'}</span>`;
  }
}

function measurementLog() {
  return `<div class="measurement-log">${state.work.measurements.map((entry,i) => `<div class="measurement-entry"><span><i class="swatch" style="background:${colors[i]}"></i>Rectangle ${letters[i]}</span><strong>${entry.w || '?'} × ${entry.h || '?'} ${lesson.unit}</strong></div>`).join('')}</div>`;
}

function splitIcon(plan) {
  const width = Math.max(...lesson.polygon.map(p => p[0]));
  const height = Math.max(...lesson.polygon.map(p => p[1]));
  return `<svg viewBox="-1 -1 ${width+2} ${height+2}" aria-hidden="true">${plan.rects.map((rect,i) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${colors[i]}" stroke="#fffef9" stroke-width=".3"/>`).join('')}</svg>`;
}

function renderTask() {
  const phase = state.phase;
  $('#note-count').textContent = phase === 'done' ? 'ALL SET ✓' : `${Math.min(4, { split: 1, measure: 2, area: 3, total: 3, reason: 4 }[phase])} / 4`;
  let html = '';
  if (phase === 'split') {
    if (isRect()) {
      html = `<h3 id="notebook-title">${index === 0 ? 'Meet a square unit.' : 'Look for the rows.'}</h3><p class="task-description">${index === 0 ? 'A square that is 1 cm wide and 1 cm tall covers 1 square centimeter. Tap the squares to see how they cover this patch.' : 'The squares fit together with no gaps. Each row has the same number of squares. That is a shortcut waiting to happen.'}</p><div class="unit-square-demo"><div></div><span>1 ${lesson.unit} × 1 ${lesson.unit}<br><strong>1 ${unit()}</strong></span></div><p class="small-tip">Area tells us how much space is <strong>inside</strong> a shape.</p><button id="begin-measuring" class="primary-button">Let’s measure the sides <span>→</span></button>`;
    } else {
      html = `<h3 id="notebook-title">Make simpler pieces.</h3><p class="task-description">${lesson.independent ? 'Draw a straight cut from a corner to an edge. Make rectangles that cover the whole shape, with no gaps or overlaps.' : 'Draw a cut across the shape, or choose a plan below. Each colored piece should be a rectangle.'}</p>`;
      if (state.showChoices) html += `<div class="choice-list">${lesson.splits.map((plan,i) => `<button class="choice split-choice ${state.splitIndex === i ? 'selected' : ''}" data-split="${i}" aria-pressed="${state.splitIndex === i}"><span class="split-name"><span>${state.splitIndex === i ? '◉' : '○'}</span>${escape(plan.label)}</span>${splitIcon(plan)}</button>`).join('')}</div>`;
      else html += `<button id="show-splits" class="secondary-button full-width">Help me choose a split</button>`;
      html += `<p class="small-tip">${state.splitIndex >= 0 ? `${split().rects.length} rectangles cover the shape exactly once. Now measure each rectangle’s own sides.` : 'The line should cut through the inside. An outside edge does not make a new piece.'}</p><button id="begin-measuring" class="primary-button" ${state.splitIndex < 0 ? 'disabled' : ''}>Use my plan <span>→</span></button>`;
    }
  }
  if (phase === 'measure') {
    const t = target();
    html = `<span class="part-badge"><i class="swatch" style="background:${colors[t.pieceIndex]}"></i>RECTANGLE ${letters[t.pieceIndex]} · ${state.measuring + 1} OF ${split().rects.length * 2} SIDES</span><h3 id="notebook-title">Measure the ${t.axis === 'w' ? 'width' : 'height'}.</h3><p class="task-description">Move the ruler’s <strong>0</strong> to one end of the dotted side. Slide the red marker to the other end. Read the ruler and write the length.</p><form id="measurement-form"><label class="field-label" for="length-answer">${t.axis === 'w' ? 'Width' : 'Height'} of rectangle ${letters[t.pieceIndex]}</label><div class="input-row"><input id="length-answer" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" aria-describedby="feedback"><span class="input-unit">${lesson.unit}</span></div><button class="primary-button" type="submit">Mark this measurement <span>↗</span></button></form>${measurementLog()}<p class="saved-note">Tip: “Line up zero” places the ruler. The − and + buttons move its red marker. You still read and record the length.</p>`;
  }
  if (phase === 'area') {
    html = `<h3 id="notebook-title">Find the space inside.</h3><p class="task-description">${split().rects.length === 1 ? 'You know the width and height. Multiply them to count all the squares inside.' : 'Use each rectangle’s own measurements. Multiply width × height to find its area.'}</p><form id="area-form">${split().rects.map((rect,i) => `<div class="area-row"><label for="area-${i}"><i class="swatch" style="background:${colors[i]}"></i>Rectangle ${letters[i]}</label><div class="equation"><span>${state.work.measurements[i].w}</span><span class="operator">×</span><span>${state.work.measurements[i].h}</span><span class="operator">=</span><input id="area-${i}" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" value="${escape(state.work.areas[i] || '')}" aria-label="Area of rectangle ${letters[i]}" aria-describedby="feedback"><span class="area-unit">${unit()}</span></div>${index < 3 ? `<p class="equation-note">${rect.h} rows, with ${rect.w} squares in each row.</p>` : ''}</div>`).join('')}<button type="submit" class="primary-button">Check my ${split().rects.length === 1 ? 'area' : 'rectangle areas'} <span>→</span></button></form>`;
  }
  if (phase === 'total') {
    html = `<h3 id="notebook-title">${split().rects.length > 1 ? 'Bring the parts together.' : 'Finish your answer.'}</h3><p class="task-description">${split().rects.length > 1 ? 'Each part is measured in square units. Add the part areas to find the area of the whole shape.' : 'One rectangle makes the whole shape. Write its area and choose the unit that tells what you counted.'}</p><div class="sum-block">${state.work.areas.join(' <span class="operator">+</span> ')} = ?</div><form id="total-form"><label class="field-label" for="total-answer">Total area</label><div class="input-row"><input id="total-answer" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" value="${escape(state.work.total)}" aria-describedby="feedback"></div><label class="field-label" for="unit-answer">What kind of units?</label><select id="unit-answer" class="unit-select"><option value="">Choose the unit</option><option value="${lesson.unit}" ${state.work.unit === lesson.unit ? 'selected' : ''}>${lesson.unit === 'cm' ? 'Centimeters (cm)' : 'Feet (ft)'}</option><option value="${unit()}" ${state.work.unit === unit() ? 'selected' : ''}>${lesson.unit === 'cm' ? 'Square centimeters (cm²)' : 'Square feet (ft²)'}</option></select><button type="submit" class="primary-button">Check my whole answer <span>→</span></button></form>`;
  }
  if (phase === 'reason') {
    html = `<h3 id="notebook-title">Tell the story.</h3><p class="task-description">${escape(lesson.reason.question)}</p><form id="reason-form"><fieldset class="reason-fieldset"><legend class="sr-only">Choose an explanation</legend><div class="choice-list">${lesson.reason.choices.map((choice,i) => `<label class="choice ${state.work.reason === i ? 'selected' : ''}"><input type="radio" name="reason" value="${i}" ${state.work.reason === i ? 'checked' : ''}><span>${escape(choice.text)}</span></label>`).join('')}</div></fieldset><button type="submit" class="primary-button">That’s my thinking <span>→</span></button></form>`;
  }
  if (phase === 'done') {
    const allDone = completeCount() === LESSONS.length;
    html = `<div class="celebration" aria-hidden="true">✦</div>${lesson.independent ? `<div class="support-tag">${state.supported ? 'COMPLETED WITH PRACTICE' : 'SOLVED ON MY OWN'}</div>` : ''}<h3 id="notebook-title">${allDone ? 'Look how far you’ve come.' : 'You figured it out.'}</h3><p class="task-description">${state.supported ? 'You checked your thinking and kept going. That is how ideas grow.' : 'You measured carefully and made a complete area plan.'}</p><div class="completion-equation">${state.work.areas.join(' + ')}${state.work.areas.length > 1 ? ` = ${state.work.total}` : ''} ${unit()}</div><ul class="completed-checklist"><li>Every part counted once</li><li>Each rectangle’s area found</li><li>A total with square units</li><li>Your thinking explained</li></ul><button id="next-lesson" class="primary-button">${allDone ? 'Practice a new plan' : index < LESSONS.length - 1 ? 'On to the next discovery' : 'Keep exploring'} <span>→</span></button><button id="replay" class="text-button full-width">${isRect() ? 'Try this one again' : 'Try a different split'}</button><p class="saved-note">${storageAvailable ? 'Your progress is saved on this device.' : 'Progress could not be saved in this browser. You can keep exploring in this session.'}${allDone ? ' Try again another day to see what you remember.' : ''}</p>`;
  }
  $('#task-panel').innerHTML = html;
}

function resetRuler() {
  const t = target();
  state.ruler = { x: t.a[0], y: Math.min(t.a[1] + 2, Math.floor((450 - layout.y) / layout.scale)), vertical: false, value: 2 };
}

function showFeedback(message, success = false) {
  $('#feedback').textContent = message;
  $('#feedback').className = success ? 'success' : '';
  if (!success) state.supported = true;
}

function errorsFor(fields) { return evaluateWork(lesson, split(), state.work).errors.filter(error => fields.includes(error.field)); }
function continuePhase(phase) { state.phase = phase; state.hints = 0; render(); const input = $('#task-panel input'); if (input && window.innerWidth > 680) input.focus({ preventScroll: true }); }

function rulerAligned() {
  const t = target();
  const r = state.ruler;
  return Math.abs(r.x - t.a[0]) < .35 && Math.abs(r.y - t.a[1]) < .35 && r.vertical === (t.axis === 'h') && r.value === t.length;
}

function onSubmit(event) {
  const form = event.target;
  if (!['measurement-form', 'area-form', 'total-form', 'reason-form'].includes(form.id)) return;
  event.preventDefault();
  if (form.id === 'measurement-form') {
    const t = target();
    if (!rulerAligned()) {
      showFeedback('First line up the ruler’s 0 with the start of the dotted side. Turn it if needed, then move the red marker to the other corner.');
      return;
    }
    if (!checkNumber($('#length-answer').value, t.length)) { showFeedback('Look where the red marker meets the ruler. Write that number. Count the spaces from 0, not the tick marks.'); return; }
    state.work.measurements[t.pieceIndex] ??= {};
    state.work.measurements[t.pieceIndex][t.axis] = String(Number($('#length-answer').value));
    state.measuring++;
    if (state.measuring === split().rects.length * 2) continuePhase('area');
    else { state.hints = 0; resetRuler(); render(); if (window.innerWidth > 680) $('#length-answer').focus({ preventScroll: true }); else scrollToBoard(); }
  }
  if (form.id === 'area-form') {
    state.work.areas = split().rects.map((_,i) => $(`#area-${i}`).value.trim());
    const errors = errorsFor(split().rects.map((_,i) => `area-${i}`));
    if (errors.length) { const error = errors[0]; showFeedback(`Rectangle ${letters[Number(error.field.split('-')[1])]}: ${error.message}`); $(`#${error.field}`).setAttribute('aria-invalid','true'); return; }
    state.work.areas = state.work.areas.map(value => String(Number(value)));
    continuePhase('total');
  }
  if (form.id === 'total-form') {
    state.work.total = $('#total-answer').value.trim();
    state.work.unit = $('#unit-answer').value;
    const errors = errorsFor(['total','unit']);
    if (errors.length) { showFeedback(errors[0].message); return; }
    state.work.total = String(Number(state.work.total));
    continuePhase('reason');
  }
  if (form.id === 'reason-form') {
    const checked = form.querySelector('input:checked');
    state.work.reason = checked ? Number(checked.value) : -1;
    const result = evaluateWork(lesson, split(), state.work);
    if (!result.correct) { showFeedback(result.errors[0].message); return; }
    const previous = progress.completed[lesson.id];
    progress.completed[lesson.id] = { independent: Boolean(previous?.independent || (lesson.independent && !state.supported)), completedAt: new Date().toISOString() };
    saveProgress();
    continuePhase('done');
  }
}

function updateRuler(focusHandle) {
  // Keep the touched nodes alive through pointerup and the native touchend.
  // Native touchend must still reach the element where the touch started.
  const ruler = board.querySelector('[data-ruler]');
  if (!ruler) { renderBoard(); return; }
  const { x,y,vertical,value } = state.ruler;
  const [px,py] = xy([x,y]);
  ruler.setAttribute('transform',`translate(${px} ${py}) rotate(${vertical ? 90 : 0})`);
  const length = Math.max(5,value+1);
  ruler.querySelectorAll('[data-ruler-bar]').forEach(bar => bar.setAttribute('width',length*layout.scale+28));
  ruler.querySelectorAll('[data-tick]').forEach(tick => { tick.style.display = Number(tick.dataset.tick) <= length ? 'inline' : 'none'; });
  const position = `Zero at ${Number(x.toFixed(1))} across, ${Number(y.toFixed(1))} down. ${vertical ? 'Vertical' : 'Horizontal'}. Use arrow keys to move one unit.`;
  ruler.querySelector('[data-drag="body"]').setAttribute('aria-label',`Move ruler. ${position}`);
  ruler.querySelector('[data-drag="zero"]').setAttribute('aria-label',`Ruler zero handle. ${position}`);
  const marker = ruler.querySelector('[data-drag="marker"]');
  marker.setAttribute('transform',`translate(${(value-Number(marker.dataset.baseValue))*layout.scale} 0)`);
  marker.setAttribute('aria-valuenow',value);
  marker.setAttribute('aria-valuetext',`${value} ${lesson.unit}`);
  marker.setAttribute('aria-orientation',vertical ? 'vertical' : 'horizontal');
  const output = $('#ruler-value');
  if (output) output.textContent = `${state.ruler.value} ${lesson.unit}`;
  if (focusHandle) board.querySelector(`[data-drag="${focusHandle}"]`)?.focus({ preventScroll: true });
}

function scrollToBoard() { $('.drawing-card').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }

function hint() {
  state.supported = true;
  state.hints++;
  let text = lesson.tip;
  if (state.phase === 'measure') {
    const t = target();
    text = state.hints === 1 ? 'The dotted side belongs to just one rectangle. Put 0 at one corner. Each space between two ruler marks is one unit.' : 'Use “Line up zero,” then move the red marker with + or − until it touches the other corner. Read the number underneath it.';
    if (state.hints > 2) text = `This ${t.axis === 'w' ? 'width' : 'height'} has ${t.length} unit spaces. Match that distance with your ruler, then record it.`;
  } else if (state.phase === 'area') {
    text = state.hints === 1 ? 'Imagine rows of unit squares. Width tells how many squares fit in each row. Height tells how many equal rows to count.' : `For rectangle A, add ${split().rects[0].w} once for each of its ${split().rects[0].h} rows. That is what ${split().rects[0].w} × ${split().rects[0].h} means.`;
  } else if (state.phase === 'total') {
    text = split().rects.length === 1 ? 'Your rectangle’s area is the whole area. Area counts squares, so choose square units.' : 'Add the colored pieces’ areas, not their side lengths. Break a two-digit addition into tens and ones if that helps.';
  } else if (state.phase === 'reason') text = 'Think about covering the inside with squares. Count every square once, leave empty space out, and use square units.';
  else if (!isRect()) text = 'Start a cut at an inside corner. Take it straight across or down until it meets an outer edge. The new pieces need four square corners.';
  $('#hint-text').textContent = text;
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.lesson !== undefined) { startLesson(Number(button.dataset.lesson), true); return; }
  if (button.dataset.split !== undefined) { state.splitIndex = Number(button.dataset.split); state.customSplit = null; state.drawnLines = []; state.cursor = null; render(); return; }
  switch (button.id) {
    case 'begin-measuring': state.hints = 0; state.work.measurements = []; state.measuring = 0; state.phase = 'measure'; resetRuler(); render(); if (window.innerWidth <= 680) scrollToBoard(); break;
    case 'grid-toggle': state.grid = !state.grid; if (lesson.independent && state.grid) state.supported = true; $('#grid-toggle').setAttribute('aria-pressed', state.grid); $('#grid-toggle span').textContent = state.grid ? 'Grid on' : 'Grid off'; renderBoard(); break;
    case 'align-ruler': { const t = target(); state.ruler.x = t.a[0]; state.ruler.y = t.a[1]; state.ruler.vertical = t.axis === 'h'; if (lesson.independent) state.supported = true; updateRuler(); renderTools(); break; }
    case 'rotate-ruler': state.ruler.vertical = !state.ruler.vertical; updateRuler(); renderTools(); break;
    case 'shorter': state.ruler.value = Math.max(0,state.ruler.value - 1); updateRuler(); break;
    case 'longer': state.ruler.value = Math.min(18,state.ruler.value + 1); updateRuler(); break;
    case 'show-splits': state.supported = true; state.showChoices = true; renderTask(); break;
    case 'clear-split': state.splitIndex = -1; state.customSplit = null; state.drawnLines = []; state.cursor = null; state.cutStart = null; render(); break;
    case 'keyboard-cut': state.cursor = [...lesson.polygon[0]]; state.cutStart = null; board.focus({ preventScroll: true }); renderBoard(); break;
    case 'hint-button': hint(); break;
    case 'restart-lesson': case 'replay': startLesson(index); break;
    case 'next-lesson': { const next = completeCount() === LESSONS.length ? 9 : index < LESSONS.length - 1 ? index + 1 : LESSONS.findIndex(item => !progress.completed[item.id]); startLesson(Math.max(0,next), true); $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'grownups': renderParent(); $('#parent-dialog').showModal(); break;
    case 'reset-progress':
      if (button.dataset.confirm !== 'true') { button.dataset.confirm = 'true'; button.textContent = 'Yes, reset all saved progress'; $('#reset-status').textContent = 'This clears this browser’s lesson completions. Click again to confirm.'; }
      else { progress = { current: 0, completed: {} }; saveProgress(); startLesson(0); renderParent(); button.textContent = 'Reset saved progress'; delete button.dataset.confirm; $('#reset-status').textContent = 'Saved progress reset. Ready for a fresh start.'; }
      break;
  }
});
document.addEventListener('submit', onSubmit);
document.addEventListener('change', event => { if (event.target.name === 'reason') { state.work.reason = Number(event.target.value); document.querySelectorAll('.choice:has(input)').forEach(label => label.classList.toggle('selected',label.querySelector('input').checked)); } });
$('.dialog-close').addEventListener('click', () => $('#parent-dialog').close());
$('#parent-dialog').addEventListener('close', () => { $('#reset-progress').textContent = 'Reset saved progress'; delete $('#reset-progress').dataset.confirm; $('#reset-status').textContent = ''; });

function renderParent() {
  const independent = LESSONS.filter(item => item.independent && progress.completed[item.id]?.independent).length;
  $('#parent-progress').innerHTML = `<div class="progress-report"><p><strong>${completeCount()} of ${LESSONS.length} lessons explored</strong></p><p>${independent} of 3 final challenges solved on their own.</p><p>${storageAvailable ? 'Lesson completions are saved. Unfinished work starts fresh when the page is reopened.' : 'Browser storage is unavailable. Progress lasts for this session only.'}</p></div>`;
}

function eventPoint(event) {
  const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(board.getScreenCTM().inverse());
  return [(point.x - layout.x) / layout.scale,(point.y - layout.y) / layout.scale];
}
function rounded(point) { return point.map(Math.round); }
function toggleCell(key) { if (state.counted.has(key)) state.counted.delete(key); else state.counted.add(key); renderBoard(); }

function finishCut(line) {
  const cuts = [...state.drawnLines,line];
  const result = splitFromCuts(lesson.polygon,cuts);
  if (!result.valid) { showFeedback('Try a straight cut all the way through a piece, from one edge to another. Start at an inside corner to make a rectangle.'); return; }
  if (cuts.length > 5 || result.rects.length > colors.length) { showFeedback('That is a lot of little pieces to measure. Clear the cuts and try a plan with six or fewer rectangles.'); return; }
  state.drawnLines = cuts;
  if (result.complete) {
    state.customSplit = { id: 'your-cut', label: 'Your plan', lines: cuts, rects: result.rects };
    state.splitIndex = lesson.splits.length;
    state.cursor = null;
    $('#feedback').textContent = '';
    renderTask();
  } else showFeedback('That cut works. Add another cut to finish making rectangles.',true);
}

board.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.pointerType !== 'touch') return;
  const cell = event.target.closest('[data-cell]');
  if (cell) return;
  const handle = event.target.closest('[data-drag]');
  const point = eventPoint(event);
  if (handle && state.phase === 'measure') {
    drag = { kind: handle.dataset.drag, start: point, ruler: { ...state.ruler } };
    board.setPointerCapture(event.pointerId);
  } else if (state.phase === 'split' && !isRect() && state.splitIndex < 0) {
    drag = { kind: 'split', start: rounded(point), end: rounded(point) };
    board.setPointerCapture(event.pointerId);
    const preview = document.createElementNS('http://www.w3.org/2000/svg','line');
    preview.id = 'drag-preview';
    preview.setAttribute('stroke','#bd8840');
    preview.setAttribute('stroke-width','3');
    preview.setAttribute('stroke-dasharray','6 4');
    preview.setAttribute('pointer-events','none');
    board.append(preview);
  }
});
board.addEventListener('pointermove', event => {
  if (!drag) return;
  const point = eventPoint(event);
  if (drag.kind === 'split') {
    drag.end = rounded(point);
    const [x1,y1] = xy(drag.start);
    const [x2,y2] = xy(drag.end);
    const preview = board.querySelector('#drag-preview');
    for (const [key,value] of Object.entries({x1,y1,x2,y2})) preview.setAttribute(key,value);
    return;
  }
  if (drag.kind === 'marker') {
    state.ruler.value = Math.max(0,Math.min(18,Math.round(state.ruler.vertical ? point[1]-state.ruler.y : point[0]-state.ruler.x)));
  } else {
    const minX = (20 - layout.x) / layout.scale;
    const maxX = (690 - layout.x) / layout.scale;
    const minY = (20 - layout.y) / layout.scale;
    const maxY = (445 - layout.y) / layout.scale;
    state.ruler.x = Math.max(minX,Math.min(maxX,drag.ruler.x + point[0]-drag.start[0]));
    state.ruler.y = Math.max(minY,Math.min(maxY,drag.ruler.y + point[1]-drag.start[1]));
  }
  updateRuler();
});
board.addEventListener('pointerup', event => {
  if (!drag) return;
  if (drag.kind === 'split') {
    finishCut([drag.start,drag.end]);
  } else {
    const t = target();
    if (Math.abs(state.ruler.x-t.a[0]) < .45) state.ruler.x = t.a[0];
    if (Math.abs(state.ruler.y-t.a[1]) < .45) state.ruler.y = t.a[1];
  }
  drag = null;
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  if (state.phase === 'split') {
    renderTools();
    requestAnimationFrame(() => { if (!drag) renderBoard(); });
  } else updateRuler();
});
board.addEventListener('pointercancel', () => { drag = null; requestAnimationFrame(() => { if (!drag) renderBoard(); }); });
board.addEventListener('click', event => { const cell = event.target.closest('[data-cell]'); if (cell) toggleCell(cell.dataset.cell); });
board.addEventListener('keydown', event => {
  if (event.target === board && state.phase === 'split' && !isRect() && state.splitIndex < 0) {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape'].includes(event.key)) return;
    event.preventDefault();
    state.cursor ??= [...lesson.polygon[0]];
    const maxX = Math.max(...lesson.polygon.map(p => p[0]));
    const maxY = Math.max(...lesson.polygon.map(p => p[1]));
    if (event.key === 'ArrowLeft') state.cursor[0] = Math.max(0,state.cursor[0]-1);
    if (event.key === 'ArrowRight') state.cursor[0] = Math.min(maxX,state.cursor[0]+1);
    if (event.key === 'ArrowUp') state.cursor[1] = Math.max(0,state.cursor[1]-1);
    if (event.key === 'ArrowDown') state.cursor[1] = Math.min(maxY,state.cursor[1]+1);
    if (event.key === 'Escape') state.cutStart = null;
    if (event.key === 'Enter') {
      if (state.cutStart) { finishCut([state.cutStart,[...state.cursor]]); state.cutStart = null; }
      else state.cutStart = [...state.cursor];
    }
    renderBoard(); renderTools(); return;
  }
  const cell = event.target.closest('[data-cell]');
  if (cell && ['Enter',' '].includes(event.key)) { event.preventDefault(); const key = cell.dataset.cell; toggleCell(key); board.querySelector(`[data-cell="${key}"]`)?.focus({ preventScroll: true }); return; }
  const handle = event.target.closest('[data-drag]');
  if (!handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (handle.dataset.drag === 'marker') state.ruler.value = Math.min(18,Math.max(0,state.ruler.value + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1)));
  else { if (event.key === 'ArrowLeft') state.ruler.x--; if (event.key === 'ArrowRight') state.ruler.x++; if (event.key === 'ArrowUp') state.ruler.y--; if (event.key === 'ArrowDown') state.ruler.y++; }
  updateRuler(handle.dataset.drag);
});

startLesson(index);
window.addEventListener('resize', () => { if (!drag) renderBoard(); });
