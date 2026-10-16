import { LESSONS } from './lessons.js';
import { checkNumber, evaluateWork, evaluateFinal, polygonArea, splitFromCuts } from './math.js';
import { mountScratchpad, normalizeStrokes } from './scratchpad.js';

const $ = (selector) => document.querySelector(selector);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const colors = ['#b5d3bb', '#f0cc82', '#e8ac98', '#b6cddd', '#d4bfdc', '#cad89a'];
const chapterNames = ['Rectangles', 'Split shapes', 'More practice', 'Independent work'];
const RULER_UNITS = 15;
const UNIT_SIZE = 28;
const BOARD_WIDTH = 900;
const BOARD_HEIGHT = 760;
const storageKey = 'kid-learning-area-v1';
let storageAvailable = true;
let progress = { current: 0, completed: {}, draft: null };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved.completed === 'object' && saved.completed !== null) {
    progress.completed = Object.fromEntries(Object.entries(saved.completed).filter(([id]) => LESSONS.some(lesson => lesson.id === id)));
    progress.current = Number.isInteger(saved.current) && LESSONS[saved.current] ? saved.current : 0;
    if (saved.draft?.lessonId === 'final-problem') progress.draft = saved.draft;
  }
} catch { storageAvailable = false; }

let index = progress.current;
let lesson, state, layout, drag, scratchpad;
const board = $('#board');
const escape = (text) => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const split = () => state.customSplit || lesson.splits[Math.max(0, state.splitIndex)];
const unit = () => `${lesson.unit}²`;
const isRect = () => lesson.polygon.length === 4;
const isFinal = () => lesson.final === true;
const completeCount = () => Object.keys(progress.completed).length;

function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); }
  catch { storageAvailable = false; }
}

function startLesson(next, focus = false) {
  scratchpad?.destroy();
  scratchpad = null;
  index = next;
  lesson = LESSONS[index];
  progress.current = index;
  state = {
    phase: isFinal() ? 'final' : 'split', splitIndex: isRect() ? 0 : -1, drawnLines: [], showChoices: !lesson.independent, customSplit: null, cursor: null, cutStart: null,
    grid: lesson.grid, counted: new Set(), measuring: 0, supported: isFinal() && progress.draft?.supported === true, hints: 0,
    work: { measurements: [], areas: [], total: '', unit: '', reason: -1 },
    ruler: { x: 0, y: 0, vertical: false, value: 2 },
    scratch: {strokes: isFinal() ? normalizeStrokes(progress.draft?.strokes) : [], text: isFinal() && typeof progress.draft?.text === 'string' ? progress.draft.text : ''},
  };
  const width = Math.max(...lesson.polygon.map(p => p[0]));
  const height = Math.max(...lesson.polygon.map(p => p[1]));
  layout = { scale: UNIT_SIZE, x: (BOARD_WIDTH-(width+RULER_UNITS)*UNIT_SIZE)/2, y: (BOARD_HEIGHT-(height+RULER_UNITS)*UNIT_SIZE)/2 };
  board.setAttribute('viewBox',`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
  if (isFinal()) {
    state.ruler.y = height+2;
    state.work.total = typeof progress.draft?.total === 'string' ? progress.draft.total : '';
    state.work.unit = typeof progress.draft?.unit === 'string' ? progress.draft.unit : '';
    const cuts = progress.draft?.cuts;
    if (Array.isArray(cuts) && cuts.length && cuts.length <= 5) {
      const result = splitFromCuts(lesson.polygon,cuts);
      if (result.valid) state.drawnLines = cuts;
      if (result.valid && result.complete && result.rects.length <= colors.length) {
        state.customSplit = {id:'your-cut',label:'Your split',lines:cuts,rects:result.rects};
        state.splitIndex = lesson.splits.length;
      }
    }
  }
  saveProgress();
  render();
  if (focus) $('#workspace').focus({ preventScroll: true });
}

function renderNav() {
  $('#lesson-nav').innerHTML = chapterNames.map((name, chapter) => `<div class="chapter"><div class="chapter-heading"><span>${chapter + 1}</span>${name}</div>${LESSONS.map((item, i) => item.chapter !== chapter ? '' : `<button class="lesson-link ${i === index ? 'active' : ''} ${progress.completed[item.id] ? 'completed' : ''}" data-lesson="${i}" ${i === index ? 'aria-current="step"' : ''} aria-label="Lesson ${i + 1}: ${escape(item.title)}${progress.completed[item.id] ? ', completed' : ''}"><span class="lesson-status">${progress.completed[item.id] ? '✓' : String(i + 1).padStart(2, '0')}</span><span class="lesson-name">${escape(item.title)}</span></button>`).join('')}</div>`).join('');
  const completed = completeCount();
  $('#progress-text').textContent = `${completed} of ${LESSONS.length} complete`;
  $('#progress-percent').textContent = `${Math.round(completed / LESSONS.length * 100)}%`;
  $('#progress-fill').style.width = `${completed / LESSONS.length * 100}%`;
}

function render() {
  renderNav();
  $('#lesson-meta').textContent = `CHAPTER ${lesson.chapter + 1} / ${chapterNames[lesson.chapter].toUpperCase()} · ${String(index + 1).padStart(2, '0')}`;
  $('#lesson-title').textContent = lesson.title;
  $('#lesson-story').textContent = lesson.story;
  $('#lesson-badge').textContent = isFinal() ? 'FINAL PROBLEM' : lesson.independent ? 'INDEPENDENT' : 'PRACTICE';
  $('#stepper').hidden = isFinal();
  $('.workbench').classList.toggle('final-workbench',isFinal());
  const current = { split: 0, measure: 1, area: 2, total: 2, reason: 3, done: 4 }[state.phase];
  $('#stepper').innerHTML = [isRect() ? 'Count' : 'Split', 'Measure', 'Calculate', 'Explain'].map((name, i) => `<li class="${i === current ? 'active' : i < current ? 'complete' : ''}" ${i === current ? 'aria-current="step"' : ''}><span>${i < current ? '✓' : i + 1}</span>${name}</li>`).join('');
  $('#model-unit').textContent = lesson.unit;
  $('#grid-toggle').setAttribute('aria-pressed', state.grid);
  $('#grid-toggle span').textContent = state.grid ? 'Grid on' : 'Grid off';
  $('#big-idea').textContent = isFinal() ? 'Use the labeled lengths to find the total area.' : state.phase === 'done' ? lesson.reason.choices.find(choice => choice.correct).feedback : lesson.tip;
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
  const taskDescription = active ? `Measure rectangle ${letters[active.pieceIndex]} ${active.axis === 'w' ? 'width' : 'height'}, from (${active.a.join(', ')}) to (${active.b.join(', ')}). Focus the ruler zero handle and use arrows to move it. Use Rotate ruler to change direction. Focus the end marker and use arrows to change its reading.` : 'To draw with keys, focus the diagram. Arrow keys move the cut cursor; Enter starts or finishes a cut; Escape cancels it.';
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
  if (['split','final'].includes(state.phase) && !isRect() && !showParts) {
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
  if (isFinal()) {
    lesson.polygon.forEach((a,i) => {
      const b = lesson.polygon[(i+1)%lesson.polygon.length];
      const length = Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]);
      const nx = (b[1]-a[1])/length;
      const ny = -(b[0]-a[0])/length;
      const mobile = window.innerWidth <= 680;
      // Separate larger phone labels from the neighboring short step labels.
      const [x,y] = xy([(a[0]+b[0])/2,mobile && nx ? Math.min(a[1],b[1])+length/8 : (a[1]+b[1])/2]);
      svg += `<text class="final-dimension" x="${x+nx*(mobile ? 12 : 18)}" y="${y+ny*(mobile ? 24 : 18)}" font-size="${mobile ? 34 : 19}" fill="#293d38" text-anchor="${nx>0 ? 'start' : nx<0 ? 'end' : 'middle'}" dominant-baseline="central">${length} ${lesson.unit}</text>`;
    });
  }
  if (active) {
    svg += lineSvg(active.a,active.b,'stroke="#d36d4e" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 9"');
    for (const p of [active.a,active.b]) { const [x,y] = xy(p); svg += `<circle cx="${x}" cy="${y}" r="7" fill="#fffef9" stroke="#cb6e50" stroke-width="2"/>`; }
    svg += rulerSvg();
  }
  else if (state.phase === 'final') svg += rulerSvg();
  if (state.phase === 'done') {
    const bottom = Math.max(...lesson.polygon.map(p => p[1]));
    const [x,y] = xy([Math.max(...lesson.polygon.map(p => p[0])) / 2,bottom + 1.8]);
    svg += `<text x="${x}" y="${Math.min(BOARD_HEIGHT-20,y)}" text-anchor="middle" font-size="24" font-weight="750" fill="#396e5c">Total area: ${polygonArea(lesson.polygon)} ${unit()}</text>`;
  }
  board.innerHTML = svg;
  if (state.phase === 'split' && isRect()) $('#board-caption').innerHTML = `<span class="count-prompt">${state.counted.size ? `${state.counted.size} ${state.counted.size === 1 ? 'square' : 'squares'} marked. Tap again to unmark.` : 'Tap the squares. Each one covers one square unit.'}</span>`;
  else if (['split','final'].includes(state.phase) && state.splitIndex < 0) $('#board-caption').textContent = state.cursor ? `Cut cursor: ${state.cursor[0]} across, ${state.cursor[1]} down. ${state.cutStart ? 'Enter to finish cut. Escape to cancel.' : 'Enter to start a cut.'}` : isFinal() ? 'All lengths are in feet. You can draw cuts on the diagram.' : 'Draw a straight cut from a corner to an opposite edge.';
  else if (active) $('#board-caption').innerHTML = `<span><i class="swatch" style="background:${colors[active.pieceIndex]}"></i>Measure rectangle ${letters[active.pieceIndex]}: <strong>${active.axis === 'w' ? 'width ↔' : 'height ↕'}</strong></span>`;
  else if (isFinal() && state.splitIndex < 0) $('#board-caption').textContent = 'All lengths are in feet.';
  else $('#board-caption').innerHTML = split().rects.map((rect,i) => `<span><i class="swatch" style="background:${colors[i]}"></i>Rectangle ${letters[i]}</span>`).join('<span aria-hidden="true"> · </span>');
}

function rulerSvg() {
  const { x, y, vertical, value } = state.ruler;
  const s = layout.scale;
  const [px, py] = xy([x,y]);
  const length = RULER_UNITS;
  const width = length * s;
  const mobile = window.innerWidth <= 680;
  const height = mobile ? 80 : 44;
  const direction = vertical ? -1 : 1;
  const positionLabel = `Zero at ${Number(x.toFixed(1))} across, ${Number(y.toFixed(1))} down. ${vertical ? 'Vertical' : 'Horizontal'}. Use arrow keys to move one unit.`;
  let svg = `<g data-ruler transform="translate(${px} ${py}) rotate(${vertical ? 90 : 0})"><g class="ruler-body" data-drag="body" tabindex="0" role="button" aria-label="Move ruler. ${positionLabel}"><rect data-ruler-bar x="-14" y="${vertical ? -height-3 : 0}" width="${width + 28}" height="${height + 3}" rx="5" fill="#d3a343" opacity=".22" transform="translate(0 ${direction*4})"/><rect data-ruler-bar x="-14" y="${vertical ? -height : 0}" width="${width + 28}" height="${height}" rx="5" fill="#f4d984" fill-opacity=".94" stroke="#b89648" stroke-width="1.2"/>`;
  for (let i = 0; i <= length; i++) {
    svg += `<g data-tick="${i}"><path d="M ${i*s} 0 v${direction*(mobile ? 23 : 14)}" stroke="#8b7036" stroke-width="1.3"/><text x="${i*s}" y="${direction*(mobile ? 56 : 32)}" text-anchor="middle" font-size="${mobile ? 24 : 18}" font-weight="700" fill="#755d2b">${i}</text></g>`;
  }
  svg += `</g><g data-drag="zero" class="ruler-body" tabindex="0" role="button" aria-label="Ruler zero handle. ${positionLabel}"><circle cx="0" cy="0" r="${mobile ? 56 : 24}" fill="transparent"/><circle cx="0" cy="0" r="${mobile ? 10 : 7}" fill="#fffdf1" stroke="#9d7b2d" stroke-width="2"/></g><g data-drag="marker" data-base-value="${value}" class="ruler-marker" tabindex="0" role="slider" aria-label="Ruler end marker" aria-orientation="${vertical ? 'vertical' : 'horizontal'}" aria-valuemin="0" aria-valuemax="${RULER_UNITS}" aria-valuenow="${value}" aria-valuetext="${value} ${lesson.unit}"><rect x="${value*s-(mobile ? 56 : 24)}" y="${vertical ? (mobile ? -144 : -height-18) : (mobile ? 32 : -24)}" width="${mobile ? 112 : 48}" height="${mobile ? 112 : height+42}" fill="transparent"/><path d="M ${value*s} ${-17*direction} v${direction*(height+25)}" stroke="#b35e43" stroke-width="2.5"/><path d="M ${value*s-8} ${-21*direction} h16 l-8 ${12*direction} Z" fill="#b35e43"/><circle cx="${value*s}" cy="${direction*(height+8)}" r="${mobile ? 9 : 6}" fill="#b35e43"/></g></g>`;
  return svg;
}

function renderTools() {
  if (['measure','final'].includes(state.phase)) {
    $('#toolbox').innerHTML = `<div class="tool-group">${state.phase === 'measure' ? '<button id="align-ruler" title="Place zero at the start of this side">⌖ Line up zero</button>' : ''}<button id="rotate-ruler" class="rotate-control" aria-label="Rotate ruler ${state.ruler.vertical ? 'horizontal' : 'vertical'}"><span class="rotate-icon" aria-hidden="true">${state.ruler.vertical ? '↕ → ↔' : '↔ → ↕'}</span> Rotate ${state.ruler.vertical ? 'horizontal' : 'vertical'}</button></div><div class="tool-group ruler-reading"><button id="shorter" aria-label="Move ruler marker back one unit">−</button><output id="ruler-value" aria-live="off">${state.ruler.value} ${lesson.unit}</output><button id="longer" aria-label="Move ruler marker forward one unit">+</button></div>${state.phase === 'final' ? `<div class="tool-group">${state.splitIndex < 0 ? '<button id="keyboard-cut">Draw cuts with keys</button>' : ''}<button id="clear-split">Clear cuts</button></div>` : ''}`;
  } else if (state.phase === 'split' && !isRect()) {
    $('#toolbox').innerHTML = `<span class="small-tool-note">${state.splitIndex < 0 ? `${state.drawnLines.length ? state.drawnLines.length + ' cut drawn. Add the remaining cuts.' : 'Drag a cut, or use arrow keys + Enter.'}` : `${split().rects.length} rectangles.`}</span><div class="tool-group">${state.splitIndex < 0 ? '<button id="keyboard-cut">⌨ Draw with keys</button>' : ''}<button id="clear-split">↺ Clear cuts</button></div>`;
  } else {
    $('#toolbox').innerHTML = `<span class="small-tool-note">${state.phase === 'split' ? 'Count the squares by rows.' : state.phase === 'done' ? 'A complete answer includes square units.' : 'Your measurements are marked on the shape.'}</span>`;
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
  if (scratchpad) {
    state.scratch.strokes = scratchpad.getStrokes();
    state.scratch.text = $('#scratch-text')?.value || '';
    state.work.total = $('#final-answer')?.value ?? state.work.total;
    state.work.unit = $('#final-unit')?.value ?? state.work.unit;
    scratchpad.destroy();
    scratchpad = null;
  }
  const phase = state.phase;
  $('#note-count').textContent = phase === 'done' ? 'COMPLETE' : isFinal() ? 'FINAL' : `${Math.min(4, { split: 1, measure: 2, area: 3, total: 3, reason: 4 }[phase])} / 4`;
  let html = '';
  if (isFinal()) {
    html = `<h3 id="notebook-title">Show your work.</h3><p class="task-description">Find the total area. Draw or type your calculations, then enter your answer.</p><div id="scratchpad"><div class="scratch-toolbar" role="group" aria-label="Drawing tools"><button type="button" data-scratch-action="pen" aria-pressed="true">Pen</button><button type="button" data-scratch-action="eraser" aria-pressed="false">Eraser</button><button type="button" data-scratch-action="undo">Undo</button><button type="button" data-scratch-action="clear">Clear drawing</button></div><canvas id="scratch-canvas" tabindex="0" aria-label="Scratchpad. Draw your calculations here.">Type your calculations in the work box below.</canvas><label class="field-label scratch-text-label" for="scratch-text">Or type your calculations</label><textarea id="scratch-text" rows="4" spellcheck="false">${escape(state.scratch.text)}</textarea></div>`;
    if (phase === 'done') html += `<div class="final-result" role="status"><strong>Answer correct: ${state.work.total} ${unit()}</strong><p>Review the written work with a parent or teacher.</p></div><button id="next-lesson" class="primary-button">${completeCount() === LESSONS.length ? 'Practice again' : 'Next lesson'} <span>→</span></button><button id="replay" class="text-button full-width">Clear this problem and start again</button>`;
    else html += `<form id="final-form"><label class="field-label" for="final-answer">Final answer</label><div class="final-answer-row"><input id="final-answer" class="answer-input" type="text" inputmode="numeric" autocomplete="off" value="${escape(state.work.total)}" aria-describedby="feedback"><select id="final-unit" class="unit-select" aria-label="Answer units"><option value="">Units</option><option value="${lesson.unit}" ${state.work.unit === lesson.unit ? 'selected' : ''}>${lesson.unit}</option><option value="${unit()}" ${state.work.unit === unit() ? 'selected' : ''}>${unit()}</option></select></div><button class="primary-button" type="submit">Check answer</button></form><p class="saved-note">${storageAvailable ? "Your work is saved on this device." : "Work cannot be saved in this browser. Keep this page open to continue."}</p>`;
    $('#task-panel').innerHTML = html;
    scratchpad = mountScratchpad($('#scratchpad'),{strokes:state.scratch.strokes,onChange(strokes){state.scratch.strokes=strokes;saveFinalDraft();}});
    return;
  }
  if (phase === 'split') {
    if (isRect()) {
      const rect = split().rects[0];
      const countButtons = Array.from({length:rect.w*rect.h},(_,i) => {
        const x = i%rect.w, y = Math.floor(i/rect.w), key = `${x}-${y}`;
        return `<button type="button" data-count-cell="${key}" aria-pressed="${state.counted.has(key)}" aria-label="Square in row ${y+1}, column ${x+1}">${state.counted.has(key) ? '✓' : ''}</button>`;
      }).join('');
      html = `<h3 id="notebook-title">${index === 0 ? 'Count square units.' : 'Count the rows.'}</h3><p class="task-description">${index === 0 ? 'A square that is 1 cm wide and 1 cm tall covers 1 square centimeter. Tap each square to count it.' : 'The squares fit together with no gaps. Each row has the same number of squares. Multiply the number of rows by the squares in each row.'}</p><div class="phone-counting"><div class="counting-grid" role="group" aria-label="Tap squares to count them" style="grid-template-columns:repeat(${rect.w},44px)">${countButtons}</div><p class="small-tool-note counting-total">${state.counted.size} of ${rect.w*rect.h} squares marked.</p></div><div class="unit-square-demo"><div></div><span>1 ${lesson.unit} × 1 ${lesson.unit}<br><strong>1 ${unit()}</strong></span></div><p class="small-tip">Area tells us how much space is <strong>inside</strong> a shape.</p><button id="begin-measuring" class="primary-button">Measure the sides <span>→</span></button>`;
    } else {
      html = `<h3 id="notebook-title">Split into rectangles.</h3><p class="task-description">${lesson.independent ? 'Draw a straight cut from a corner to an edge. Make rectangles that cover the whole shape, with no gaps or overlaps.' : 'Draw a cut across the shape, or choose a plan below. Each colored piece should be a rectangle.'}</p>`;
      if (state.showChoices) html += `<div class="choice-list">${lesson.splits.map((plan,i) => `<button class="choice split-choice ${state.splitIndex === i ? 'selected' : ''}" data-split="${i}" aria-pressed="${state.splitIndex === i}"><span class="split-name"><span>${state.splitIndex === i ? '◉' : '○'}</span>${escape(plan.label)}</span>${splitIcon(plan)}</button>`).join('')}</div>`;
      else html += `<button id="show-splits" class="secondary-button full-width">Help me choose a split</button>`;
      html += `<p class="small-tip">${state.splitIndex >= 0 ? `${split().rects.length} rectangles cover the shape exactly once. Now measure each rectangle’s own sides.` : 'The line should cut through the inside. An outside edge does not make a new piece.'}</p><button id="begin-measuring" class="primary-button" ${state.splitIndex < 0 ? 'disabled' : ''}>Measure these rectangles <span>→</span></button>`;
    }
  }
  if (phase === 'measure') {
    const t = target();
    html = `<span class="part-badge"><i class="swatch" style="background:${colors[t.pieceIndex]}"></i>RECTANGLE ${letters[t.pieceIndex]} · ${state.measuring + 1} OF ${split().rects.length * 2} SIDES</span><h3 id="notebook-title">Measure the ${t.axis === 'w' ? 'width' : 'height'}.</h3><p class="task-description">Move the ruler’s <strong>0</strong> to one end of the dotted side. Slide the red marker to the other end. Read the ruler and write the length.</p><form id="measurement-form"><label class="field-label" for="length-answer">${t.axis === 'w' ? 'Width' : 'Height'} of rectangle ${letters[t.pieceIndex]}</label><div class="input-row"><input id="length-answer" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" aria-describedby="feedback"><span class="input-unit">${lesson.unit}</span></div><button class="primary-button" type="submit">Record length <span>↗</span></button></form>${measurementLog()}<p class="saved-note">Tip: “Line up zero” places the ruler. The − and + buttons move its red marker.</p>`;
  }
  if (phase === 'area') {
    html = `<h3 id="notebook-title">Calculate the area.</h3><p class="task-description">${split().rects.length === 1 ? 'You know the width and height. Multiply them to count all the squares inside.' : 'Use each rectangle’s own measurements. Multiply width × height to find its area.'}</p><form id="area-form">${split().rects.map((rect,i) => `<div class="area-row"><label for="area-${i}"><i class="swatch" style="background:${colors[i]}"></i>Rectangle ${letters[i]}</label><div class="equation"><span>${state.work.measurements[i].w}</span><span class="operator">×</span><span>${state.work.measurements[i].h}</span><span class="operator">=</span><input id="area-${i}" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" value="${escape(state.work.areas[i] || '')}" aria-label="Area of rectangle ${letters[i]}" aria-describedby="feedback"><span class="area-unit">${unit()}</span></div>${index < 3 ? `<p class="equation-note">${rect.h} rows, with ${rect.w} squares in each row.</p>` : ''}</div>`).join('')}<button type="submit" class="primary-button">Check my ${split().rects.length === 1 ? 'area' : 'rectangle areas'} <span>→</span></button></form>`;
  }
  if (phase === 'total') {
    html = `<h3 id="notebook-title">${split().rects.length > 1 ? 'Add the areas.' : 'Write the total area.'}</h3><p class="task-description">${split().rects.length > 1 ? 'Each part is measured in square units. Add the part areas to find the area of the whole shape.' : 'One rectangle makes the whole shape. Write its area and choose the unit that tells what you counted.'}</p><div class="sum-block">${state.work.areas.join(' <span class="operator">+</span> ')} = ?</div><form id="total-form"><label class="field-label" for="total-answer">Total area</label><div class="input-row"><input id="total-answer" class="answer-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" value="${escape(state.work.total)}" aria-describedby="feedback"></div><label class="field-label" for="unit-answer">Answer units</label><select id="unit-answer" class="unit-select"><option value="">Choose the unit</option><option value="${lesson.unit}" ${state.work.unit === lesson.unit ? 'selected' : ''}>${lesson.unit === 'cm' ? 'Centimeters (cm)' : 'Feet (ft)'}</option><option value="${unit()}" ${state.work.unit === unit() ? 'selected' : ''}>${lesson.unit === 'cm' ? 'Square centimeters (cm²)' : 'Square feet (ft²)'}</option></select><button type="submit" class="primary-button">Check answer <span>→</span></button></form>`;
  }
  if (phase === 'reason') {
    html = `<h3 id="notebook-title">Explain your answer.</h3><p class="task-description">${escape(lesson.reason.question)}</p><form id="reason-form"><fieldset class="reason-fieldset"><legend class="sr-only">Choose an explanation</legend><div class="choice-list">${lesson.reason.choices.map((choice,i) => `<label class="choice ${state.work.reason === i ? 'selected' : ''}"><input type="radio" name="reason" value="${i}" ${state.work.reason === i ? 'checked' : ''}><span>${escape(choice.text)}</span></label>`).join('')}</div></fieldset><button type="submit" class="primary-button">Check explanation <span>→</span></button></form>`;
  }
  if (phase === 'done') {
    const allDone = completeCount() === LESSONS.length;
    html = `${lesson.independent ? `<div class="support-tag">${state.supported ? 'COMPLETED WITH HELP' : 'COMPLETED WITHOUT HELP'}</div>` : ''}<h3 id="notebook-title">${allDone ? 'All lessons complete.' : 'Lesson complete.'}</h3><p class="task-description">${state.supported ? 'You completed this lesson with help or corrections.' : 'Your measurements, calculations, and answer are correct.'}</p><div class="completion-equation">${state.work.areas.join(' + ')}${state.work.areas.length > 1 ? ` = ${state.work.total}` : ''} ${unit()}</div><ul class="completed-checklist"><li>Every part counted once</li><li>Each rectangle’s area found</li><li>A total with square units</li><li>Explanation checked</li></ul><button id="next-lesson" class="primary-button">${allDone ? 'Practice again' : 'Next lesson'} <span>→</span></button><button id="replay" class="text-button full-width">${isRect() ? 'Practice again' : 'Try a different split'}</button><p class="saved-note">${storageAvailable ? 'Your progress is saved on this device.' : 'Progress could not be saved in this browser. You can continue in this session.'}${allDone ? ' Try again another day to see what you remember.' : ''}</p>`;
  }
  $('#task-panel').innerHTML = html;
}

function resetRuler() {
  const t = target();
  state.ruler = { x: t.a[0], y: t.a[1]+2, vertical: false, value: 2 };
  fitRuler();
}

function fitRuler() {
  const r = state.ruler;
  const height = window.innerWidth <= 680 ? 80 : 44;
  const px = layout.x+r.x*layout.scale;
  const py = layout.y+r.y*layout.scale;
  const minX = 25;
  const maxX = r.vertical ? BOARD_WIDTH-(window.innerWidth<=680 ? 144 : height+32)-25 : BOARD_WIDTH-RULER_UNITS*UNIT_SIZE-25;
  const minY = 25;
  const maxY = r.vertical ? BOARD_HEIGHT-RULER_UNITS*UNIT_SIZE-25 : BOARD_HEIGHT-(window.innerWidth<=680 ? 144 : height+32)-25;
  r.x = (Math.max(minX,Math.min(maxX,px))-layout.x)/layout.scale;
  r.y = (Math.max(minY,Math.min(maxY,py))-layout.y)/layout.scale;
}

function saveFinalDraft() {
  if (!isFinal()) return;
  progress.draft = {lessonId:lesson.id,strokes:state.scratch.strokes,text:state.scratch.text,total:state.work.total,unit:state.work.unit,supported:state.supported,cuts:state.drawnLines};
  saveProgress();
}

function completeLesson() {
  const previous = progress.completed[lesson.id];
  progress.completed[lesson.id] = {independent:Boolean(previous?.independent || (lesson.independent && !state.supported)),completedAt:new Date().toISOString(),finalWork:isFinal()};
  saveProgress();
  continuePhase('done');
}

function showFeedback(message, success = false) {
  $('#feedback').textContent = message;
  $('#feedback').className = success ? 'success' : '';
  if (!success) {state.supported = true;saveFinalDraft();}
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
  if (!['measurement-form', 'area-form', 'total-form', 'reason-form','final-form'].includes(form.id)) return;
  event.preventDefault();
  if (form.id === 'final-form') {
    state.scratch.text = $('#scratch-text').value;
    state.work.total = $('#final-answer').value.trim();
    state.work.unit = $('#final-unit').value;
    saveFinalDraft();
    const result = evaluateFinal(lesson,{...state.work,hasWork:state.scratch.text.trim().length>0 || scratchpad.hasInk()});
    if (!result.correct) {showFeedback(result.errors[0].message);return;}
    state.work.total = String(Number(state.work.total));
    completeLesson();
    return;
  }
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
    completeLesson();
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
  saveFinalDraft();
  state.hints++;
  let text = lesson.tip;
  if (state.phase === 'measure') {
    const t = target();
    text = state.hints === 1 ? 'The dotted side belongs to just one rectangle. Put 0 at one corner. Each space between two ruler marks is one unit.' : 'Use “Line up zero,” then move the red marker with + or − until it touches the other corner. Read the number at the marker.';
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
  if (button.dataset.countCell !== undefined) {toggleCell(button.dataset.countCell);return;}
  if (button.dataset.lesson !== undefined) { startLesson(Number(button.dataset.lesson), true); return; }
  if (button.dataset.split !== undefined) { state.splitIndex = Number(button.dataset.split); state.customSplit = null; state.drawnLines = []; state.cursor = null; render(); return; }
  switch (button.id) {
    case 'begin-measuring': state.hints = 0; state.work.measurements = []; state.measuring = 0; state.phase = 'measure'; resetRuler(); render(); if (window.innerWidth <= 680) scrollToBoard(); break;
    case 'grid-toggle': state.grid = !state.grid; if (lesson.independent && state.grid) state.supported = true; saveFinalDraft(); $('#grid-toggle').setAttribute('aria-pressed', state.grid); $('#grid-toggle span').textContent = state.grid ? 'Grid on' : 'Grid off'; renderBoard(); break;
    case 'align-ruler': { const t = target(); state.ruler.x = t.a[0]; state.ruler.y = t.a[1]; state.ruler.vertical = t.axis === 'h'; if (lesson.independent) state.supported = true; renderBoard(); renderTools(); break; }
    case 'rotate-ruler': state.ruler.vertical = !state.ruler.vertical; fitRuler(); renderBoard(); renderTools(); break;
    case 'shorter': state.ruler.value = Math.max(0,state.ruler.value - 1); updateRuler(); break;
    case 'longer': state.ruler.value = Math.min(RULER_UNITS,state.ruler.value + 1); updateRuler(); break;
    case 'show-splits': state.supported = true; state.showChoices = true; renderTask(); break;
    case 'clear-split': state.splitIndex = -1; state.customSplit = null; state.drawnLines = []; state.cursor = null; state.cutStart = null; saveFinalDraft(); render(); break;
    case 'keyboard-cut': state.cursor = [...lesson.polygon[0]]; state.cutStart = null; board.focus({ preventScroll: true }); renderBoard(); break;
    case 'hint-button': hint(); break;
    case 'restart-lesson': case 'replay': if(isFinal()) {progress.draft=null;saveProgress();} startLesson(index); break;
    case 'next-lesson': { const next = completeCount() === LESSONS.length ? 9 : index < LESSONS.length - 1 ? index + 1 : LESSONS.findIndex(item => !progress.completed[item.id]); startLesson(Math.max(0,next), true); $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'grownups': renderParent(); $('#parent-dialog').showModal(); break;
    case 'reset-progress':
      if (button.dataset.confirm !== 'true') { button.dataset.confirm = 'true'; button.textContent = 'Yes, reset all saved progress'; $('#reset-status').textContent = 'This clears this browser’s lesson completions. Click again to confirm.'; }
      else { progress = { current: 0, completed: {} }; saveProgress(); startLesson(0); renderParent(); button.textContent = 'Reset saved progress'; delete button.dataset.confirm; $('#reset-status').textContent = 'Saved progress reset.'; }
      break;
  }
});
document.addEventListener('submit', onSubmit);
document.addEventListener('input',event => {
  if (!isFinal()) return;
  if (event.target.id === 'scratch-text') state.scratch.text=event.target.value;
  if (event.target.id === 'final-answer') state.work.total=event.target.value;
  if (['scratch-text','final-answer'].includes(event.target.id)) saveFinalDraft();
});
document.addEventListener('change',event => {if(isFinal() && event.target.id==='final-unit'){state.work.unit=event.target.value;saveFinalDraft();}});
document.addEventListener('change', event => { if (event.target.name === 'reason') { state.work.reason = Number(event.target.value); document.querySelectorAll('.choice:has(input)').forEach(label => label.classList.toggle('selected',label.querySelector('input').checked)); } });
$('.dialog-close').addEventListener('click', () => $('#parent-dialog').close());
$('#parent-dialog').addEventListener('close', () => { $('#reset-progress').textContent = 'Reset saved progress'; delete $('#reset-progress').dataset.confirm; $('#reset-status').textContent = ''; });

function renderParent() {
  const independentLessons = LESSONS.filter(item => item.independent);
  const independent = independentLessons.filter(item => progress.completed[item.id]?.independent).length;
  $('#parent-progress').innerHTML = `<div class="progress-report"><p><strong>${completeCount()} of ${LESSONS.length} lessons complete</strong></p><p>${independent} of ${independentLessons.length} independent problems completed without help.</p><p>${storageAvailable ? 'Lesson completions and the final problem’s scratchpad are saved on this device. Other unfinished lessons start fresh.' : 'Browser storage is unavailable. Progress lasts for this session only.'}</p></div>`;
}

function eventPoint(event) {
  const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(board.getScreenCTM().inverse());
  return [(point.x - layout.x) / layout.scale,(point.y - layout.y) / layout.scale];
}
function rounded(point) { return point.map(Math.round); }
function toggleCell(key) {
  if (state.counted.has(key)) state.counted.delete(key); else state.counted.add(key);
  renderBoard();
  for (const button of document.querySelectorAll('[data-count-cell]')) {
    const marked = state.counted.has(button.dataset.countCell);
    button.setAttribute('aria-pressed',marked);
    button.textContent = marked ? '✓' : '';
  }
  if ($('.counting-total')) $('.counting-total').textContent = `${state.counted.size} of ${split().rects[0].w*split().rects[0].h} squares marked.`;
}

function finishCut(line) {
  const cuts = [...state.drawnLines,line];
  const result = splitFromCuts(lesson.polygon,cuts);
  if (!result.valid) { showFeedback('Try a straight cut all the way through a piece, from one edge to another. Start at an inside corner to make a rectangle.'); return; }
  if (cuts.length > 5 || result.rects.length > colors.length) { showFeedback('Use six or fewer rectangles. Clear the cuts and try again.'); return; }
  state.drawnLines = cuts;
  saveFinalDraft();
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
  if (handle && ['measure','final'].includes(state.phase)) {
    drag = { kind: handle.dataset.drag, start: point, ruler: { ...state.ruler } };
    board.setPointerCapture(event.pointerId);
  } else if (['split','final'].includes(state.phase) && !isRect() && state.splitIndex < 0) {
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
    state.ruler.value = Math.max(0,Math.min(RULER_UNITS,Math.round(state.ruler.vertical ? point[1]-state.ruler.y : point[0]-state.ruler.x)));
  } else {
    state.ruler.x = drag.ruler.x + point[0]-drag.start[0];
    state.ruler.y = drag.ruler.y + point[1]-drag.start[1];
    fitRuler();
  }
  updateRuler();
});
board.addEventListener('pointerup', event => {
  if (!drag) return;
  if (drag.kind === 'split') {
    finishCut([drag.start,drag.end]);
  } else {
    const t = state.phase === 'measure' ? target() : null;
    if (t && Math.abs(state.ruler.x-t.a[0]) < .45) state.ruler.x = t.a[0];
    if (t && Math.abs(state.ruler.y-t.a[1]) < .45) state.ruler.y = t.a[1];
  }
  drag = null;
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  if (['split','final'].includes(state.phase)) {
    renderTools();
    requestAnimationFrame(() => { if (!drag) renderBoard(); });
  } else updateRuler();
});
board.addEventListener('pointercancel', () => { drag = null; requestAnimationFrame(() => { if (!drag) renderBoard(); }); });
board.addEventListener('click', event => { const cell = event.target.closest('[data-cell]'); if (cell) toggleCell(cell.dataset.cell); });
board.addEventListener('keydown', event => {
  if (event.target === board && ['split','final'].includes(state.phase) && !isRect() && state.splitIndex < 0) {
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
  if (handle.dataset.drag === 'marker') state.ruler.value = Math.min(RULER_UNITS,Math.max(0,state.ruler.value + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1)));
  else { if (event.key === 'ArrowLeft') state.ruler.x--; if (event.key === 'ArrowRight') state.ruler.x++; if (event.key === 'ArrowUp') state.ruler.y--; if (event.key === 'ArrowDown') state.ruler.y++; fitRuler(); }
  updateRuler(handle.dataset.drag);
});

startLesson(index);
window.addEventListener('resize', () => { if (!drag) renderBoard(); });
