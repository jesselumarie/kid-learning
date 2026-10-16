import test from 'node:test';
import assert from 'node:assert/strict';
import { mountScratchpad, normalizeStrokes, hasScratchInk } from '../site/scratchpad.js';

function fixture() {
  const targets = new Map();
  const bounds = { left: 20, top: 40, width: 400, height: 200 };
  const context = { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {} };
  const canvas = {
    width: 0, height: 0, ownerDocument: { activeElement: null },
    getContext: () => context,
    getBoundingClientRect: () => bounds,
    setPointerCapture(id) { this.captured = id; },
    hasPointerCapture(id) { return this.captured === id; },
    releasePointerCapture() { this.captured = null; },
    focus() { this.ownerDocument.activeElement = this; },
    addEventListener(type, callback) { targets.set(`canvas:${type}`, callback); },
    removeEventListener(type) { targets.delete(`canvas:${type}`); },
    setAttribute() {},
  };
  const buttons = Object.fromEntries(['pen', 'eraser', 'undo', 'clear'].map(action => [action, {
    dataset: { scratchAction: action }, disabled: false,
    addEventListener(type, callback) { targets.set(`${action}:${type}`, callback); },
    removeEventListener(type) { targets.delete(`${action}:${type}`); },
    setAttribute(name, value) { this[name] = value; },
  }]));
  const container = {
    querySelector: selector => selector === '#scratch-canvas' ? canvas : null,
    querySelectorAll: () => Object.values(buttons),
  };
  const pointer = (type, x, y, pointerId = 1) => targets.get(`canvas:${type}`)?.({ clientX: x, clientY: y, pointerId, button: 0, preventDefault() {} });
  return { container, canvas, context, bounds, buttons, targets, pointer, click: action => targets.get(`${action}:click`)?.() };
}

test('scratch work records normalized coordinates and preserves a drawing across remounts', () => {
  const view = fixture();
  const changes = [];
  const pad = mountScratchpad(view.container, { onChange: strokes => changes.push(strokes) });
  view.pointer('pointerdown', 60, 60);
  view.pointer('pointermove', 220, 140);
  view.pointer('pointerup', 380, 220);
  const drawing = [{ points: [{ x: .1, y: .1 }, { x: .5, y: .5 }, { x: .9, y: .9 }], eraser: false }];
  assert.deepEqual(pad.getStrokes(), drawing);
  assert.equal(pad.hasInk(), true);
  assert.equal(changes.length, 1);
  pad.getStrokes()[0].points[0].x = .8;
  assert.deepEqual(pad.getStrokes(), drawing, 'callers cannot mutate saved drawing state');
  const restored = mountScratchpad(fixture().container, { strokes: pad.getStrokes() });
  assert.deepEqual(restored.getStrokes(), drawing);
  pad.destroy();
  assert.equal(view.targets.size, 0);
});

test('eraser, undo, and clear preserve predictable drawing history', () => {
  const view = fixture();
  const pad = mountScratchpad(view.container);
  view.pointer('pointerdown', 20, 40);
  view.pointer('pointerup', 420, 240);
  view.click('eraser');
  assert.equal(view.buttons.eraser['aria-pressed'], 'true');
  view.pointer('pointerdown', 120, 90);
  view.pointer('pointerup', 180, 110);
  assert.equal(pad.getStrokes()[1].eraser, true);
  view.click('undo');
  assert.equal(pad.getStrokes().length, 1);
  assert.equal(pad.getStrokes()[0].eraser, false);
  view.click('clear');
  assert.deepEqual(pad.getStrokes(), []);
  assert.equal(pad.hasInk(), false);
  assert.equal(view.buttons.undo.disabled, true);
});

test('cancelled gestures and another finger do not add unexpected work', () => {
  const view = fixture();
  const pad = mountScratchpad(view.container);
  view.pointer('pointerdown', 60, 60);
  view.pointer('pointerdown', 120, 90, 2);
  view.pointer('pointermove', 200, 140, 2);
  view.pointer('pointerup', 240, 170, 2);
  view.pointer('pointercancel', 60, 60);
  assert.deepEqual(pad.getStrokes(), []);
  view.pointer('pointerdown', 60, 60);
  view.pointer('pointerup', 60, 60);
  assert.equal(pad.hasInk(), false, 'one tap does not count as written work');
});

test('keyboard undo is scoped to the focused canvas', () => {
  const view = fixture();
  const pad = mountScratchpad(view.container);
  view.pointer('pointerdown', 60, 60);
  view.pointer('pointerup', 220, 140);
  const key = view.targets.get('canvas:keydown');
  let prevented = 0;
  view.canvas.ownerDocument.activeElement = {};
  key({ key: 'z', ctrlKey: true, preventDefault() { prevented++; } });
  assert.equal(pad.getStrokes().length, 1);
  view.canvas.focus();
  key({ key: 'z', metaKey: true, preventDefault() { prevented++; } });
  assert.equal(pad.getStrokes().length, 0);
  assert.equal(prevented, 1);
});

test('restored work must contain a real pen stroke and valid points', () => {
  assert.deepEqual(normalizeStrokes(null), []);
  assert.deepEqual(normalizeStrokes([{ points: [{ x: 0, y: 0 }, { x: Infinity, y: 0 }] }]), []);
  assert.equal(hasScratchInk([{ eraser: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]), false);
  assert.equal(hasScratchInk([{ eraser: false, points: [{ x: .5, y: .5 }, { x: .5, y: .5 }] }]), false);
  assert.deepEqual(normalizeStrokes([{ points: [{ x: -1, y: .5 }, { x: 3, y: .5 }] }]), [{ points: [{ x: 0, y: .5 }, { x: 1, y: .5 }], eraser: false }]);
});

test('resizing preserves normalized work and uses the display pixel ratio', () => {
  const previousObserver = globalThis.ResizeObserver;
  const previousRatio = globalThis.devicePixelRatio;
  let resize, disconnected = false;
  globalThis.devicePixelRatio = 2;
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  try {
    const view = fixture();
    const strokes = [{ points: [{ x: .1, y: .1 }, { x: .9, y: .9 }], eraser: false }];
    const pad = mountScratchpad(view.container, { strokes });
    assert.deepEqual([view.canvas.width, view.canvas.height], [800, 400]);
    view.bounds.width = 200;
    resize();
    assert.deepEqual([view.canvas.width, view.canvas.height], [400, 400]);
    assert.deepEqual(pad.getStrokes(), strokes);
    pad.destroy();
    assert.equal(disconnected, true);
  } finally {
    if (previousObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previousObserver;
    if (previousRatio === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previousRatio;
  }
});

test('erasing every visible pixel does not count as written work', () => {
  const view = fixture();
  const pad = mountScratchpad(view.container, { strokes: [{ points: [{ x: .1, y: .1 }, { x: .9, y: .9 }], eraser: false }] });
  view.context.getImageData = () => ({ data: Uint8ClampedArray.from([0, 0, 0, 255]) });
  assert.equal(pad.hasInk(), true);
  view.context.getImageData = () => ({ data: Uint8ClampedArray.from([0, 0, 0, 0]) });
  assert.equal(pad.hasInk(), false);
});
