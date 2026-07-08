# Mission: Write a comprehensive README and fill documentation gaps

## Goal
Give Blue Marble a proper top-level `README.md` and add explanatory header comments where the *why* of the code isn't obvious, so a newcomer can understand, run, and contribute to the project without reading `CLAUDE.md` or spelunking through `index.html`.

## Context
Blue Marble is an exploration game: a tiny character on a miniature procedural planet, built as a **truly single HTML file** (`index.html`, ~2700 LOC + a base64-inlined GLB character, ~750 KB). No build system — you open the file in a browser and it runs, even over `file://`. Documentation currently lives in `CLAUDE.md` (agent-facing) and `_docs/` (`PROJECT.md`, `architecture/design-philosophy.md`, `architecture/grounding.md`, `architecture/zones.md`, `guides/testing.md`). There is **no README.md** at the repo root, so the project has no human-facing front door.

## Scope of work

### 1. Create `README.md` at the repo root, covering:
- **What it is** — an exploration game on a miniature planet; objects are destinations, not obstacles. Borrow the tone/soul from `_docs/architecture/design-philosophy.md`.
- **Why it exists / design philosophy** — the single-file constraint, procedural world, "walk up to anything" collision philosophy. Summarize; link to `_docs/` for depth.
- **Install / run** — the honest answer: none. Open `index.html` in a browser. Note the `file://` support (no fetch, inlined GLB) and that the only "install" is `cd _tests && npm install` for the test suite.
- **Day-to-day usage with examples** — controls (WASD/arrows, jump, camera modes, photo system, minimap, F3 debug panel), and the test workflow with real commands (`node fulltest.mjs`, `node walktest.mjs`, `node visualtest.cjs`, etc.) and what each verifies. Include the `window._game` test hook and the GLB-swap workflow (`node _tests/splice_glb_inline.cjs path/to/new.glb`).
- **Configuration** — key constants in `index.html` (`PR`, `CH`, `WORLD_SCALE`, `MAX_WALK`, `MAX_RUN`, detail level) and what changing them does / costs (e.g. detail 7 tanks FPS).
- **How to contribute** — the absolute rules (mesh-surface collision only, no bounding-sphere boundaries, no camera lerp, keep `groundHeight()` continuous, `character.position/quaternion/scale` contract, single-file rule), the requirement to keep `_tests` formula replicas in sync with `index.html`, and the gatekeeper test (`fulltest.mjs` pass criteria: world gap < 0.05, jitter < 2°/frame, tilt < 1°).
- **Current state / known issues** — honest status: collision needs reverting from sphere experiment to mesh raycast, ~20–30 FPS, some floating objects, no audio.

### 2. Add "docstring"-equivalent header comments where the why isn't obvious
This is a JS-in-HTML project, so "module-level docstrings" means **section-level block comments**:
- In `index.html`: short block comments at the top of the major sections (grounding system, `getFrame`/`_lastFwRef`, `moveOnSurface`/`updateChar` hybrid, GLB loader, zone placement) explaining *why* the design is what it is — especially the analytical+raycast hybrid and the pole-crossing forward reference, which look like bugs-waiting-to-be-simplified without context.
- In `_tests/*.mjs` / `*.cjs` core scripts (`fulltest.mjs`, `walktest.mjs`, `test.mjs`, `collision_test.mjs`, `visualtest.cjs`, `glbtest.cjs`, `splice_glb_inline.cjs`): a header comment stating purpose, how to run, and pass criteria. **Skip** the dozens of untracked scratch scripts (`build_v*.cjs`, `nature_*.cjs`, `rock_*.cjs`, etc.) — they are experiments, not part of the documented surface.
- Comment-only changes: **do not alter any executable code**, and do not touch the inlined base64 GLB block.

### 3. Do NOT
- Rewrite or duplicate `CLAUDE.md` or `_docs/` content wholesale — the README should summarize and link.
- Add docs for the untracked experiment files (`index.v1–v4.html`, `experiments/`, `characters/`, scratch tests).
- Change any game behavior, formulas, or tests.

## Acceptance criteria
- `README.md` exists at repo root with all six requested sections (what/why/install/usage/config/contributing), accurate to the actual codebase (verify constants, controls, and test commands against the source, not from memory).
- Core files listed above have concise explanatory header comments; `git diff` on `index.html` shows comment-only changes.
- The game still runs: open `index.html` and verify no console errors; run `node _tests/test.mjs` as a cheap sanity check that nothing executable changed.
- No new files besides `README.md`.

## Open decisions
| Question | Default |
|---|---|
| Should README supersede `_docs/PROJECT.md` or link to it? | Link to it; do not delete or restructure `_docs/`. |
| Include screenshots in README? | No — `_tests/screenshots/` are transient test artifacts; text-only README for now. |
| Document the untracked `index.v2–v4.html` variants? | No — mention only canonical `index.html`; variants are in-progress work. |