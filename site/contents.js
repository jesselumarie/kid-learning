export function progressSummary(storage, chapters) {
  return chapters.map(({ id, storageKey, lessons }) => {
    const summary = { id, completed: null, total: lessons.length };
    try {
      const saved = JSON.parse(storage.getItem(storageKey));
      if (!saved?.completed || typeof saved.completed !== 'object' || Array.isArray(saved.completed)) return summary;
      const validIds = new Set(lessons.map(lesson => lesson.id));
      summary.completed = Object.entries(saved.completed).filter(([lessonId, record]) => validIds.has(lessonId) && record && typeof record === 'object' && !Array.isArray(record)).length;
    } catch {
      // Chapter links remain available when browser storage cannot be read.
    }
    return summary;
  });
}

async function showSavedProgress() {
  try {
    const [area, arithmetic] = await Promise.all([
      import('./third-grade/area/lessons.js'),
      import('./third-grade/addition-subtraction/lessons.js'),
    ]);
    const chapters = [
      { id: 'area', storageKey: 'kid-learning-area-v1', lessons: area.LESSONS },
      { id: 'addition-subtraction', storageKey: 'kid-learning-arithmetic-v1', lessons: arithmetic.LESSONS },
    ];
    for (const summary of progressSummary(window.localStorage, chapters)) {
      if (summary.completed === null) continue;
      const label = document.querySelector(`[data-progress="${summary.id}"]`);
      label.textContent = `${summary.completed} of ${summary.total} lessons complete on this device`;
      label.hidden = false;
    }
  } catch {
    // Progress is optional; navigation works without JavaScript or storage.
  }
}

if (typeof document !== 'undefined') showSavedProgress();
