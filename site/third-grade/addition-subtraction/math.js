export const values = [1, 10, 100, 1000];
const places = ['ones', 'tens', 'hundreds', 'thousands'];
const singlePlaces = ['one', 'ten', 'hundred', 'thousand'];

export function digits(number) {
  return values.map(value => Math.floor(number / value) % 10);
}

export function modelValue(counts) {
  return counts.reduce((sum, count, place) => sum + count * values[place], 0);
}

export function answerFor(problem) {
  return problem.operation === 'add' ? problem.a + problem.b : problem.a - problem.b;
}

export function createModel(lesson) {
  return {
    counts: digits(lesson.a),
    combined: lesson.operation === 'subtract',
    removed: [false, false, false, false],
    log: [],
  };
}

export function combine(model, lesson) {
  if (lesson.operation !== 'add' || model.combined) return model;
  const other = digits(lesson.b);
  return {
    ...model,
    counts: model.counts.map((count, place) => count + other[place]),
    combined: true,
    log: [...model.log, `Combined ${lesson.a} + ${lesson.b}.`],
  };
}

export function validTrade(model, lesson, place) {
  if (!Number.isInteger(place) || place < 0 || place >= values.length) return false;
  if (lesson.operation === 'add') {
    return model.combined && place < 3 && model.counts.findIndex(count => count >= 10) === place;
  }
  const active = model.removed.findIndex(removed => !removed);
  if (active < 0 || model.counts[active] >= digits(lesson.b)[active]) return false;
  const source = model.counts.findIndex((count, index) => index > active && count > 0);
  return place === source;
}

export function trade(model, lesson, place) {
  if (!validTrade(model, lesson, place)) return model;
  const counts = [...model.counts];
  let message;
  if (lesson.operation === 'add') {
    counts[place] -= 10;
    counts[place + 1] += 1;
    message = `Traded 10 ${places[place]} for 1 ${singlePlaces[place + 1]}. The value stayed the same.`;
  } else {
    counts[place] -= 1;
    counts[place - 1] += 10;
    message = `Traded 1 ${singlePlaces[place]} for 10 ${places[place - 1]}. The value stayed the same.`;
  }
  return { ...model, counts, log: [...model.log, message] };
}

export function removePlace(model, lesson) {
  if (lesson.operation !== 'subtract') return model;
  const active = model.removed.findIndex(removed => !removed);
  if (active < 0) return model;
  const amount = digits(lesson.b)[active];
  if (model.counts[active] < amount) return model;
  const counts = [...model.counts];
  const removed = [...model.removed];
  counts[active] -= amount;
  removed[active] = true;
  return {
    ...model, counts, removed,
    log: [...model.log, `Removed ${amount} ${amount === 1 ? singlePlaces[active] : places[active]}.`],
  };
}

export function modelReady(model, lesson) {
  const canonical = model.counts.length === 4 && model.counts.every(count => Number.isInteger(count) && count >= 0 && count < 10);
  return canonical && (lesson.operation === 'add' ? model.combined : model.removed.every(Boolean));
}

export function parseWhole(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const text = String(input).trim();
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return Number.isInteger(number) && number >= 0 && number <= 9999 ? number : null;
}

function reversedSubtraction(problem, answerDigits) {
  if (problem.operation !== 'subtract') return false;
  const top = digits(problem.a);
  const bottom = digits(problem.b);
  return answerDigits.every((digit, place) => digit === Math.abs(top[place] - bottom[place]));
}

const subtractionOrderHint = 'Keep the subtraction order. When the top has too few blocks, regroup first. Do not switch the digits to subtract the smaller from the larger.';

export function checkGuided(lesson, model, answersAscending) {
  if (!modelReady(model, lesson)) {
    return { correct: false, message: lesson.operation === 'add'
      ? 'Combine the blocks, then regroup until each place has fewer than 10 blocks.'
      : 'Finish regrouping and taking away the blocks in each place, including places with zero to take away.' };
  }
  const answers = Array.isArray(answersAscending) ? answersAscending.map(parseWhole) : [];
  if (answers.length !== 4 || answers.includes(null)) {
    return { correct: false, message: 'Write a digit in every place. Include a zero when that place has no blocks.' };
  }
  if (answers.some(answer => answer > 9)) {
    return { correct: false, message: 'Each place holds one digit, from 0 to 9. Check your regrouping and record the blocks left in that place.' };
  }
  const expected = digits(answerFor(lesson));
  const incorrectPlace = answers.findIndex((answer, place) => answer !== expected[place]);
  if (incorrectPlace >= 0) {
    return { correct: false, message: reversedSubtraction(lesson, answers)
      ? subtractionOrderHint
      : `Check the ${places[incorrectPlace]} place. Record the blocks left in that column; keep each digit in its own place.` };
  }
  return { correct: true, message: 'Your digits match the blocks in every place.' };
}

export function checkIndependent(lesson, work) {
  if (lesson.word && work.operation !== lesson.operation) {
    return { correct: false, message: lesson.operation === 'add'
      ? 'The story combines two groups. Choose the operation that finds their total.'
      : 'The story takes part of a group away. Choose the operation that finds how many remain.' };
  }
  if (!work.hasWork) return { correct: false, message: 'Write or draw how you worked it out before checking.' };
  const problems = lesson.problems ?? [lesson];
  const answers = Array.isArray(work.answers) ? work.answers.map(parseWhole) : [];
  if (answers.length !== problems.length || answers.includes(null)) {
    return { correct: false, message: problems.length > 1
      ? 'Enter a whole-number answer for both problems. Use commas only between groups of three digits.'
      : 'Enter a whole-number answer. Use commas only between groups of three digits.' };
  }
  const incorrect = problems.findIndex((problem, index) => answers[index] !== answerFor(problem));
  if (incorrect >= 0) {
    const problem = problems[incorrect];
    const prefix = problems.length > 1 ? `Check problem ${incorrect + 1}. ` : '';
    return { correct: false, message: prefix + (reversedSubtraction(problem, digits(answers[incorrect]))
      ? subtractionOrderHint
      : 'Line up the place values and check each column from ones to thousands. Record every regrouping in your work.') };
  }
  return { correct: true, message: problems.length > 1 ? 'Both answers are correct, and you recorded your work.' : 'Your answer and operation are correct, and you recorded your work.' };
}
