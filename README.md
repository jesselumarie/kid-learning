# Kid Learning

Interactive third-grade math chapters with hands-on tools, independent written work, and printable grade sheets.

**Site:** [Table of contents](https://jesselumarie.github.io/kid-learning/)

| Chapter | Route | Lessons |
| --- | --- | --- |
| Area | `/third-grade/area/` | 12 |
| Addition and subtraction | `/third-grade/addition-subtraction/` | 16 |

The homepage links to both chapters and shows their saved completion counts when available. Each chapter links back to the contents. Existing area progress stays on the same device.

## Run locally

Use Node.js 22 or newer. No dependency installation or build step is needed.

```sh
npm start
```

Open [the table of contents](http://127.0.0.1:4173/). Use `PORT=4174 npm start` to choose another port.

```sh
npm test       # Mathematics and lesson validation
npm run check # JavaScript syntax checks and tests
```

For browser checks, install the development tools once:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own preview server and completes every lesson, including dragged measurements, custom cuts, keyboard controls, and a touch-sized layout. Screenshots are saved in the ignored `test-results/` folder.

CI runs mathematics and desktop interactions on Linux, and native touch gestures on macOS. Linux Chromium's DevTools touch emulation loses clicks after dragging even on the static control in `test/touch-control.mjs`; the touch job keeps the complete assertions on a working native-input runner. Both jobs must pass before deployment. Run that control script manually when investigating browser input behavior.

## Addition and subtraction

The 16 lessons start with two-digit addition and progress through hundreds, regrouping, subtraction, borrowing across zeros, and four-digit numbers. The last three lessons require written work: two word problems with an operation choice, followed by a mixed final check.

Combine the addition groups, then exchange ten smaller blocks for one larger block. For subtraction, exchange a larger block when the current place has too few to take away. Each exchange preserves the number’s value. Use exchange buttons with a tap or keyboard, or drag them into the neighboring column. Record one answer digit in each place-value column.

Independent lessons start with a blank drawing pad and typing area, separate final-answer fields, and optional block help. The final check requires both answers. Answers and operation choices are checked; written calculations need parent or teacher review. Hints, corrections, and optional independent block help are recorded.

Unfinished lessons keep their own drafts through navigation and reload. Completed written work is saved separately, so a new attempt cannot replace a submitted result until it is completed. This chapter has its own grade sheet and reset control; resetting it preserves area progress. The grade sheet includes all three independent submissions and supports Print / Save PDF.

## Area learning path

The 12 lessons follow four stages:

1. **Unit squares and rectangles:** count equal rows, connect multiplication to area, and use square units.
2. **Shapes made from rectangles:** compare splits and cover every part exactly once.
3. **Reason about the parts:** derive a missing length, combine three rectangles, and exclude empty space.
4. **Independent practice:** solve two guided problems, then write calculations for a final problem.

Feedback addresses perimeter versus area, incomplete totals, overlapping parts, and units. Hints and tools remain available. Completion records practice; it does not guarantee mastery. Revisit a problem on another day and ask the learner to explain it aloud.

The ruler uses drawing units. Its centimeters and feet are a model, not physical lengths on the screen.

## Area controls and accessibility

Either long edge of the ruler can line up with the highlighted side, so its body can sit inside or outside the rectangle. Drag either white zero handle to a corner, rotate when needed, and move the red marker to the other corner. “Switch edge” moves the ruler to the other side of its measuring line, including with a keyboard. Focus either ruler handle and use arrow keys for keyboard measurement. “Line up zero” and the −/+ buttons provide a tap alternative. The ruler stays 15 units long, with the same unit spacing in every lesson. Moving the marker changes the reading, not the ruler’s size. The rotate button names the new direction.

Draw cuts with a pointer, or choose “Draw with keys”: arrow keys position the cursor, Enter starts/finishes a cut, and Escape cancels it. Any valid plan with up to six rectangles is accepted. Example splits provide extra support. Form fields have labels, feedback and hints are announced through live regions, and reduced-motion preferences are respected.

The final problem starts with a blank drawing pad and a typing area. Pen, eraser, undo, and clear controls are available. Work survives resizing and is saved on this device. To finish, add written work and submit the total with square units. The app checks the total and units; a parent or teacher should review the written calculations.

## Area grade sheet

The grade sheet opens when all 12 lessons are complete. Open it anytime using **Grade sheet** in the header or **View grade sheet** after the final problem. **Print / Save PDF** opens the browser print dialog.

The sheet shows each lesson’s latest completed attempt, total area, in-app help, corrections, and hints. Corrections include ruler and cut feedback; they are not a percentage grade. Earlier completions without these details are marked as older records. The final problem includes its submitted diagram, typed calculations, and drawing, followed by space for parent or teacher review. Written calculations need human review.

Completed work is saved separately from unfinished work, so starting another try does not change the sheet until that try is completed. Results stay in this browser; print or save a PDF to share them. Resetting saved progress also removes grade-sheet results and final work.

## Privacy

Progress and written work are stored only in this browser’s `localStorage`, separately for each chapter. They do not sync between devices. Each parent guide can reset its chapter. The app has no accounts, analytics, ads, external fonts, or uploaded student work. GitHub Pages serves the static files; normal hosting request logs are controlled by GitHub.

## Publishing

In the repository’s **Settings → Pages**, select **GitHub Actions** as the source. The workflow checks JavaScript and lesson mathematics on pull requests. A successful push to `main`, or a manual workflow run on `main`, publishes only `site/`. Pull requests do not deploy.

`site/third-grade/area/lessons.js` contains the curriculum. `site/third-grade/area/math.js` validates measurements, areas, units, explanations, and exact rectangle coverage. `site/third-grade/area/app.js` handles the interactive activity.

`site/third-grade/addition-subtraction/lessons.js` contains the arithmetic curriculum. Its `math.js` validates exchanges, subtraction order, answer digits, operation choices, and independent answers. Its `app.js` handles blocks, drafts, and grade sheets. Both chapters use the area chapter’s scratchpad module and base styles.

## Manual QA

- Complete a rectangle and a composite lesson, including an incorrect measurement, area, total, unit, and explanation.
- Drag and turn the ruler, then repeat using keyboard controls. Check that saved measurements remain aligned to the shape.
- Try both decompositions of a shape; the final area should agree.
- Complete an independent lesson with and without help; verify the progress summary distinguishes them.
- Reload after progress, revisit a completed lesson, and test the reset control.
- Write on the final scratchpad, erase and undo, resize, reload, and submit a final answer with square units.
- Open the grade sheet, check recorded results and submitted work, start a new try, and verify the previous completed work remains. Review Print / Save PDF pagination.
- Check a narrow phone viewport, touch input, visible keyboard focus, and reduced motion.
- Complete addition with carries and subtraction across zeros using taps, dragging, and keyboard exchanges.
- Switch between arithmetic lessons with unfinished work, reload, and verify saved digits, drawing, and text.
- Complete the two word problems and both final answers; verify the submitted work on the arithmetic grade sheet.
- Navigate from the homepage to either chapter and back. Open both nested routes directly under `/kid-learning/`.
