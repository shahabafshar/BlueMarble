# Blue Marble

A tiny cute character walks around a miniature procedural planet, discovering
places and taking photos. It's a slow, welcoming exploration game where the
world is the attraction — you walk up to a temple and stand between its
columns, cross a bridge, climb pyramid steps, wander through a market. **Objects
are destinations, not obstacles.**

The whole game is a **truly single HTML file** — [`index.html`](index.html),
about 2,700 lines of code plus a base64-inlined GLB character model, ~750 KB
total. It renders with [Three.js](https://threejs.org/) r128 loaded from a CDN
(plus simplex-noise and GLTFLoader). There is no build system, no bundler, no
server. You open the file and you're on the planet.

The planet, its biomes, and everything scattered across it are generated
procedurally from a noise function. The player character is a pre-rigged glTF
model (RobotExpressive, CC0) inlined directly into the HTML so the game works
even when opened straight from disk.

For the full "why it feels the way it does," read
[`_docs/architecture/design-philosophy.md`](_docs/architecture/design-philosophy.md).

## Design philosophy (why it exists this way)

- **Single file, works over `file://`.** The game must run by double-clicking
  `index.html` — no server, no fetch. That constraint shapes everything: the
  GLB character is base64-encoded inside an inert
  `<script type="text/plain" id="character-glb-b64">` block and read via
  `getElementById(...).textContent`, because `fetch()` doesn't work over
  `file://`. If the decode ever fails, a procedural character takes its place.
- **Procedural world.** The planet mesh, biomes, and object placement all come
  from a continuous noise function rather than baked assets, keeping the file
  small and the world coherent.
- **Walk up to anything.** Collision follows the *visible mesh surface* via
  raycasting — never bounding spheres or boxes, which would wrap invisible
  force fields around the things you came to explore. Open doorways, column
  gaps, and arches stay walkable; only solid geometry blocks you.

Deeper writeups live in [`_docs/`](_docs/): the grounding system's history in
[`_docs/architecture/grounding.md`](_docs/architecture/grounding.md), zone
placement in [`_docs/architecture/zones.md`](_docs/architecture/zones.md), and
full technical documentation in [`_docs/PROJECT.md`](_docs/PROJECT.md).

## Install / run

There is no install. Open [`index.html`](index.html) in any modern browser —
it works over `file://`, so double-clicking the file is enough.

The only thing that needs setup is the test suite:

```bash
cd _tests
npm install   # first run only — installs simplex-noise, puppeteer, cannon-es
```

## Usage

### Playing

| Input | Action |
|---|---|
| `W` / `S` | Move forward / back |
| `A` / `D` | Strafe left / right |
| `←` / `→` | Turn |
| `Shift` | Run |
| Mouse | Look |
| Scroll | Zoom |
| `Space` | Jump |
| `1` / `2` / `3` | Camera modes (first person / close / orbit) |
| `P` | Take photo |
| `O` | Take selfie |
| `E` | Wave |
| `T` | Dance |
| `Y` | Yes |
| `N` | No |
| `B` | Taunt |
| `M` | Change character |
| `C` | Change color |
| `F3` | Toggle debug panel |

The **F3 debug panel** exposes the grounding health metric `MC → meshface` —
the gap between the character and the actual planet mesh. Below `0.05` is
healthy; above `0.1` means grounding is broken.

### Testing / dev workflow

Run these from the `_tests/` directory (after `npm install`):

| Command | Purpose | Pass criteria |
|---|---|---|
| `node fulltest.mjs` | **Gatekeeper.** 8-route walk test against the actual mesh; run after any grounding change | Per route: world gap < 0.05, forward jitter < 2°/frame, tilt < 1° |
| `node walktest.mjs` | 600-frame trajectory recording with per-frame metrics | — |
| `node test.mjs` | Quick math accuracy check | Runs in < 1s |
| `node collision_test.mjs` | Collision verification | — |
| `node visualtest.cjs` | Headless-browser screenshots → `_tests/screenshots/` | — |
| `node glbtest.cjs` | Verifies inlined GLB load + animation switching | — |

The game exports `window._game` as a runtime test hook — the headless tests
drive the character and read its state through it.

To swap in a different character model, run:

```bash
node _tests/splice_glb_inline.cjs path/to/new.glb
```

This base64-encodes the GLB and rewrites the inlined character block in
`index.html`. The new model needs animation clips named `Idle`, `Walking`,
`Running`, and `Jump` (or update the clip lookups in `animChar`).

See [`_docs/guides/testing.md`](_docs/guides/testing.md) for how to interpret
test output.

## Configuration

Key constants live near the top of [`index.html`](index.html) (~lines 148–157):

| Constant | Value | Meaning |
|---|---|---|
| `PR` | `50` | Planet radius |
| `CH` | `1.8` | Character height (the GLB is scaled to this) |
| `WORLD_SCALE` | `2.5` | Scale of placed world objects relative to the character |
| `MAX_WALK` | `0.6` | Walk speed |
| `MAX_RUN` | `1.2` | Run speed (`Shift`) |
| detail level | `6` | Planet mesh subdivision (~40k tris). Detail 7 drops FPS to ~20. |

## Contributing

Before changing anything, internalize the rules that keep the game playable.
These are non-negotiable — breaking one destroys the core experience:

- **Collision = the visible mesh surface, via raycasting.** NEVER use bounding
  spheres or boxes — they build invisible walls around the things players want
  to explore. Tree collision is the *trunk only* (walk under the canopy). Open
  spaces (doorways, arches, column gaps) must stay walkable. Nothing should
  trap the player.
- **Never add camera smoothing / lerp.** Lag creates a visual floating illusion.
- **Keep `groundHeight()` continuous** — no step functions or discontinuities.
- **Only the grounding system writes `character.position` / `.quaternion` /
  `.scale`.** Those three properties are the contract everything visual hangs
  off of; never touch them elsewhere and never reparent `character`.
- **Single-file rule.** Don't split `index.html`, don't add sibling assets, and
  don't introduce `fetch()`. The character GLB stays inlined as base64.
- **Mirror formula changes into the tests.** The `_tests/*.mjs` files replicate
  `groundHeight()` and biome math in Node — if you change a formula in
  `index.html`, change it in the replicas too.
- **`fulltest.mjs` is the gatekeeper.** It must pass after any grounding change.

The agent-facing house rules are in [`CLAUDE.md`](CLAUDE.md), and the full
history of what's been tried in the grounding system (and why simpler
approaches were abandoned) is in
[`_docs/architecture/grounding.md`](_docs/architecture/grounding.md).

## Current state / known issues

The core loop works: 14 authored zones, a photo system, minimap, HUD, three
camera modes, and jumping onto and landing on objects.

Honest limitations right now:

- **Collision needs work.** It currently uses a sphere-based experiment
  (cannon-es) and should be reverted to mesh raycasting. cannon-es stays in
  `_tests/package.json` only — it must never be used in `index.html`.
- **Performance is ~20–30 FPS**, below the 60 FPS goal.
- **Some placed objects float** — they're positioned with the analytical height
  rather than raycasted onto the mesh.
- **No audio** yet.
