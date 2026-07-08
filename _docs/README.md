# Blue Marble — Documentation Index

Blue Marble is an exploration game: a tiny character on a miniature procedural
planet, shipped as a truly single HTML file ([`../index.html`](../index.html)).
The human-facing front door is the root [`README.md`](../README.md); the files
below go deeper.

## Contents

| Doc | What it covers |
|---|---|
| [`../README.md`](../README.md) | Top-level overview: what/why, run instructions, controls, test commands, config constants, contributing rules, known issues |
| [`PROJECT.md`](PROJECT.md) | Full technical documentation |
| [`architecture/design-philosophy.md`](architecture/design-philosophy.md) | The soul of the game — objects are destinations, not obstacles. Read first before gameplay changes |
| [`architecture/grounding.md`](architecture/grounding.md) | The hybrid analytical + raycast grounding system, and the history of abandoned approaches |
| [`architecture/zones.md`](architecture/zones.md) | Zone placement system (14 authored zones + global fill) |
| [`guides/testing.md`](guides/testing.md) | How to run and interpret the `_tests/` suite |

Agent-facing house rules live in [`../CLAUDE.md`](../CLAUDE.md).

## Progress log

### 2026-07-07 — Iteration 1: root README created
- Added [`README.md`](../README.md) at the repo root — previously the project
  had no human-facing front door. It summarizes and links (does not duplicate)
  the docs in this folder, covering: what the game is, the single-file /
  mesh-collision design philosophy, install/run (none — open `index.html`),
  controls and emotes, the test workflow (`fulltest.mjs` as gatekeeper with
  its pass criteria), the `window._game` test hook, the GLB character-swap
  workflow (`splice_glb_inline.cjs`), key constants (`PR`, `CH`,
  `WORLD_SCALE`, `MAX_WALK`, `MAX_RUN`, detail level), contributing
  invariants, and honest known issues.
- All constants and test commands in the README were verified against
  `index.html` source rather than copied from memory.
- Known nit to fix next iteration: README's camera-mode table lists
  `1/2/3` as "orbit / close / first person" but the source
  (`index.html`, key handler) maps 1 = first person, 2 = close behind,
  3 = orbit — the order is reversed.
- Not yet done from the mission scope: section-level explanatory header
  comments in `index.html` (grounding, `getFrame`/`_lastFwRef`, hybrid
  `moveOnSurface`/`updateChar`, GLB loader, zone placement) and header
  comments in the core `_tests/` scripts.

### 2026-07-07 — Iteration 2: README fixes + `index.html` section comments
- Fixed the root README's camera-mode table: `1/2/3` now correctly reads
  first person / close / orbit, matching the key handler in `index.html`
  (verified against source, not memory).
- Added comment-only "why" blocks to four of the five non-obvious systems
  in `index.html` (line numbers approximate, they drift):
  - `groundHeight()` (~line 244) — why the same continuous function must
    both displace planet vertices and drive movement, and why the old
    hard-coded ocean floor discontinuity was removed.
  - GLB character loader (~line 2505) — why the character is base64 in an
    inert `<script type="text/plain">` block (single file + `file://`,
    no `fetch()`), and that the `character.position/quaternion/scale`
    contract is untouched by the visual swap.
  - `getFrame()` / `_lastFwRef` (~line 2925) — why a persistent forward
    reference exists: world-Y flips at the poles, face normals caused the
    spiral bug. Explicitly flags it as state that must not be simplified away.
  - `moveOnSurface()` / `updateChar()` hybrid (~line 2983) — why neither
    pure analytical nor pure raycast grounding works alone.
- No executable code changed; the inlined base64 GLB block is untouched.
- Still outstanding from the mission scope:
  - The **zone placement** section header (~line 1584) is still a bare
    banner with no design rationale — the fifth planned comment block.
  - Header comments in the core `_tests/` scripts are incomplete:
    `visualtest.cjs` has none; `fulltest.mjs` / `walktest.mjs` lack
    run-line and pass criteria; `glbtest.cjs` lacks run instructions.
  - Post-change verification (`node _tests/test.mjs`, opening
    `index.html` and checking the console) was not run this iteration.
