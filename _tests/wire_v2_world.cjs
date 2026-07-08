// Wire CDN models into v2 world: replace procedural landmarks with real GLBs,
// add new animals, replace palms with real ones.
// This adds a CDN world-object loader that runs after the page loads.
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// Find the loadAllNature function end and inject the world-object CDN loader after it
const anchor = 'function loadAllNature() {';
const anchorIdx = html.indexOf(anchor);
if (anchorIdx < 0) { console.error('loadAllNature not found'); process.exit(1); }

// Find the closing of loadAllNature (next blank line + function)
const nextFn = html.indexOf('\n\n        function upgradeNPCsToGLB', anchorIdx);
if (nextFn < 0) { console.error('end of loadAllNature not found'); process.exit(1); }

if (html.includes('CDN_WORLD_OBJECTS')) {
    console.log('  CDN world objects already wired');
    process.exit(0);
}

const cdnWorldCode = `

        // ============================================================
        // CDN WORLD OBJECTS — replace procedural landmarks with real
        // Quaternius GLBs fetched from Poly Pizza CDN. Each entry maps
        // a world object type+name to a CDN URL. After the GLB loads,
        // the procedural mesh children are replaced with the CDN model,
        // converted to Lambert, textures kept for buildings.
        // ============================================================
        const CDN_WORLD_OBJECTS = {
            // Buildings — replace procedural landmarks
            'castle':     'https://static.poly.pizza/dc22806e-b00a-4890-b988-f716b0342c9c.glb',
            'temple':     'https://static.poly.pizza/ab9c5809-9dd3-431a-ad3d-313f18288312.glb',
            'lighthouse': 'https://static.poly.pizza/d20bd92c-e18d-4d3d-83bd-2bb2c1a77cf5.glb',
            'windmill':   'https://static.poly.pizza/1b81d893-ed98-4c0e-9f68-2f3d125a4e43.glb',
            'pyramid':    'https://static.poly.pizza/e388ae1f-f495-4904-8e76-278a608fac58.glb',
            'house':      'https://static.poly.pizza/fedcf063-38c2-4ece-b064-f29960dd2193.glb',
            'well':       'https://static.poly.pizza/0e044203-f62e-4dad-ad3e-c3cb6cb393ac.glb',
            'dock':       'https://static.poly.pizza/a34d55ba-16d6-4951-9126-8c15315cb6e4.glb',
            'bench':      'https://static.poly.pizza/623120d8-bebf-4bd9-bb09-3162c06c9741.glb',
            'ruins':      'https://static.poly.pizza/fa6cf69d-a091-4eb7-b62e-56290d8b9097.glb',
            'market':     'https://static.poly.pizza/e2633001-4cf5-46fa-ac68-575c9954f4ba.glb',
            'shipwreck':  'https://static.poly.pizza/941391c3-04a0-43fe-9f7a-c8e7d3b3a77d.glb',
            'statue':     'https://static.poly.pizza/55b0aa03-543c-439d-a7d7-f0ac4c23578f.glb',
            'tower':      'https://static.poly.pizza/749bb696-9058-4290-a5d6-92fb97a9a641.glb',
            // Nature — replace procedural factories
            'palm':       'https://static.poly.pizza/4c17decd-3087-4afe-9611-cfd92cca47cd.glb',
            'cactus':     'https://static.poly.pizza/e130904b-00de-4f96-b462-5244689aa8d8.glb',
        };

        function upgradeWorldObjectsFromCDN() {
            const typesToUpgrade = Object.keys(CDN_WORLD_OBJECTS);
            let upgraded = 0, pending = 0;

            for (const obj of world.all) {
                // Match by type (e.g. 'castle', 'temple', 'house', 'palm')
                const url = CDN_WORLD_OBJECTS[obj.type];
                if (!url) continue;
                // Skip campfires and other special types
                if (obj.type === 'campfire') continue;

                pending++;
                parseGLBOnce(url, (parsed) => {
                    if (!parsed) { pending--; return; }

                    // Measure the procedural mesh's current world size
                    obj.mesh.updateMatrixWorld(true);
                    const oldBox = new THREE.Box3().setFromObject(obj.mesh);
                    const oldSize = new THREE.Vector3();
                    oldBox.getSize(oldSize);
                    const targetHeight = Math.max(oldSize.y, 0.5);

                    // Build replacement: clone, convert materials, scale
                    const model = parsed.scene.clone(true);
                    model.traverse(n => {
                        if (!n.isMesh) return;
                        n.castShadow = true;
                        n.receiveShadow = true;
                        if (n.material) {
                            const convert = (m) => {
                                if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                                    return new THREE.MeshLambertMaterial({
                                        color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
                                        map: m.map || null,  // keep textures for buildings
                                        transparent: m.transparent,
                                        opacity: m.opacity,
                                        side: m.side,
                                    });
                                }
                                return m.clone();
                            };
                            if (Array.isArray(n.material)) n.material = n.material.map(convert);
                            else n.material = convert(n.material);
                        }
                    });

                    // Scale to match the old procedural mesh's world height
                    const newBox = new THREE.Box3().setFromObject(model);
                    const newSize = new THREE.Vector3();
                    newBox.getSize(newSize);
                    if (newSize.y > 0.001) {
                        const scale = targetHeight / newSize.y;
                        model.scale.setScalar(scale);
                    }
                    // Lift base to y=0
                    const finalBox = new THREE.Box3().setFromObject(model);
                    model.position.y = -finalBox.min.y;

                    // Random Y rotation for variety
                    const wrapper = new THREE.Group();
                    wrapper.rotation.y = Math.random() * Math.PI * 2;
                    wrapper.add(model);

                    // Replace
                    while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                    obj.mesh.add(wrapper);
                    upgraded++;
                    pending--;

                    if (pending === 0) {
                        console.log('[cdn-world] upgraded ' + upgraded + ' world objects from CDN');
                    }
                });
            }
            if (pending === 0) {
                console.log('[cdn-world] no matching world objects to upgrade');
            }
        }

`;

html = html.substring(0, nextFn) + cdnWorldCode + html.substring(nextFn);
console.log('  CDN world object loader injected');

// Now hook it into the loader chain — after nature loads
const hookBefore = "                // Parse all nature GLBs and replace procedural rocks/trees/bushes\n                loadAllNature();";
const hookAfter = "                // Parse all nature GLBs and replace procedural rocks/trees/bushes\n                loadAllNature();\n\n                // Replace procedural buildings/landmarks with CDN models\n                upgradeWorldObjectsFromCDN();";

if (html.includes('upgradeWorldObjectsFromCDN();')) {
    console.log('  hook already present');
} else if (html.includes(hookBefore)) {
    html = html.replace(hookBefore, hookAfter);
    console.log('  hooked upgradeWorldObjectsFromCDN into loader chain');
} else {
    console.error('  hook marker not found');
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v2 updated:', fs.statSync(htmlPath).size, 'bytes');
