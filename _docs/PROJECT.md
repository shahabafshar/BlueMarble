# Blue Marble — Project Documentation

## Overview

Blue Marble is a 3D web game where a chibi character walks around a small procedural planet. The planet has 7 biomes, 14 authored zones with landmarks, vegetation, NPCs, and animals. The player explores, takes photos/selfies, and discovers locations.

**Single-file architecture**: `index.html` (~2000 lines) — HTML, CSS, and ES module JavaScript. No build step, no external assets. All geometry is procedural.

**Tech**: Three.js r128 (CDN), simplex-noise v4 (ESM CDN).

## Controls

| Input | Action |
|-------|--------|
| W / Up | Walk forward |
| S / Down | Walk backward |
| A / Left | Turn left |
| D / Right | Turn right |
| Mouse | Look / turn character |
| Scroll | Zoom (mode 3) |
| Shift | Run |
| Space | Jump |
| 1 / 2 / 3 | Camera: first person / close / orbit |
| P | Take photo |
| O | Take selfie |
| F3 | Toggle debug panel |

## Architecture

See detailed docs:
- [Grounding System](architecture/grounding.md) — how the character stays on the mesh surface
- [Zone System](architecture/zones.md) — how the world content is organized
- [Testing Guide](guides/testing.md) — how to run and interpret tests

### Code Structure (index.html sections)

| Lines (approx) | Section |
|-------|---------|
| 1-95 | HTML/CSS — UI overlays, debug panel |
| 96-120 | HTML body elements |
| 124-155 | Config constants, noise functions, helpers |
| 157-205 | Scene setup, renderer, lighting |
| 207-245 | Biome system + groundHeight |
| 247-275 | Planet mesh generation |
| 276-340 | Ocean, clouds |
| 342-570 | Vegetation factories (13 types) |
| 572-915 | Structure factories (25 types) |
| 917-1000 | NPC + animal factories |
| 1002-1255 | Zone placement (14 zones + global fill) |
| 1257-1345 | Character model + shadow |
| 1347-1500 | Player state, getFrame, updateChar, moveOnSurface |
| 1502-1560 | Input handling, camera |
| 1562-1600 | Minimap |
| 1602-1640 | Photo system |
| 1642-1700 | HUD, debug panel |
| 1702-1850 | Character animation, main loop |
| 1852-end | Test system, window._game export |

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| PR | 50 | Planet radius |
| CH | 1.8 | Character height |
| WORLD_SCALE | 2.5 | Scale for placed objects vs character |
| MAX_WALK | 0.6 | Walk speed cap |
| MAX_RUN | 1.2 | Run speed cap |
| Detail level | 6 | Planet icosahedron subdivision (~40k triangles) |

### Biomes

| Type | Name | Color |
|------|------|-------|
| 0 | Ocean | #4aa3df |
| 1 | Grasslands | #7ec850 |
| 2 | Forest | #4aad5b |
| 3 | Desert | #e8c170 |
| 4 | Snowy Mountains | #e8eef0 |
| 5 | Tropical Jungle | #3a9944 |
| 6 | Beach | #f0dca0 |

## Known Issues

1. **FPS ~20-27** — detail 6 + per-frame raycast + many scene objects
2. **Some objects float** — placed with analytical height, not raycasted
3. **No collision** — character walks through objects
4. **No audio**

## Development History

Extensive iteration on grounding. Key milestones:
1. Quaternion-based sphere walking (pole singularity issues)
2. Mesh raycasting for everything (too slow, edge jitter)
3. Pure analytical grounding (18% visual gap on slopes)
4. **Hybrid: analytical movement + per-frame raycast** (current, working)

The autonomous test suite (`_tests/`) catches grounding regressions. The in-game debug panel (F3) shows real-time mesh distance.
