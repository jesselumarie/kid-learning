// Coordinates stay relative to the page so work survives a canvas resize.
export function normalizeStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  return strokes.flatMap(stroke => {
    if (!Array.isArray(stroke?.points) || !stroke.points.length || stroke.points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) return [];
    return [{
      points: stroke.points.map(({ x, y }) => ({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) })),
      eraser: stroke.eraser === true,
    }];
  });
}

export function hasScratchInk(strokes) {
  return normalizeStrokes(strokes).some(stroke => !stroke.eraser && stroke.points.some(point => point.x !== stroke.points[0].x || point.y !== stroke.points[0].y));
}

export function mountScratchpad(container, { strokes = [], onChange = () => {} } = {}) {
  const canvas = container.querySelector('#scratch-canvas');
  const context = canvas.getContext('2d');
  const buttons = [...container.querySelectorAll('[data-scratch-action]')];
  let history = normalizeStrokes(strokes);
  let active = null;
  let eraser = false;
  let width = 0;
  let height = 0;
  const removers = [];

  function listen(element, event, callback) {
    element.addEventListener(event, callback);
    removers.push(() => element.removeEventListener(event, callback));
  }

  function drawStroke(stroke) {
    const points = stroke.points.map(point => ({ x: point.x * width, y: point.y * height }));
    const brush = Math.max(stroke.eraser ? 16 : 2, Math.min(width, height) * (stroke.eraser ? .06 : .008));
    context.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    context.strokeStyle = context.fillStyle = '#243f38';
    context.lineWidth = brush;
    context.lineCap = context.lineJoin = 'round';
    context.beginPath();
    if (points.length === 1) {
      context.arc(points[0].x, points[0].y, brush / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }

  function redraw() {
    context.clearRect(0, 0, width, height);
    for (const stroke of history) drawStroke(stroke);
    if (active) drawStroke(active.stroke);
    context.globalCompositeOperation = 'source-over';
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    width = bounds.width;
    height = bounds.height;
    const ratio = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function updateButtons() {
    for (const button of buttons) {
      const action = button.dataset.scratchAction;
      if (action === 'pen' || action === 'eraser') button.setAttribute('aria-pressed', String(action === (eraser ? 'eraser' : 'pen')));
      if (action === 'undo' || action === 'clear') button.disabled = history.length === 0;
    }
    canvas.setAttribute('aria-label', `Scratch paper. ${eraser ? 'Eraser' : 'Pen'} selected. Draw your calculations here, or type them in the work box.`);
  }

  function changed() {
    redraw();
    updateButtons();
    onChange(normalizeStrokes(history));
  }

  function undo() {
    if (!history.length) return;
    history.pop();
    changed();
  }

  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) };
  }

  function addPoint(event) {
    const next = point(event);
    const previous = active.stroke.points.at(-1);
    if (next.x !== previous.x || next.y !== previous.y) active.stroke.points.push(next);
  }

  listen(canvas, 'pointerdown', event => {
    if (active || event.button !== 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    active = { id: event.pointerId, stroke: { points: [point(event)], eraser } };
    redraw();
  });
  listen(canvas, 'pointermove', event => {
    if (active?.id !== event.pointerId) return;
    event.preventDefault();
    for (const sample of event.getCoalescedEvents?.() || [event]) addPoint(sample);
    redraw();
  });
  listen(canvas, 'pointerup', event => {
    if (active?.id !== event.pointerId) return;
    addPoint(event);
    history.push(active.stroke);
    active = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    changed();
  });
  function cancel(event) {
    if (active?.id !== event.pointerId) return;
    active = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
  }
  listen(canvas, 'pointercancel', cancel);
  listen(canvas, 'lostpointercapture', cancel);
  listen(canvas, 'keydown', event => {
    if (canvas.ownerDocument.activeElement === canvas && (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });
  for (const button of buttons) listen(button, 'click', () => {
    const action = button.dataset.scratchAction;
    if (action === 'undo') undo();
    else if (action === 'clear') {
      history = [];
      changed();
    } else {
      eraser = action === 'eraser';
      updateButtons();
    }
  });

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(canvas);
  globalThis.addEventListener?.('resize', resize);
  resize();
  updateButtons();

  return {
    getStrokes: () => normalizeStrokes(history),
    hasInk() {
      if (!hasScratchInk(history)) return false;
      if (!context.getImageData) return true;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true;
      return false;
    },
    destroy() {
      observer?.disconnect();
      globalThis.removeEventListener?.('resize', resize);
      for (const remove of removers) remove();
      if (active && canvas.hasPointerCapture(active.id)) canvas.releasePointerCapture(active.id);
      active = null;
    },
  };
}
