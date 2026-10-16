export function polygonArea(polygon) {
  return Math.abs(polygon.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = polygon[(index + 1) % polygon.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;
}

export function rectangleArea(rect) {
  return rect.w * rect.h;
}

export function measure(a, b) {
  if (a[0] === b[0]) return Math.abs(b[1] - a[1]);
  if (a[1] === b[1]) return Math.abs(b[0] - a[0]);
  return null;
}

export function rulerMatchesSide(side, ruler, thickness) {
  const vertical = side.axis === 'h';
  if (ruler.vertical !== vertical || ruler.value !== side.length) return false;
  const along = vertical ? ruler.y-side.a[1] : ruler.x-side.a[0];
  const across = vertical ? ruler.x-side.a[0] : ruler.y-side.a[1];
  return Math.abs(along) < .35 && (Math.abs(across) < .35 || Math.abs(across+thickness) < .35);
}

export function checkNumber(raw, expected) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return false;
  const value = String(raw).trim();
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
    && Number.isFinite(Number(value)) && Number(value) === expected;
}

export function evaluateFinal(lesson, work) {
  const errors = [];
  if (!work.hasWork) errors.push({field: 'work', message: 'Draw or type your calculations in the scratchpad first.'});
  if (!checkNumber(work.total,polygonArea(lesson.polygon))) errors.push({field: 'total', message: 'Check the area of each rectangle, then add the areas.'});
  if (work.unit !== `${lesson.unit}²`) errors.push({field: 'unit', message: 'Area uses square units.'});
  return {correct: errors.length === 0, errors};
}

function pointInside(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Every curriculum shape is drawn on an integer grid. Compare individual
// squares so an overlap cannot hide a gap with the same area.
export function splitIsValid(polygon, rects) {
  if (!polygon?.length || !rects?.length) return false;
  if (!polygon.every((point, index) => point.every(Number.isInteger)
    && measure(point, polygon[(index + 1) % polygon.length]) !== null)) return false;
  const minX = Math.min(...polygon.map(point => point[0]));
  const maxX = Math.max(...polygon.map(point => point[0]));
  const minY = Math.min(...polygon.map(point => point[1]));
  const maxY = Math.max(...polygon.map(point => point[1]));
  const covered = new Set();
  for (const rect of rects) {
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isInteger) || rect.w <= 0 || rect.h <= 0) return false;
    if (rect.x < minX || rect.y < minY || rect.x + rect.w > maxX || rect.y + rect.h > maxY) return false;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        const key = `${x},${y}`;
        if (covered.has(key) || !pointInside(polygon, x + 0.5, y + 0.5)) return false;
        covered.add(key);
      }
    }
  }
  return covered.size === polygonArea(polygon);
}

// Treat a cut as a barrier between adjacent unit squares. This accepts any
// complete rectangular decomposition, including plans outside the examples.
export function splitFromCuts(polygon, cuts) {
  const invalid = { valid: false, complete: false, rects: [] };
  const isPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isInteger);
  if (!Array.isArray(polygon) || polygon.length < 4 || !Array.isArray(cuts)) return invalid;
  if (!polygon.every((point, index) => isPoint(point) && isPoint(polygon[(index + 1) % polygon.length])
    && measure(point, polygon[(index + 1) % polygon.length]) !== null)) return invalid;

  const cells = new Map();
  const minX = Math.min(...polygon.map(point => point[0]));
  const maxX = Math.max(...polygon.map(point => point[0]));
  const minY = Math.min(...polygon.map(point => point[1]));
  const maxY = Math.max(...polygon.map(point => point[1]));
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      if (pointInside(polygon, x + 0.5, y + 0.5)) cells.set(`${x},${y}`, [x, y]);
    }
  }
  if (!cells.size) return invalid;

  const barriers = new Set();
  const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const regions = () => {
    const unseen = new Set(cells.keys());
    const result = [];
    while (unseen.size) {
      const first = unseen.values().next().value;
      const region = [cells.get(first)];
      unseen.delete(first);
      for (let i = 0; i < region.length; i++) {
        const [x, y] = region[i];
        const current = `${x},${y}`;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          const next = `${nx},${ny}`;
          if (unseen.has(next) && !barriers.has(edgeKey(current, next))) {
            unseen.delete(next);
            region.push(cells.get(next));
          }
        }
      }
      result.push(region);
    }
    return result;
  };
  const onSegment = ([x, y], [a, b]) => (
    a[0] === b[0] && x === a[0] && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])
  ) || (
    a[1] === b[1] && y === a[1] && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0])
  );
  const boundaries = polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]]);
  let pieces = regions();

  for (const cut of cuts) {
    if (!Array.isArray(cut) || cut.length !== 2 || !cut.every(isPoint)) return invalid;
    const [a, b] = cut;
    if (!measure(a, b) || !cut.every(point => boundaries.some(boundary => onSegment(point, boundary)))) return invalid;
    const vertical = a[0] === b[0];
    const start = Math.min(a[vertical ? 1 : 0], b[vertical ? 1 : 0]);
    const end = Math.max(a[vertical ? 1 : 0], b[vertical ? 1 : 0]);
    for (let position = start; position < end; position++) {
      const left = vertical ? `${a[0] - 1},${position}` : `${position},${a[1] - 1}`;
      const right = vertical ? `${a[0]},${position}` : `${position},${a[1]}`;
      if (!cells.has(left) || !cells.has(right)) return invalid;
      barriers.add(edgeKey(left, right));
    }
    const nextPieces = regions();
    if (nextPieces.length <= pieces.length) return invalid;
    pieces = nextPieces;
    boundaries.push(cut);
  }

  const rects = [];
  for (const region of pieces) {
    const x = Math.min(...region.map(point => point[0]));
    const y = Math.min(...region.map(point => point[1]));
    const w = Math.max(...region.map(point => point[0])) - x + 1;
    const h = Math.max(...region.map(point => point[1])) - y + 1;
    if (w * h === region.length) rects.push({ x, y, w, h });
  }
  rects.sort((a, b) => a.y - b.y || a.x - b.x);
  return { valid: true, complete: rects.length === pieces.length, rects };
}

function areaHint(raw, rect) {
  if (String(raw ?? '').trim() === '') return 'How many squares fit in this rectangle? Multiply its width by its height.';
  if (checkNumber(raw, 2 * (rect.w + rect.h))) return 'That counts the distance around the rectangle—its perimeter. Area counts the squares inside. Try width × height.';
  if (checkNumber(raw, rect.w + rect.h)) return 'Adding the two side lengths counts two edges. To count every square inside, use width × height.';
  return 'Think of equal rows of squares: how many squares in each row, and how many rows? Multiply those two measurements.';
}

export function evaluateWork(lesson, split, work) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  for (const [index, rect] of split.rects.entries()) {
    const entry = work.measurements?.[index];
    if (!checkNumber(entry?.w, rect.w)) add(`w-${index}`, 'Measure the width from left to right. Put 0 at the first corner and count the spaces to the other corner.');
    if (!checkNumber(entry?.h, rect.h)) add(`h-${index}`, 'Measure the height from top to bottom. Start at 0 and stop at this rectangle’s other corner.');
    if (!checkNumber(work.areas?.[index], rectangleArea(rect))) add(`area-${index}`, areaHint(work.areas?.[index], rect));
  }
  if (!checkNumber(work.total, polygonArea(lesson.polygon))) {
    let hint = split.rects.length === 1
      ? 'There is one rectangle, so its area is also the total area. Check your multiplication.'
      : 'Add the areas of your separate rectangles. Count every patch of the shape exactly once.';
    if (errors.length > 0 && lesson.id === 'garden-designer' && checkNumber(work.total, 125)) {
      hint = 'A corner may have been counted twice. Check that your rectangles meet at the split without overlapping.';
    }
    add('total', hint);
  }
  if (work.unit !== `${lesson.unit}²`) add('unit', `Area counts squares. Use square ${lesson.unit === 'cm' ? 'centimeters (cm²)' : 'feet (ft²)'}.`);
  const choice = Number.isInteger(work.reason) ? lesson.reason.choices[work.reason] : null;
  if (!choice?.correct) add('reason', choice?.feedback ?? 'Choose the explanation that matches how the squares cover the shape.');
  return { correct: errors.length === 0, errors };
}
