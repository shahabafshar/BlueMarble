// Replace the entire upgradeNatureToGLB function body by exact byte range.
// Used because the marker-based approach above couldn't match the partially-
// modified version of this function.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

if (html.includes('TYPE_OPTS = {')) {
    console.log('  upgradeNatureToGLB already enhanced');
    process.exit(0);
}

const start = html.indexOf('function upgradeNatureToGLB()');
if (start < 0) { console.error('  function not found'); process.exit(1); }
// Find the next stable anchor right after the closing brace
const anchor = '\n\n        // Kick off parses for every nature GLB';
const anchorIdx = html.indexOf(anchor, start);
if (anchorIdx < 0) { console.error('  end anchor not found'); process.exit(1); }

const newBody = `function upgradeNatureToGLB() {
            let upgraded = 0;
            // Per-type opts:
            //   tuning        — multiplier on the procedural natural Y
            //   vertexJitter  — per-vertex random offset (rocks only)
            //   scaleVariance — per-instance non-uniform scale variation
            const TYPE_OPTS = {
                rock:  { tuning: 0.55, vertexJitter: 0.10, scaleVariance: 0.22 },
                tree:  { tuning: 1.10, vertexJitter: 0,    scaleVariance: 0.15 },
                bush:  { tuning: 0.85, vertexJitter: 0,    scaleVariance: 0.18 },
            };
            for (const obj of world.all) {
                if (obj.category !== 'vegetation') continue;
                const ids = NATURE_IDS[obj.type];
                if (!ids) continue;
                const parsedList = ids.map(id => _natureParsed[id]).filter(Boolean);
                if (parsedList.length === 0) continue;
                if (!obj._naturalSize) continue;
                const typeOpts = TYPE_OPTS[obj.type] || { tuning: 1, vertexJitter: 0, scaleVariance: 0 };

                const targetWorldY = obj._naturalSize.y * obj._intendedFinalScale * typeOpts.tuning;
                const parsed = parsedList[Math.floor(Math.random() * parsedList.length)];

                obj.mesh.scale.set(1, 1, 1);
                obj.scale = 1;
                obj.mesh.updateMatrixWorld(true);

                const replacement = _buildNatureClone(parsed, targetWorldY, {
                    tint: obj._dominantColor,
                    vertexJitter: typeOpts.vertexJitter,
                    scaleVariance: typeOpts.scaleVariance,
                });
                if (!replacement) continue;

                while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                obj.mesh.add(replacement);
                upgraded++;
            }
            console.log('[nature] upgraded ' + upgraded + ' nature objects (rocks/trees/bushes)');
        }`;

html = html.substring(0, start) + newBody + html.substring(anchorIdx);
console.log('  upgradeNatureToGLB replaced');

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  index.html written, size:', fs.statSync(htmlPath).size);
