# Cylinder — Blue Marble workspace

Durable reference material for all missions in this workspace. Treat these files as **authoritative** — consult them before writing, do not edit them, and if reality in the repo contradicts them, flag the discrepancy instead of silently diverging.

## Files

| File | What it is | When to consult |
|---|---|---|
| `project-facts.md` | Verified hard facts about the codebase: constants (with source line refs), full control list, test commands + pass criteria, the documented file surface, and the absolute invariants. All values were checked against `index.html` source, not copied from memory. | ANY time you state a constant, keybind, command, or file path in docs or comments. Never re-derive these from memory — re-verify against source if in doubt. |
| `doc-conventions.md` | Voice, structure, and hard rules for documentation work in this repo, plus the self-check rubric for doc missions. | Before writing README/docs/comments, and again before declaring an iteration done (run the rubric). |

## Project in one paragraph

Blue Marble is an exploration game: a tiny character walks a miniature procedural planet, discovering places and taking photos. It is a **truly single HTML file** (`index.html`, ~2700 LOC + a base64-inlined GLB character, ~750 KB) — no build system, no server, works over `file://`. Agent-facing docs live in `CLAUDE.md`; deep docs in `_docs/` (`PROJECT.md`, `architecture/design-philosophy.md`, `architecture/grounding.md`, `architecture/zones.md`, `guides/testing.md`). The soul of the game: **objects are destinations, not obstacles** — the player must be able to walk up to, into, and through anything with a visible opening.

## Non-negotiables for every mission

- Single-file rule: `index.html` stays self-contained (inlined GLB, no sibling assets, no fetch).
- Never introduce bounding-sphere/box collision, camera lerp, or discontinuities in `groundHeight()`.
- `character.position` / `.quaternion` / `.scale` is the contract — only the grounding system writes them.
- If a formula changes in `index.html`, its replica in `_tests/*.mjs` must change too.
- Untracked scratch files (`index.v1–v4.html`, `experiments/`, `characters/`, `_tests/build_v*.cjs`, `nature_*`, `rock_*`, etc.) are NOT part of the documented or maintained surface.
