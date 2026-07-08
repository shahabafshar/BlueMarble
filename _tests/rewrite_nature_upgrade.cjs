// Idempotent rewrite of upgradeNatureToGLB to use stashed natural size + tuning.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

if (html.includes('TYPE_TUNING')) {
    console.log('  upgradeNatureToGLB already updated');
    process.exit(0);
}

const before = `function upgradeNatureToGLB() {
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
        }`;

const after = `function upgradeNatureToGLB() {
            let upgraded = 0;
            // Per-type tuning: GLB rocks/trees have very different natural
            // proportions from the procedural placeholders, so we use the
            // stashed _naturalSize from place() (the procedural mesh BEFORE
            // any scale was applied) and apply a per-type multiplier to land
            // on a visible size that matches what the procedural version had.
            const TYPE_TUNING = {
                rock:  0.55,   // GLB rocks were ~6x too big in v1
                tree:  1.10,   // trees can be a touch taller
                bush:  0.85,
            };
            for (const obj of world.all) {
                if (obj.category !== 'vegetation') continue;
                const ids = NATURE_IDS[obj.type];
                if (!ids) continue;
                const parsedList = ids.map(id => _natureParsed[id]).filter(Boolean);
                if (parsedList.length === 0) continue;
                if (!obj._naturalSize) continue;

                // Target visible world-Y = (procedural natural Y)
                //                        x (intended final scale from place())
                //                        x (per-type tuning multiplier)
                const tuning = TYPE_TUNING[obj.type] || 1.0;
                const targetWorldY = obj._naturalSize.y * obj._intendedFinalScale * tuning;

                // Pick a random variant
                const parsed = parsedList[Math.floor(Math.random() * parsedList.length)];

                // Clear the parent scale to 1 and bake the entire scaling
                // into the clone. This avoids the double-scale bug from v1.
                obj.mesh.scale.set(1, 1, 1);
                obj.scale = 1;
                obj.mesh.updateMatrixWorld(true);

                const replacement = _buildNatureClone(parsed, targetWorldY);
                if (!replacement) continue;

                // Wipe procedural visuals, install replacement
                while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                obj.mesh.add(replacement);
                upgraded++;
            }
            console.log('[nature] upgraded ' + upgraded + ' nature objects (rocks/trees/bushes)');
        }`;

if (html.includes(before)) {
    html = html.replace(before, after);
    fs.writeFileSync(htmlPath, html);
    console.log('  upgradeNatureToGLB rewritten');
} else {
    console.error('  MARKER NOT FOUND');
    process.exit(1);
}
