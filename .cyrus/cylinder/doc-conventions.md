# Documentation conventions + rubric

Applies to the README mission and any future mission that touches docs or comments.

## Voice & structure

- **Summarize and link, never duplicate.** `README.md` is the human front door; `CLAUDE.md` is agent-facing; `_docs/` holds depth. If a topic has a deep doc, the README gets 1–3 sentences + a relative link (e.g. `_docs/architecture/grounding.md`). Do not restructure or delete anything in `_docs/`.
- **Be honest.** State real limitations (FPS, broken sphere collision, floating objects, no audio). This project values "honest current state" over marketing tone.
- **Borrow the soul, don't invent one.** The game's identity comes from `_docs/architecture/design-philosophy.md`: exploration, tiny cute character, objects are destinations. Use that framing.
- **Facts come from source, not memory.** Every constant, keybind, command, and threshold must match `cylinder/project-facts.md` — and if in doubt, re-verify against `index.html` / `_tests/` directly.
- Text-only docs: no screenshots (`_tests/screenshots/` are transient test artifacts).
- Document only the canonical surface. Never mention `index.v1–v4.html`, `experiments/`, `characters/`, or scratch `_tests/` scripts as supported.

## Code-comment rules ("docstring" missions)

- This is JS-in-HTML, so "module docstrings" = **section-level block comments** at the top of major sections.
- Comments explain **why**, not what — especially for designs that look like bugs waiting to be simplified: the analytical+raycast grounding hybrid, `_lastFwRef` pole-crossing reference, the inert-script GLB inlining. State what simpler alternative was tried and why it failed (grounding.md has the history).
- **Comment-only diffs.** Never alter executable code, formulas, or the base64 GLB block while on a documentation mission. Verify with `git diff` before finishing.
- Header comment template for `_tests/` scripts: purpose (1–2 lines), how to run (`node <file>` from `_tests/`), pass criteria or expected output.

## Self-check rubric (run before declaring an iteration done)

1. Every constant/keybind/command in the new docs matches `project-facts.md` (and source).
2. `git diff index.html` shows comment-only changes; base64 block untouched.
3. `node _tests/test.mjs` still passes (< 1s sanity check).
4. Game opens in a browser with no console errors.
5. No new files created beyond what the mission brief authorizes (this mission: only `README.md` at repo root).
6. README links resolve to real paths (`_docs/...`, `_tests/...`).
7. Nothing in the docs contradicts the absolute invariants in `project-facts.md`.
