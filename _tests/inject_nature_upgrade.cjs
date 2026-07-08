// One-shot helper to inject the nature upgrade function and its loader
// hook into index.html. Idempotent.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// ---- 1. Insert NATURE_IDS + upgradeNatureToGLB right after mkFoxPlaceholder ----
const fnInsertBefore = '\r\n        function upgradeNPCsToGLB(parsed) {';
const natureFn = `
        // ------------------------------------------------------------
        // NATURE PROPS — replaces procedural rocks/trees/bushes with
        // low-poly GLB meshes converted from a Quaternius-style FBX kit.
        // Procedural factories still build the original meshes; after the
        // GLBs parse, upgradeNatureToGLB() walks world.all and swaps each
        // visible mesh group with a randomly-picked GLB clone, scaled to
        // match the original procedural mesh's bounding box.
        // ------------------------------------------------------------
        const NATURE_IDS = {
            rock:  ['rock1-glb-b64', 'rock2-glb-b64', 'rock3-glb-b64'],
            tree:  ['tree1-glb-b64', 'tree2-glb-b64', 'tree4-glb-b64'],
            bush:  ['bush1-glb-b64', 'bush2-glb-b64', 'bush3-glb-b64'],
            grass: ['grass2-glb-b64', 'grass3-glb-b64'],
        };
        const _natureParsed = {};

        // Build a static (non-skinned) clone of a parsed GLB scene at a
        // requested LOCAL height. Returns a Group that can be added as a
        // child of any object's mesh group.
        function _buildNatureClone(parsed, targetHeight) {
            if (!parsed || !parsed.scene) return null;
            const model = parsed.scene.clone(true);
            // Clone materials so per-instance mutations don't bleed across
            // siblings (and so flat shading takes effect)
            model.traverse((n) => {
                if (n.isMesh) {
                    n.castShadow = true;
                    if (n.material) {
                        if (Array.isArray(n.material)) {
                            n.material = n.material.map(m => {
                                const c = m.clone();
                                c.flatShading = true;
                                c.needsUpdate = true;
                                return c;
                            });
                        } else {
                            n.material = n.material.clone();
                            n.material.flatShading = true;
                            n.material.needsUpdate = true;
                        }
                    }
                }
            });
            // Scale to target height (Y-up). FBX2glTF preserves vertex
            // colors and the natural mesh extents.
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            if (size.y > 0.001 && targetHeight > 0.001) {
                model.scale.setScalar(targetHeight / size.y);
            }
            // Lift so base sits at y=0
            const box2 = new THREE.Box3().setFromObject(model);
            model.position.y = -box2.min.y;
            const g = new THREE.Group();
            g.add(model);
            return g;
        }

        // Walk world.all and swap procedural rock/tree/bush meshes with
        // a random GLB clone of the same approximate size. Called after
        // all four nature parses complete.
        function upgradeNatureToGLB() {
            let upgraded = 0;
            for (const obj of world.all) {
                if (obj.category !== 'vegetation') continue;
                const ids = NATURE_IDS[obj.type];
                if (!ids) continue;
                const parsedList = ids.map(id => _natureParsed[id]).filter(Boolean);
                if (parsedList.length === 0) continue;

                // Measure the procedural mesh's LOCAL height (no parent
                // scale). The mesh has had setScale() called by place(),
                // but we want the unscaled child geometry size so the
                // replacement child preserves the parent scale system.
                const tempScale = obj.mesh.scale.clone();
                obj.mesh.scale.set(1, 1, 1);
                obj.mesh.updateMatrixWorld(true);
                const oldBox = new THREE.Box3().setFromObject(obj.mesh);
                const oldSize = new THREE.Vector3();
                oldBox.getSize(oldSize);
                obj.mesh.scale.copy(tempScale);
                obj.mesh.updateMatrixWorld(true);

                const targetHeight = oldSize.y > 0.001 ? oldSize.y : 0.5;

                // Pick a random variant
                const parsed = parsedList[Math.floor(Math.random() * parsedList.length)];
                const replacement = _buildNatureClone(parsed, targetHeight);
                if (!replacement) continue;

                // Wipe procedural visuals, install replacement
                while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                obj.mesh.add(replacement);
                upgraded++;
            }
            console.log('[nature] upgraded ' + upgraded + ' nature objects (rocks/trees/bushes)');
        }

        // Kick off parses for every nature GLB. Once all are loaded, run
        // the upgrade pass. Each parse is independent — if one fails the
        // others still upgrade their respective types.
        function loadAllNature() {
            const allIds = [];
            for (const ids of Object.values(NATURE_IDS)) for (const id of ids) allIds.push(id);
            let pending = allIds.length;
            for (const id of allIds) {
                parseGLBOnce(id, (parsed) => {
                    if (parsed) _natureParsed[id] = parsed;
                    if (--pending === 0) upgradeNatureToGLB();
                });
            }
        }

`;

if (html.includes('function upgradeNatureToGLB')) {
    console.log('  upgradeNatureToGLB already present, skipping');
} else if (html.includes(fnInsertBefore)) {
    html = html.replace(fnInsertBefore, natureFn + fnInsertBefore);
    console.log('  inserted nature upgrade functions');
} else {
    console.error('  MARKER NOT FOUND for upgrade function insertion');
    process.exit(1);
}

// ---- 2. Hook loadAllNature into the loader chain after the fox parse ----
const hookBefore = `                parseGLBOnce('fox-glb-b64', (foxParsed) => {\r\n                    if (!foxParsed) return;\r\n                    const n = upgradeAnimalsToGLB(foxParsed, { type: 'fox', targetHeight: 0.55 });\r\n                    console.log('[fox] upgraded ' + n + ' foxes to GLB');\r\n                });`;
const hookAfter = `                parseGLBOnce('fox-glb-b64', (foxParsed) => {\r\n                    if (!foxParsed) return;\r\n                    const n = upgradeAnimalsToGLB(foxParsed, { type: 'fox', targetHeight: 0.55 });\r\n                    console.log('[fox] upgraded ' + n + ' foxes to GLB');\r\n                });\r\n\r\n                // Parse all nature GLBs and replace procedural rocks/trees/bushes\r\n                loadAllNature();`;

if (html.includes('loadAllNature();')) {
    console.log('  loader hook already present, skipping');
} else if (html.includes(hookBefore)) {
    html = html.replace(hookBefore, hookAfter);
    console.log('  hooked loadAllNature into loader chain');
} else {
    console.error('  MARKER NOT FOUND for loader hook');
    process.exit(1);
}

fs.writeFileSync(htmlPath, html);
console.log('  index.html written, new size:', fs.statSync(htmlPath).size);
