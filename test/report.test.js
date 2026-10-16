import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../site/third-grade/area/lessons.js';
import { buildGradeSheet, gradeSheetHtml } from '../site/third-grade/area/report.js';

const finalLesson = LESSONS.find(lesson => lesson.final);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9YQAAAAASUVORK5CYII=';
const result = (overrides = {}) => ({ supported: false, corrections: 0, hints: 0, total: '12', unit: 'cm²', areas: ['12'], final: null, ...overrides });
const completion = (latest, overrides = {}) => ({ independent: true, completedAt: '2026-10-16T15:00:00Z', finalWork: false, result: latest, ...overrides });

test('grade rows report the latest completed attempt, rather than the best-ever independent flag', () => {
  const completed = {
    [LESSONS[0].id]: completion(result({ corrections: 1, hints: 2, supported: true })),
    [LESSONS[9].id]: completion(result({ total: '66', supported: true, corrections: 3 })),
    [LESSONS[10].id]: completion(result({ total: '100', unit: 'ft²', areas: ['50', '50'] }), { independent: false }),
  };
  const sheet = buildGradeSheet(LESSONS, completed);
  assert.equal(sheet.rows.length, LESSONS.length);
  assert.equal(sheet.rows[9].status, 'Complete with help');
  assert.equal(sheet.rows[9].supported, true);
  assert.equal(sheet.rows[10].status, 'Complete without help');
  assert.equal(sheet.rows[10].total, '100');
  assert.deepEqual(sheet.summary, {
    completed: 3, total: 12, independentWithoutHelp: 1, independentTotal: 3,
    unknownLegacyIndependent: 0, corrections: 4, hints: 2, hasOlderResults: false,
  });
});

test('older records and incomplete lessons keep unavailable results distinct from zero', () => {
  const completed = { [LESSONS[9].id]: { independent: true, completedAt: '2026-10-16T15:00:00Z' } };
  const sheet = buildGradeSheet(LESSONS, completed);
  assert.equal(sheet.rows[9].status, 'Complete (older record)');
  assert.equal(sheet.rows[9].older, true);
  assert.equal(sheet.rows[9].total, null);
  assert.equal(sheet.rows[9].corrections, null);
  assert.equal(sheet.rows[9].hints, null);
  assert.equal(sheet.rows[0].status, 'Not completed');
  assert.equal(sheet.rows[0].total, null);
  assert.equal(sheet.summary.independentWithoutHelp, 0);
  assert.equal(sheet.summary.unknownLegacyIndependent, 1);
  assert.equal(sheet.summary.hasOlderResults, true);
  const html = gradeSheetHtml(LESSONS, completed);
  assert.match(html, /Complete \(older record\)/);
  assert.match(html, /Older records do not include totals, corrections, or hints/);
  assert.doesNotMatch(html, /first.?try|accuracy|\d+%/i);
  assert.match(html, /data-grade-lesson="designer-challenge"[^>]*>[\s\S]*?Complete \(older record\)[\s\S]*?<td>—<\/td><td>—<\/td><td>—<\/td>/);
});

test('grade sheet contains a printable table, local prepared date, and requested controls', () => {
  const html = gradeSheetHtml(LESSONS, {});
  assert.match(html, /id="close-grade-sheet"[^>]*>Back to lessons<\/button>/);
  assert.match(html, /id="print-grade-sheet"[^>]*>Print \/ Save PDF<\/button>/);
  assert.match(html, /<h1 id="grade-sheet-title" tabindex="-1">Grade sheet<\/h1>/);
  assert.match(html, /Third grade · Area/);
  assert.match(html, /Name:/);
  assert.ok(html.includes(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })));
  assert.match(html, /<caption>Lesson results<\/caption>/);
  assert.match(html, /On independent problems, using the grid, example splits, or “Line up zero” also counts/);
  assert.equal((html.match(/scope="col"/g) || []).length, 5);
  assert.equal((html.match(/data-grade-lesson=/g) || []).length, LESSONS.length);
  assert.match(html, /Final problem has not been completed/);
  assert.doesNotMatch(html, /Final answer:|72 ft²|grade-figure|grade-written-work|grade-drawing/);
});

test('the final report uses only submitted work and displays the original labeled shape with submitted cuts', () => {
  const completed = {
    [finalLesson.id]: completion(result({ total: '72', unit: 'ft²', areas: [], final: {
      text: '4 × 3 = 12\n12 × 5 = 60\n12 + 60 = 72', image: png, cuts: [[[4, 3], [8, 3]]],
    } }), { finalWork: true }),
  };
  const html = gradeSheetHtml(LESSONS, completed);
  assert.match(html, /class="grade-figure"/);
  assert.match(html, /<polygon /);
  assert.match(html, /data-grade-cut="0"/);
  assert.match(html, />12 ft<\/text>/);
  assert.match(html, /Final answer: 72 ft²/);
  assert.match(html, /class="grade-written-work">4 × 3 = 12\n12 × 5 = 60\n12 \+ 60 = 72<\/pre>/);
  assert.ok(html.includes(`class="grade-drawing" src="${png}"`));
  assert.match(html, /Written calculations are not automatically graded/);
  assert.match(html, /Parent or teacher/);
  assert.equal(buildGradeSheet(LESSONS, completed).rows.at(-1).finalWork.text, completed[finalLesson.id].result.final.text);
});

test('missing final snapshots are stated explicitly and never reconstructed', () => {
  for (const record of [
    { independent: true, finalWork: true, completedAt: '2026-10-16T15:00:00Z' },
    completion(result({ total: '72', unit: 'ft²' }), { finalWork: true }),
  ]) {
    const html = gradeSheetHtml(LESSONS, { [finalLesson.id]: record });
    assert.match(html, /Written work was not saved for this completion/);
    assert.doesNotMatch(html, /class="grade-figure"|class="grade-written-work"|class="grade-drawing"/);
  }
});

test('lesson labels and submitted text are escaped and drawing sources must be PNG data URLs', () => {
  const unsafeLesson = { ...finalLesson, id: 'final"><script>', title: '<img src=x onerror=alert(1)>' };
  const completed = { [unsafeLesson.id]: completion(result({
    total: '<72>', unit: 'ft²" onmouseover="alert(1)',
    final: { text: '<script>alert("work")</script> & done', image: 'https://example.com/tracking.png', cuts: [] },
  })) };
  const html = gradeSheetHtml([unsafeLesson], completed);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /data-grade-lesson="final&quot;&gt;&lt;script&gt;"/);
  assert.match(html, /&lt;script&gt;alert\(&quot;work&quot;\)&lt;\/script&gt; &amp; done/);
  assert.match(html, /&lt;72&gt;/);
  assert.doesNotMatch(html, /<script|<img|https:\/\/example/);
  completed[unsafeLesson.id].result.final.image = 'data:image/svg+xml;base64,PHN2Zy8+';
  assert.doesNotMatch(gradeSheetHtml([unsafeLesson], completed), /<img|PHN2Zy8/);
});
