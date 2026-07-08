# Verified codebase facts

All values below were verified against `index.html` source (line numbers approximate — they drift; re-grep if precision matters).

## Key constants (`index.html` ~lines 148–157)

| Constant | Value | Meaning / cost of changing |
|---|---|---|
| `PR` | `50` | Planet radius |
| `CH` | `1.8` | Character height; GLB model is scaled to this |
| `WORLD_SCALE` | `2.5` | Scale of placed world objects relative to character |
| `MAX_WALK` | `0.6` | Walk speed |
| `MAX_RUN` | `1.2` | Run speed (Shift) |
| detail level | `6` | Planet mesh subdivision (~40k tris). Detail 7 drops FPS to ~20. |

## Controls (from the in-game hint, `index.html` ~line 118)

W/S forward/back • A/D strafe • ←/→ turn • Shift run • Mouse look • Scroll zoom • Space jump • 1/2/3 camera modes • P photo • O selfie • E wave • T dance • Y yes • N no • B taunt • M character • C color • F3 debug panel

Arrow Left/Right also turn the character (in addition to mouse). Camera modes are `Digit1/2/3`.

## Test suite (`cd _tests && npm install` first — installs simplex-noise, puppeteer, cannon-es)

| Command | Purpose | Pass criteria |
|---|---|---|
| `node fulltest.mjs` | **Gatekeeper.** 8-route walk test against the actual mesh; run after any grounding change | Per route: world gap < 0.05, forward jitter < 2°/frame, tilt < 1° |
| `node walktest.mjs` | 600-frame trajectory recording with per-frame metrics | — |
| `node test.mjs` | Quick math accuracy check | < 1s; cheap sanity check that executable code is unchanged |
| `node collision_test.mjs` | Collision verification | — |
| `node visualtest.cjs` | Headless-browser screenshots → `_tests/screenshots/` | Launches its own headless browser |
| `node glbtest.cjs` | Verifies inlined GLB load + animation switching | — |
| `node splice_glb_inline.cjs path/to/new.glb` | Helper: base64-encodes a GLB and rewrites the inlined character block in `index.html` | New model needs clips `Idle`/`Walking`/`Running`/`Jump` (or update `animChar` lookups) |

Tests replicate `groundHeight()` and biome math in Node — **any formula change in `index.html` must be mirrored in the test files**.

Runtime test hook: the game exports `window._game` so headless tests can drive the character and read state. In-game debug: F3 panel; `MC → meshface` should stay < 0.05 (< 3% of CH); > 0.1 means grounding is broken.

## Documented file surface (everything else is scratch/experiment)

```
index.html                          — THE GAME (single file)
CLAUDE.md                           — agent-facing instructions
_docs/PROJECT.md                    — full technical documentation
_docs/architecture/design-philosophy.md  — the soul of the game (read first)
_docs/architecture/grounding.md     — grounding system history + lessons
_docs/architecture/zones.md         — zone placement system
_docs/guides/testing.md             — test interpretation guide
_tests/{test,fulltest,walktest,collision_test}.mjs
_tests/{visualtest,glbtest,splice_glb_inline}.cjs
```

## Absolute invariants (from CLAUDE.md — never contradict these in docs or code)

- Collision boundary = the visible mesh surface, via raycasting. NEVER bounding spheres/boxes. Tree collision = trunk only. Open spaces stay open; nothing traps the player.
- NEVER add camera smoothing/lerp; NEVER use face normals for movement direction; NEVER use world-Y-with-threshold as tangent reference; keep `groundHeight()` continuous.
- Grounding hybrid: `moveOnSurface()` steps analytically via `groundHeight()`; `updateChar()` fires ONE ray per frame from `PR+10` toward planet center and snaps to the mesh hit; `getFrame()` uses persistent `_lastFwRef` to survive pole crossings. This looks over-engineered but each piece exists because simpler approaches failed (see `_docs/architecture/grounding.md`).
- Flat shading everywhere (including force-applied to loaded GLBs) — smooth shading fakes curvature and creates a sinking illusion.
- Single HTML file; character GLB inlined as base64 in inert `<script type="text/plain" id="character-glb-b64">`; read via `getElementById(...).textContent` so `file://` works. Fallback: procedural character if decode fails.

## Honest current state (as of 2026-07)

- Core loop works: 14 authored zones, photo system, minimap, HUD, 3 camera modes, F3 debug, jump + land on objects.
- **Collision needs work**: currently sphere collision from a cannon-es experiment; should be reverted to mesh raycast. cannon-es stays in `_tests/package.json` only, never in `index.html`.
- ~20–30 FPS; some objects float (analytical height, not raycasted); no audio.
