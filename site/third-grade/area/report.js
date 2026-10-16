const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const count = value => Number.isInteger(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value : null;
const pngData = value => typeof value === 'string' && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value) ? value : null;
const date = value => {
  const parsed = new Date(value);
  return value && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
};

function submittedWork(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    text: text(value.text) || '',
    image: pngData(value.image),
    cuts: Array.isArray(value.cuts) ? value.cuts.filter(line => Array.isArray(line) && line.length === 2 && line.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))).map(line => line.map(point => [...point])) : [],
  };
}

export function buildGradeSheet(lessons, completed = {}) {
  const rows = lessons.map((lesson, index) => {
    const record = completed[lesson.id];
    const done = Boolean(record && typeof record === 'object');
    const result = done && record.result && typeof record.result === 'object' ? record.result : null;
    const older = done && !result;
    const supported = result && typeof result.supported === 'boolean' ? result.supported : null;
    return {
      id: lesson.id, number: index + 1, title: lesson.title,
      independent: Boolean(lesson.independent), final: Boolean(lesson.final),
      completed: done, older,
      status: !done ? 'Not completed' : older ? 'Complete (older record)' : supported === true ? 'Complete with help' : supported === false ? 'Complete without help' : 'Complete (details unavailable)',
      supported,
      total: result ? text(result.total) : null,
      unit: result ? text(result.unit) : null,
      corrections: result ? count(result.corrections) : null,
      hints: result ? count(result.hints) : null,
      areas: result && Array.isArray(result.areas) ? result.areas.map(String) : [],
      completedAt: done ? text(record.completedAt) : null,
      finalWork: lesson.final && result ? submittedWork(result.final) : null,
    };
  });
  return {
    rows,
    summary: {
      completed: rows.filter(row => row.completed).length,
      total: rows.length,
      independentWithoutHelp: rows.filter(row => row.independent && row.completed && row.supported === false).length,
      independentTotal: rows.filter(row => row.independent).length,
      unknownLegacyIndependent: rows.filter(row => row.independent && row.older).length,
      corrections: rows.reduce((sum, row) => sum + (row.corrections ?? 0), 0),
      hints: rows.reduce((sum, row) => sum + (row.hints ?? 0), 0),
      hasOlderResults: rows.some(row => row.older),
    },
  };
}

function finalFigure(lesson, cuts) {
  const scale = 24;
  const margin = 52;
  const xs = lesson.polygon.map(point => point[0]);
  const ys = lesson.polygon.map(point => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = (Math.max(...xs) - minX) * scale + margin * 2;
  const height = (Math.max(...ys) - minY) * scale + margin * 2;
  const point = ([x, y]) => [(x - minX) * scale + margin, (y - minY) * scale + margin];
  const labels = lesson.polygon.map((a, index) => {
    const b = lesson.polygon[(index + 1) % lesson.polygon.length];
    const length = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    const nx = (b[1] - a[1]) / length;
    const ny = -(b[0] - a[0]) / length;
    const [x, y] = point([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    return `<text x="${x + nx * 14}" y="${y + ny * 14}" text-anchor="${nx > 0 ? 'start' : nx < 0 ? 'end' : 'middle'}" dominant-baseline="central" font-size="18" fill="#172b25">${escape(length)} ${escape(lesson.unit)}</text>`;
  }).join('');
  const lines = cuts.map(([a, b], index) => {
    const [x1, y1] = point(a);
    const [x2, y2] = point(b);
    return `<line data-grade-cut="${index}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#172b25" stroke-width="2" stroke-dasharray="5 4"/>`;
  }).join('');
  return `<svg class="grade-figure" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(lesson.title)} with side lengths in ${escape(lesson.unit)} and submitted cuts"><polygon points="${lesson.polygon.map(p => point(p).join(',')).join(' ')}" fill="#e4ece6" stroke="#172b25" stroke-width="2"/>${lines}${labels}</svg>`;
}

function finalSection(lessons, rows) {
  const lesson = lessons.find(item => item.final);
  if (!lesson) return '';
  const row = rows.find(item => item.id === lesson.id);
  let content;
  if (!row.completed) content = '<p>Final problem has not been completed.</p>';
  else {
    content = row.total && row.unit ? `<p><strong>Final answer: ${escape(row.total)} ${escape(row.unit)}</strong></p>` : '';
    if (!row.finalWork) content += '<p>Written work was not saved for this completion.</p>';
    else {
      const work = row.finalWork;
      content += `<div class="grade-work-layout">${finalFigure(lesson, work.cuts)}<div>${work.text.trim() ? `<h3>Typed calculations</h3><pre class="grade-written-work">${escape(work.text)}</pre>` : ''}${work.image ? `<h3>Written calculations</h3><img class="grade-drawing" src="${escape(work.image)}" alt="Submitted handwritten calculations for the final problem">` : ''}${!work.text.trim() && !work.image ? '<p>No written calculations were saved.</p>' : ''}</div></div>`;
    }
    content += '<p>Written calculations are not automatically graded. Review them with a parent or teacher.</p>';
  }
  return `<section class="grade-section" aria-labelledby="grade-final-title"><h2 id="grade-final-title">Final problem</h2>${content}</section><section class="grade-section grade-review" aria-labelledby="grade-review-title"><h2 id="grade-review-title">Parent or teacher review</h2><p>☐ Rectangles cover the shape without gaps or overlaps.</p><p>☐ Calculations match the rectangle measurements.</p><p>☐ Areas are added and the answer includes square units.</p><p>Comments: <span class="grade-line"></span></p><div class="grade-signatures"><p>Reviewed by: <span class="grade-line"></span></p><p>Date: <span class="grade-line"></span></p></div></section>`;
}

export function gradeSheetHtml(lessons, completed = {}) {
  const { rows, summary } = buildGradeSheet(lessons, completed);
  const prepared = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const dash = value => value === null ? '—' : escape(value);
  return `<div class="grade-actions"><button type="button" id="close-grade-sheet">Back to lessons</button><button type="button" id="print-grade-sheet">Print / Save PDF</button></div><header><h1 id="grade-sheet-title" tabindex="-1">Grade sheet</h1><h2>Third grade · Area</h2><p class="grade-student">Name: <span class="grade-line"></span></p><p class="grade-prepared">Prepared: ${escape(prepared)}</p></header><div class="grade-summary"><div class="grade-metric"><strong>${summary.completed} of ${summary.total}</strong><span> lessons complete</span></div><div class="grade-metric"><strong>${summary.independentWithoutHelp} of ${summary.independentTotal}</strong><span> independent problems completed without in-app help</span></div><div class="grade-metric"><strong>${summary.corrections}</strong><span> recorded corrections</span></div><div class="grade-metric"><strong>${summary.hints}</strong><span> recorded hints</span></div></div><p>Results describe the latest completed attempt. Hints and corrections count as in-app help. On independent problems, using the grid, example splits, or “Line up zero” also counts. Help from another person is not recorded.</p><p>Corrections count requests to change an answer, ruler position, or cut. They are not a math score.</p>${summary.hasOlderResults ? `<p>Older records do not include totals, corrections, or hints.${summary.unknownLegacyIndependent ? ` Help use is unknown for ${summary.unknownLegacyIndependent} older independent ${summary.unknownLegacyIndependent === 1 ? 'completion' : 'completions'}.` : ''}</p>` : ''}<p class="grade-table-hint">Swipe the table to see all results.</p><div class="grade-table-wrap" tabindex="0" role="region" aria-label="Lesson results, scroll sideways for more columns"><table class="grade-table"><caption>Lesson results</caption><thead><tr><th scope="col">Lesson</th><th scope="col">Result</th><th scope="col">Total area</th><th scope="col">Corrections</th><th scope="col">Hints</th></tr></thead><tbody>${rows.map(row => `<tr data-grade-lesson="${escape(row.id)}"><th scope="row">${row.number}. ${escape(row.title)}</th><td>${escape(row.status)}${date(row.completedAt) ? `<br><small class="grade-completed-date">${escape(date(row.completedAt))}</small>` : ''}</td><td>${row.total !== null && row.unit !== null ? `${escape(row.total)} ${escape(row.unit)}` : '—'}</td><td>${dash(row.corrections)}</td><td>${dash(row.hints)}</td></tr>`).join('')}</tbody></table></div>${finalSection(lessons, rows)}`;
}
