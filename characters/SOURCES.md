# Character Asset Sources

This folder is a **staging area** for raw GLB downloads. The runtime game
inlines selected GLBs as base64 inside `index.html` itself — nothing in
this folder is loaded at play time. To add a model to the game, splice
it in via:

```bash
node _tests/splice_glb_inline.cjs characters/<subfolder>/<file>.glb <script-id>
```

Then add an entry to `MC_CHARACTERS` in `index.html`.

## Inlined and used by the game

- **`robots/RobotExpressive.glb`** — [three.js examples](https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb) — CC0 — Idle, Walking, Running, Jump, Wave, Dance, Yes, No, ThumbsUp, Sitting, Standing, Punch, Death, WalkJump
- **`humans/CesiumMan.glb`** — [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (`Models/CesiumMan/glTF-Binary/CesiumMan.glb`) — CC-BY — one unnamed walk cycle
- **`humans/HVGirl.glb`** — [Babylon.js demos CDN](https://models.babylonjs.com/HVGirl.glb) — Babylon.js sample license — Idle, Walking, WalkingBack, Samba
- **`creatures/Fox.glb`** — [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (`Models/Fox/glTF-Binary/Fox.glb`) — CC0 — Survey, Walk, Run
- **`creatures/Flamingo.glb`** — [three.js examples](https://threejs.org/examples/models/gltf/Flamingo.glb) — CC0 — `flamingo_flyA_`
- **`creatures/Parrot.glb`** — [three.js examples](https://threejs.org/examples/models/gltf/Parrot.glb) — CC0 — `parrot_A_`
- **`creatures/Stork.glb`** — [three.js examples](https://threejs.org/examples/models/gltf/Stork.glb) — CC0 — `storkFly_B_`
- **`creatures/Horse.glb`** — [three.js examples](https://threejs.org/examples/models/gltf/Horse.glb) — CC0 — `horse_A_`

## Downloaded but NOT used (rejected)

- **`creatures/Polypug.glb`** — ToxSam `cc0-models-Polygonal-Mind` / `xyz` collection — rigged but no animations
- **`creatures/Penguiton.glb`** — ToxSam `cc0-models-Polygonal-Mind` / `xyz` collection — rigged but no animations
- **`creatures/Octozilla.glb`** — ToxSam `cc0-models-Polygonal-Mind` / `xyz` collection — rigged but no animations
- **`readyplayer.me.glb`** (probed, not saved) — three.js examples, 1.8MB, rigged but **zero animations** — would need procedural bone manipulation to be playable
- **`riggedMesh.glb`** (probed, not saved) — Babylon.js MeshesLibrary `Demos/retargeting/`, 645KB, rigged but **zero animations**

## Sources I tried that didn't pan out

- **three.js examples** — every humanoid except RobotExpressive (Soldier, Michelle, Xbot, Ybot) is 3MB+, too big for inline.
- **Khronos sample assets** — only CesiumMan (438KB) is a small humanoid; BrainStem and others are 3MB+.
- **ToxSam/cc0-models-Polygonal-Mind** — 991+ CC0 GLBs, but the small ones (under 500KB) are environmental props (furniture, decorations, flora). The 60 `xyz` creatures are small but rigged-without-animations. The avatar collections (`avatar-garden`, `avatar-show`, `cryptoavatars-retro-booth`) are mostly multi-MB scenes/sets, not standalone characters.
- **GitHub Code Search API** for small GLBs — requires authentication.

## Sources to try with explicit URLs / packs (need user input)

- **Quaternius packs** (quaternius.com/packs/) — distributed as ZIPs on itch.io. Cannot script-download without an interactive download token.
- **Kenney Mini Characters** (kenney.nl) — same, ZIP-only.
- **Mixamo** (Adobe) — requires login, interactive selection, manual export.
- **Sketchfab CC0 search** — has an API but requires an API token.

If you have a specific pack URL or a downloaded model file, drop it in the
appropriate subfolder and let me know — I'll splice it in.
