// Idempotent enhancement of the nature system:
//   1. place() captures _dominantColor (per-type smart pick)
//   2. _buildNatureClone() accepts tint/vertexJitter/scaleVariance/rotateY
//   3. upgradeNatureToGLB() passes per-type opts
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// File uses CRLF; normalize to LF for matching, then convert back on write
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

if (html.includes('_extractDominantColor')) {
    console.log('  enhancements already applied');
    process.exit(0);
}

// ---- 1. Update place() to also capture dominant color ----
const placeBefore = `            {
                obj.mesh.updateMatrixWorld(true);
                const _bbox = new THREE.Box3().setFromObject(obj.mesh);
                const _sz = new THREE.Vector3();
                _bbox.getSize(_sz);
                obj._naturalSize = { x: _sz.x, y: _sz.y, z: _sz.z };
                obj._intendedFinalScale = finalScale;
            }`;
const placeAfter = `            {
                obj.mesh.updateMatrixWorld(true);
                const _bbox = new THREE.Box3().setFromObject(obj.mesh);
                const _sz = new THREE.Vector3();
                _bbox.getSize(_sz);
                obj._naturalSize = { x: _sz.x, y: _sz.y, z: _sz.z };
                obj._intendedFinalScale = finalScale;
                // Capture the procedural mesh's dominant material color so the
                // GLB upgrade can preserve the per-zone color the original
                // factory chose. For trees, prefer the leafy (green-rich)
                // material; for rocks/bushes, the first encountered.
                obj._dominantColor = _extractDominantColor(obj.mesh, type);
            }`;

if (!html.includes(placeBefore)) {
    console.error('  place() marker not found');
    process.exit(1);
}
html = html.replace(placeBefore, placeAfter);
console.log('  place() updated');

// ---- 2. Inject _extractDominantColor helper near tintGLBModel ----
const helperBefore = `        // Tint a model in-place. Caches each material's original color`;
const helperAfter = `        // Walk a procedural mesh and pick the most representative material
        // color. For 'tree' we look for the most leaf-like (green-dominant)
        // material so the GLB tree gets tinted with foliage color, not bark.
        // For everything else we just take the first color we find.
        function _extractDominantColor(mesh, type) {
            const colors = [];
            mesh.traverse(n => {
                if (!n.isMesh || !n.material) return;
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                for (const m of mats) if (m.color) colors.push(m.color);
            });
            if (colors.length === 0) return null;
            if (type === 'tree') {
                let best = colors[0], bestScore = -Infinity;
                for (const c of colors) {
                    const score = c.g - (c.r + c.b) / 2;
                    if (score > bestScore) { bestScore = score; best = c; }
                }
                return best.clone();
            }
            return colors[0].clone();
        }

        // Tint a model in-place. Caches each material's original color`;

if (!html.includes(helperBefore)) {
    console.error('  tintGLBModel marker not found');
    process.exit(1);
}
html = html.replace(helperBefore, helperAfter);
console.log('  _extractDominantColor injected');

// ---- 3. Extend _buildNatureClone with tint/jitter/scaleVariance/rotateY ----
const cloneBefore = `        function _buildNatureClone(parsed, targetHeight) {
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
        }`;

const cloneAfter = `        function _buildNatureClone(parsed, targetHeight, opts) {
            if (!parsed || !parsed.scene) return null;
            opts = opts || {};
            const model = parsed.scene.clone(true);
            const wantsJitter = opts.vertexJitter && opts.vertexJitter > 0;

            // Clone materials so per-instance tints don't bleed. Optionally
            // deep-clone geometries too so per-instance vertex jitter is
            // independent across siblings.
            model.traverse((n) => {
                if (!n.isMesh) return;
                n.castShadow = true;
                if (wantsJitter && n.geometry) {
                    n.geometry = n.geometry.clone();
                }
                if (n.material) {
                    const cloneAndConfig = (m) => {
                        const c = m.clone();
                        c.flatShading = true;
                        if (opts.tint) {
                            // Replace with the procedural color and DISABLE
                            // vertex colors so the new color shows clean. The
                            // GLB rocks/bushes from the FBX kit have very dark
                            // vertex colors that don't fit the planet palette.
                            c.color = opts.tint.clone();
                            c.vertexColors = false;
                        }
                        c.needsUpdate = true;
                        return c;
                    };
                    if (Array.isArray(n.material)) n.material = n.material.map(cloneAndConfig);
                    else n.material = cloneAndConfig(n.material);
                }
            });

            // Per-instance vertex jitter — irregular silhouettes from a small
            // pool of source shapes. Mirrors what procedural lpRock used to do.
            if (wantsJitter) {
                const j = opts.vertexJitter;
                model.traverse(n => {
                    if (!n.isMesh || !n.geometry) return;
                    const p = n.geometry.getAttribute('position');
                    if (!p) return;
                    // Compute local extents from the position attribute itself
                    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
                    for (let i = 0; i < p.count; i++) {
                        const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
                        if (x<minX)minX=x; if (x>maxX)maxX=x;
                        if (y<minY)minY=y; if (y>maxY)maxY=y;
                        if (z<minZ)minZ=z; if (z>maxZ)maxZ=z;
                    }
                    const xAmt = (maxX - minX) * j;
                    const yAmt = (maxY - minY) * j * 0.6;
                    const zAmt = (maxZ - minZ) * j;
                    for (let i = 0; i < p.count; i++) {
                        p.setXYZ(i,
                            p.getX(i) + (Math.random() - 0.5) * xAmt,
                            p.getY(i) + (Math.random() - 0.5) * yAmt,
                            p.getZ(i) + (Math.random() - 0.5) * zAmt
                        );
                    }
                    p.needsUpdate = true;
                    n.geometry.computeVertexNormals();
                });
            }

            // Scale to target height (Y-up).
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            if (size.y > 0.001 && targetHeight > 0.001) {
                model.scale.setScalar(targetHeight / size.y);
            }
            // Lift so base sits at y=0
            const box2 = new THREE.Box3().setFromObject(model);
            model.position.y = -box2.min.y;

            // Wrap in a Group for per-instance Y rotation + non-uniform scale.
            // The non-uniform scale is what makes 3 source meshes look like
            // 30+ distinct ones — same trick as squash/stretch animation.
            const g = new THREE.Group();
            if (opts.rotateY !== false) {
                g.rotation.y = Math.random() * Math.PI * 2;
            }
            if (opts.scaleVariance && opts.scaleVariance > 0) {
                const v = opts.scaleVariance;
                g.scale.set(
                    1 + (Math.random() - 0.5) * 2 * v,
                    1 + (Math.random() - 0.5) * 2 * v,
                    1 + (Math.random() - 0.5) * 2 * v
                );
            }
            g.add(model);
            return g;
        }`;

if (!html.includes(cloneBefore)) {
    console.error('  _buildNatureClone marker not found');
    process.exit(1);
}
html = html.replace(cloneBefore, cloneAfter);
console.log('  _buildNatureClone extended');

// ---- 4. Update upgradeNatureToGLB to pass per-type opts ----
const upgradeBefore = `function upgradeNatureToGLB() {
            let upgraded = 0;
            // Per-type tuning: GLB rocks/trees have very different natural
            // proportions from the procedural placeholders, so we use the
            // stashed _naturalSize from place() (the procedural mesh BEFORE
            // any scale was applied) and apply a per-type multiplier to land
            // on a visible size that matches what the procedural version had.
            const TYPE_TUNING = {
                rock:  0.55,   // GLB rocks were ~6× too big in v1
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

const upgradeAfter = `function upgradeNatureToGLB() {
            let upgraded = 0;
            // Per-type opts:
            //   tuning        — multiplier on the procedural natural Y to
            //                   reach the right visible size
            //   vertexJitter  — per-vertex random offset (rocks only — gives
            //                   the irregular silhouettes the procedural
            //                   ones had via lpRock's vertex shuffling)
            //   scaleVariance — per-instance non-uniform scale ±N. Stretches
            //                   each clone differently so 3 source shapes
            //                   look like 30+ distinct ones.
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

if (!html.includes(upgradeBefore)) {
    console.error('  upgradeNatureToGLB marker not found');
    process.exit(1);
}
html = html.replace(upgradeBefore, upgradeAfter);
console.log('  upgradeNatureToGLB updated');

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  index.html written, new size:', fs.statSync(htmlPath).size);
