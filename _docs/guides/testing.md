# Testing Guide

## Prerequisites

```bash
cd BlueMarble
npm install   # installs simplex-noise + puppeteer
```

## Test Suite Overview

| Test | File | What it does | Speed |
|------|------|-------------|-------|
| Quick math | `_tests/test.mjs` | Verifies groundPos matches groundHeight, 200 steps | <1s |
| Full walk | `_tests/fulltest.mjs` | 8 routes through all biomes, raycasts against actual mesh | ~30s |
| Deep trace | `_tests/walktest.mjs` | 600-frame trajectory with per-frame metrics | ~30s |
| Visual | `_tests/visualtest.cjs` | Launches headless browser, walks character, takes screenshots | ~30s |

## Running Tests

```bash
# After any grounding/physics change:
node _tests/fulltest.mjs

# For deep trajectory analysis:
node _tests/walktest.mjs

# For visual verification (needs swiftshader):
node _tests/visualtest.cjs
# Screenshots saved to _tests/screenshots/
```

## In-Game Debug Panel

Press **F3** to toggle. Shows:

```
--- SURFACE ---
Ground R:      50.842        ← terrain height at MC position
Slope ahead:   3.2°          ← steepness in walking direction

--- MC POSITION ---
MC center R:   50.842        ← MC's distance from planet center
MC → analyticl: 0.0000       ← gap to analytical height (always ~0)
MC → meshface:  0.0012 (0.1%) ← gap to actual rendered face (THIS MATTERS)
Mesh face R:   50.841        ← radius of the mesh triangle underneath

--- MC ORIENTATION ---
Perp delta:    0.00°         ← angle between MC up and surface perpendicular
```

**Key metric: `MC → meshface`** — should be < 0.05 (< 3% MC) everywhere. If you see > 0.1, the grounding is broken.

## What the Tests Check

### fulltest.mjs (the most important one)

Builds the actual planet mesh (163k vertices), walks 8 different routes:
1. Equator belt — tests biome transitions
2. Pole crossing — tests pole singularity
3. Steep hillside — tests slope handling
4. Beach-ocean edge — tests height discontinuity
5. Desert zone — tests flat terrain
6. Snow mountains — tests high elevation
7. Tight circle — tests spiral bug
8. Reverse walk — tests forward/back consistency

For each route, measures:
- **World gap**: character position vs actual mesh face (raycast)
- **Forward jitter**: direction change per frame (> 2° = FAIL)
- **Tilt**: character up vs radial (> 1° = FAIL)
- **Sink/float frames**: frames where gap > 0.05 units

Also tests object placement at 7 landmark locations.

### Interpreting Results

```
PASS | Equator belt         | gap= 0.028 | fwΔ= 0.3° | sink= 0 float= 0
FAIL | Tight circle         | gap= 0.031 | fwΔ= 2.3° | FW_JITTER:2.3°
```

- `gap`: max distance between character and mesh face (units)
- `fwΔ`: max forward direction change in one frame (degrees)
- `sink/float`: frames where character is > 0.05 units below/above mesh

## Adding New Tests

Tests replicate the game's exact functions (noise, biome, groundHeight) in Node.js. If you change `groundHeight()` in the game, update it in the test files too. The test files extract and verify the formula from `index.html` at the start.
