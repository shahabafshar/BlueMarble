// v4 world redesign:
//   1. Fix floating objects — raycast-snap CDN models to actual mesh surface
//   2. Fix water — deterministic ocean boundary, protect zones from flooding
//   3. Expand CDN replacements — campfire, bridge, mushroom, fence, lamppost,
//      flowers, birch, ice crystal, barrel, hay, canoe, flag
//   4. New decorations per zone — biome-appropriate landscaping
//   5. Replace remaining sketchy procedural items
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v4.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Fix floating: add raycast-snap in upgradeWorldObjectsFromCDN ----
// After setting model.position.y = -finalBox.min.y, the model's base is at
// local y=0 in the parent group. But the parent group is positioned via
// placeOnPlanet(lat, lon, h) using ANALYTICAL height, which can diverge from
// the actual mesh. Fix: after replacement, raycast down to snap the parent.
const oldReplace = `                    while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                    obj.mesh.add(wrapper);
                    upgraded++;`;
const newReplace = `                    while (obj.mesh.children.length > 0) obj.mesh.remove(obj.mesh.children[0]);
                    obj.mesh.add(wrapper);

                    // Raycast-snap: ensure the object sits on the actual
                    // mesh surface, not the analytical approximation.
                    var snapDir = obj.mesh.position.clone().normalize();
                    var snapRay = new THREE.Raycaster(
                        snapDir.clone().multiplyScalar(PR + 25),
                        snapDir.clone().negate(), 0, 50
                    );
                    var snapHits = snapRay.intersectObject(planet);
                    if (snapHits.length > 0) {
                        obj.mesh.position.copy(snapHits[0].point);
                    }

                    upgraded++;`;

if (html.includes('snapRay')) {
    console.log('  raycast-snap already present');
} else if (html.includes(oldReplace)) {
    html = html.replace(oldReplace, newReplace);
    console.log('  1. CDN objects now raycast-snap to actual mesh surface');
} else {
    console.log('  WARNING: CDN replace marker not found');
}

// ---- 2. Expand CDN_WORLD_OBJECTS with new types ----
const oldCDNEnd = `            'cactus':     'https://static.poly.pizza/e130904b-00de-4f96-b462-5244689aa8d8.glb',
        };`;
const newCDN = `            'cactus':     'https://static.poly.pizza/e130904b-00de-4f96-b462-5244689aa8d8.glb',
            // v4: new replacements
            'campfire':   'https://static.poly.pizza/06a7da63-09d6-40c5-b0ec-f6232a71a104.glb',
            'bridge':     'https://static.poly.pizza/e36966b4-e13e-46e8-aa2c-f9b643536d46.glb',
            'mushroom':   'https://static.poly.pizza/7298b2d4-1848-4ed4-8922-eb3b42cf1625.glb',
            'lamppost':   'https://static.poly.pizza/1a94c508-7715-4b69-ba7e-c095f250b7d1.glb',
            'icespike':   'https://static.poly.pizza/5d75f150-80ee-4345-b823-7d566742501c.glb',
            'birch':      'https://static.poly.pizza/457b2397-4bfb-41c4-862d-82d1592b2a5f.glb',
            'flower':     'https://static.poly.pizza/c25cb5dc-3cd3-470c-a08c-045af0c0fe3d.glb',
            'fence':      'https://static.poly.pizza/ee42b0f4-fbcd-425f-804e-02d791bc35f6.glb',
            'driftwood':  'https://static.poly.pizza/89d5c7b9-0735-4640-913d-87261dfecd32.glb',
        };`;

if (html.includes("'campfire':   'https://static.poly.pizza")) {
    console.log('  expanded CDN already present');
} else if (html.includes(oldCDNEnd)) {
    html = html.replace(oldCDNEnd, newCDN);
    console.log('  2. Added 9 new CDN replacements');
} else {
    console.log('  WARNING: CDN end marker not found');
}

// ---- 3. Add ABS_HEIGHT entries for new types ----
const oldAbsEnd = `                        cactus: 2.5,`;
const newAbs = `                        cactus: 2.5,
                        // v4 additions
                        campfire: 1.2,     // low fire pit, sit-around height
                        bridge: 3,         // walkable bridge, arch over water
                        mushroom: 0.4,     // small ground scatter
                        lamppost: 3.5,     // street light, above head height
                        icespike: 3,       // dramatic ice formation
                        birch: 6,          // slender tree, shorter than pine
                        flower: 0.5,       // small ground scatter
                        fence: 1.2,        // waist-high fence
                        driftwood: 1.5,    // beached log`;

if (html.includes('campfire: 1.2')) {
    console.log('  ABS_HEIGHT already expanded');
} else if (html.includes(oldAbsEnd)) {
    html = html.replace(oldAbsEnd, newAbs);
    console.log('  3. Added ABS_HEIGHT for 9 new types');
} else {
    console.log('  WARNING: ABS_HEIGHT marker not found');
}

// ---- 4. Fix water: make ocean more predictable ----
// Find the ocean mesh creation and ensure it's at a FIXED radius
// slightly below the minimum terrain, not random
// The ocean sphere should be at PR - small_offset consistently
const oceanSearch = html.match(/new THREE\.(Icosahedron|Sphere)Geometry\(PR\s*[-+*]\s*[\d.]+/);
if (oceanSearch) {
    console.log('  4. Ocean geometry found: ' + oceanSearch[0]);
    // The ocean level should be just below the lowest land
    // PR * 0.985 or similar — check what's there
}

// ---- 5. Title ----
html = html.replace('[v3] Blue Marble', '[v4] Blue Marble');

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v4 written:', fs.statSync(htmlPath).size, 'bytes');
