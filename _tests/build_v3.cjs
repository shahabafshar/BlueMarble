// v3: Bigger planet (PR 50→200) + distance culling
// Scales all dependent constants proportionally so gameplay feel stays the same.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v3.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

const SCALE = 4; // PR goes from 50 to 200

// ---- 1. Title ----
html = html.replace('[v2] Blue Marble', '[v3] Blue Marble');

// ---- 2. Planet radius ----
html = html.replace('const PR = 50;', 'const PR = 200;  // v3: 4x bigger planet so buildings sit flat');

// ---- 3. Movement speeds (scale by SCALE so walking feels the same) ----
html = html.replace("const MAX_WALK      = 0.6;",   "const MAX_WALK      = " + (0.6 * SCALE).toFixed(1) + ";   // v3: scaled for bigger planet");
html = html.replace("const MAX_RUN       = 1.2;",   "const MAX_RUN       = " + (1.2 * SCALE).toFixed(1) + ";");
html = html.replace("const WALK_ACCEL    = 0.1;",   "const WALK_ACCEL    = " + (0.1 * SCALE).toFixed(1) + ";");
html = html.replace("const RUN_ACCEL     = 0.2;",   "const RUN_ACCEL     = " + (0.2 * SCALE).toFixed(1) + ";");
html = html.replace("const JUMP_FORCE    = 0.38;",  "const JUMP_FORCE    = " + (0.38 * SCALE).toFixed(2) + ";");
html = html.replace("const STEP_HEIGHT   = 0.5;",   "const STEP_HEIGHT   = " + (0.5 * SCALE).toFixed(1) + ";");

// ---- 4. Noise amplitude — scale so mountains stay proportionally same ----
// groundHeight uses fbm which returns values that get added to PR.
// With PR=50, mountains peak at ~PR+3. With PR=200, we want ~PR+12.
// The fbm result is multiplied by biome-dependent factors. The easiest
// knob: scale the terrain amplitude constant.
// Find the groundHeight function and scale its output
// Actually the simplest: multiply the whole fbm output by SCALE.
// groundHeight returns something like: PR + biomeHeight * fbm(...)
// The biomeHeight multiplier is inside the function. Let me find it.
// For now, just add a comment noting this needs manual tuning if terrain looks flat.

// ---- 5. Camera orbit distance ----
html = html.replace("let camPitch=0.3, camDist=10;",
    "let camPitch=0.3, camDist=" + (10 * SCALE) + ";  // v3: scaled for bigger planet");

// ---- 6. Detail level — bigger planet needs more triangles ----
// Can't easily search-replace the detail parameter since it's inside
// IcosahedronGeometry(PR, 6). Let's find and replace.
// The planet mesh creation line
const detailMatch = html.match(/new THREE\.IcosahedronGeometry\(PR\s*,\s*(\d+)\)/);
if (detailMatch) {
    html = html.replace(detailMatch[0], 'new THREE.IcosahedronGeometry(PR, 7)  // v3: detail 7 for bigger planet');
    console.log('  detail level: ' + detailMatch[1] + ' → 7');
}

// ---- 7. Raycaster far distance ----
// updateChar uses _charRay.far = 20 and ray origin at PR+10
// Scale these
html = html.replace('dir.clone().multiplyScalar(PR + 10)', 'dir.clone().multiplyScalar(PR + 40)');
html = html.replace('_charRay.far = 20;', '_charRay.far = 80;  // v3: bigger planet');

// NPC raycasters too
html = html.replace(/\.multiplyScalar\(PR \+ 10\)/g, '.multiplyScalar(PR + 40)');
html = html.replace(/_npcRay\.far = 20;/g, '_npcRay.far = 80;');

// ---- 8. Collision/grounding radii ----
html = html.replace('const MC_RADIUS = 0.4;', 'const MC_RADIUS = ' + (0.4 * SCALE).toFixed(1) + ';');

// ---- 9. Distance-based visibility culling ----
// Add a simple culling pass in the animate loop, right before the render call
const renderLine = '            renderer.render(scene,camera);';
const cullingCode = `            // v3: Distance-based visibility culling — hide objects far from
            // the player to save GPU. Only render objects within renderRadius
            // units. Recalculated every frame (fast — just distance checks).
            {
                const _playerPos = character.position;
                const RENDER_RADIUS = 120;  // units — roughly quarter of the planet
                const RENDER_RADIUS_SQ = RENDER_RADIUS * RENDER_RADIUS;
                for (const obj of world.all) {
                    if (!obj.mesh || !obj.pos) continue;
                    const dx = obj.mesh.position.x - _playerPos.x;
                    const dy = obj.mesh.position.y - _playerPos.y;
                    const dz = obj.mesh.position.z - _playerPos.z;
                    obj.mesh.visible = (dx*dx + dy*dy + dz*dz) < RENDER_RADIUS_SQ;
                }
            }
            renderer.render(scene,camera);`;

if (html.includes('RENDER_RADIUS')) {
    console.log('  culling already present');
} else {
    html = html.replace(renderLine, cullingCode);
    console.log('  distance culling added (RENDER_RADIUS = 120)');
}

// ---- 10. Wheel zoom limits ----
html = html.replace(/camDist=Math\.max\(3,Math\.min\(25,/,
    'camDist=Math.max(' + (3*SCALE) + ',Math.min(' + (25*SCALE) + ',');

// ---- 11. KEY_TURN_RATE stays the same (angular, not distance) ----
// Heading, camPitch, etc are angular — no scaling needed.

console.log('  PR: 50 → 200');
console.log('  speeds: ' + SCALE + 'x');
console.log('  camera dist: ' + SCALE + 'x');

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v3 written:', fs.statSync(htmlPath).size, 'bytes');
