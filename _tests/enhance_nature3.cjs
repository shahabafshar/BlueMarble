// Apply the 3 missing pieces from the failed enhance_nature.cjs run:
//   1. _extractDominantColor helper
//   2. place() captures _dominantColor
//   3. _buildNatureClone extended with tint/jitter/scaleVariance/rotateY
// Each is idempotent and uses CRLF normalization.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Inject _extractDominantColor helper ----
if (!html.includes('function _extractDominantColor')) {
    const before = '        // Tint a model in-place. Caches each material\'s original color';
    const after = `        // Walk a procedural mesh and pick the most representative material
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
    if (!html.includes(before)) { console.error('  helper marker not found'); process.exit(1); }
    html = html.replace(before, after);
    console.log('  _extractDominantColor injected');
}

// ---- 2. place() captures _dominantColor ----
if (!html.includes('_dominantColor = _extractDominantColor')) {
    const before = `                obj._naturalSize = { x: _sz.x, y: _sz.y, z: _sz.z };
                obj._intendedFinalScale = finalScale;
            }`;
    const after = `                obj._naturalSize = { x: _sz.x, y: _sz.y, z: _sz.z };
                obj._intendedFinalScale = finalScale;
                // Capture the procedural mesh's dominant material color so the
                // GLB upgrade can preserve the per-zone color the original
                // factory chose. Smart per-type pick (leafy color for trees).
                obj._dominantColor = _extractDominantColor(obj.mesh, type);
            }`;
    if (!html.includes(before)) { console.error('  place() marker not found'); process.exit(1); }
    html = html.replace(before, after);
    console.log('  place() captures _dominantColor');
}

// ---- 3. Replace _buildNatureClone with extended version ----
if (!html.includes('wantsJitter')) {
    const start = html.indexOf('function _buildNatureClone(');
    if (start < 0) { console.error('  _buildNatureClone not found'); process.exit(1); }
    // Find end: next blank line followed by another function declaration
    const endAnchor = '\n\n        // Walk world.all and swap procedural rock';
    const endIdx = html.indexOf(endAnchor, start);
    if (endIdx < 0) { console.error('  _buildNatureClone end anchor not found'); process.exit(1); }

    const newFn = `function _buildNatureClone(parsed, targetHeight, opts) {
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
                            // Replace the material color and DISABLE vertex
                            // colors so the new color shows clean. The GLB
                            // rocks/bushes have very dark vertex colors that
                            // don't fit the planet palette.
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
            // pool of source shapes. Mirrors what procedural lpRock did.
            if (wantsJitter) {
                const j = opts.vertexJitter;
                model.traverse(n => {
                    if (!n.isMesh || !n.geometry) return;
                    const p = n.geometry.getAttribute('position');
                    if (!p) return;
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
            // This is the cheap "make 3 source meshes look like 30+" trick.
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

    html = html.substring(0, start) + newFn + html.substring(endIdx);
    console.log('  _buildNatureClone replaced');
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  index.html written, size:', fs.statSync(htmlPath).size);
