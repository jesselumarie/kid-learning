# Kid Learning · Area Workshop

A hands-on area workshop: split shapes into rectangles, move a ruler, record measurements, calculate each part, and explain the total.

**Site:** [jesselumarie.github.io/kid-learning](https://jesselumarie.github.io/kid-learning/)

## Run locally

Use Node.js 22 or newer. No dependency installation or build step is needed.

```sh
npm start
```

Open [localhost:4173](http://127.0.0.1:4173). Use `PORT=4174 npm start` to choose another port.

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

## Learning path

The 12 lessons follow four stages:

1. **Unit squares and rectangles:** count equal rows, connect multiplication to area, and use square units.
2. **Shapes made from rectangles:** compare splits and cover every part exactly once.
3. **Reason about the parts:** derive a missing length, combine three rectangles, and exclude empty space.
4. **Independent practice:** solve three challenges with the grid initially hidden and explain the method.

Feedback addresses perimeter versus area, incomplete totals, overlapping parts, and units. Hints and tools remain available. Completion records practice; it does not guarantee mastery. Revisit a problem on another day and ask the learner to explain it aloud.

The ruler uses drawing units. Its centimeters and feet are a model, not physical lengths on the screen.

## Controls and accessibility

Drag the ruler's zero handle to the highlighted side, turn the ruler when needed, and drag the red end marker to the far corner. Focus either ruler handle and use arrow keys for keyboard measurement. “Line up zero” and the −/+ buttons provide a tap alternative. The ruler shows whole units only.

Draw cuts with a pointer, or choose “Draw with keys”: arrow keys position the cursor, Enter starts/finishes a cut, and Escape cancels it. Any valid plan with up to six rectangles is accepted. Example splits provide extra support. Form fields have labels, feedback and hints are announced through live regions, and reduced-motion preferences are respected.

## Privacy

Progress is stored only in this browser’s `localStorage`. It does not sync between devices. The grown-up guide can reset it. The app has no accounts, analytics, ads, external fonts, or uploaded student work. GitHub Pages serves the static files; normal hosting request logs are controlled by GitHub.

## Publishing

In the repository’s **Settings → Pages**, select **GitHub Actions** as the source. The workflow checks JavaScript and lesson mathematics on pull requests. A successful push to `main`, or a manual workflow run on `main`, publishes only `site/`. Pull requests do not deploy.

`site/lessons.js` contains the curriculum. `site/math.js` validates measurements, areas, units, explanations, and exact rectangle coverage. `site/app.js` handles the interactive workshop.

## Manual QA

- Complete a rectangle and a composite lesson, including an incorrect measurement, area, total, unit, and explanation.
- Drag and turn the ruler, then repeat using keyboard controls. Check that saved measurements remain aligned to the shape.
- Try both decompositions of a shape; the final area should agree.
- Complete an independent lesson with and without help; verify the progress summary distinguishes them.
- Reload after progress, revisit a completed lesson, and test the reset control.
- Check a narrow phone viewport, touch input, visible keyboard focus, and reduced motion.
- Open the deployed project URL and confirm all relative assets load under `/kid-learning/`.
