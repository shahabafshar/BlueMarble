// v5 nature fix:
//   1. Convert StandardMaterial -> LambertMaterial in clone (matte, no spec)
//   2. Tint trees+bushes with the LEAFY material remapped to procedural greens
//      while keeping the trunk material's original brown
//   3. Bump campfire scale rule so it's a visible focal point
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Update _buildNatureClone to convert materials to Lambert ----
// Find the cloneAndConfig function inside _buildNatureClone
const oldCloneFn = `                    const cloneAndConfig = (m) => {
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
                    };`;

const newCloneFn = `                    const cloneAndConfig = (m) => {
                        // Convert PBR (StandardMaterial / PhysicalMaterial)
                        // to Lambert so the world stays uniformly matte.
                        // The GLB kit ships with shiny PBR materials by
                        // default; the rest of the world uses Lambert.
                        let c;
                        if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                            c = new THREE.MeshLambertMaterial({
                                color: m.color.clone(),
                                map: m.map || null,
                                transparent: m.transparent,
                                opacity: m.opacity,
                                side: m.side,
                            });
                        } else {
                            c = m.clone();
                        }
                        c.flatShading = true;
                        c.vertexColors = false;
                        // Per-material color remap. opts.colorRemap is a
                        // function (origColor, materialIdx) -> THREE.Color
                        // letting callers map specific source colors to a
                        // chosen palette (e.g. yellow leaves -> rich green
                        // while keeping the trunk brown unchanged).
                        if (opts.colorRemap) {
                            const remapped = opts.colorRemap(m.color);
                            if (remapped) c.color = remapped;
                        } else if (opts.tint) {
                            c.color = opts.tint.clone();
                        }
                        c.needsUpdate = true;
                        return c;
                    };`;

if (html.includes('isMeshStandardMaterial')) {
    console.log('  cloneAndConfig already updated');
} else if (html.includes(oldCloneFn)) {
    html = html.replace(oldCloneFn, newCloneFn);
    console.log('  cloneAndConfig: PBR->Lambert conversion + colorRemap added');
} else {
    console.error('  cloneAndConfig marker not found');
    process.exit(1);
}

// ---- 2. Add NATURE_PALETTE constant + update upgradeNatureToGLB to remap colors ----
// Find _natureParsed cache, inject palette right after
const paletteAnchor = 'const _natureParsed = {};';
const paletteBlock = `const _natureParsed = {};

        // Color palette to remap GLB tree/bush leaf colors. The Quaternius
        // FBX kit uses a single yellow-olive (#84a32e) for all foliage; we
        // remap it onto the richer green family the procedural lpTree used,
        // chosen randomly per instance for variety. Trunk material stays
        // unchanged. For rocks we still use obj._dominantColor (the procedural
        // zone color) since rocks don't have a separate trunk material.
        const NATURE_PALETTE = {
            // Source color the GLB uses for "leaves"
            sourceLeaf: new THREE.Color(0x84a32e),
            // Source color the GLB uses for "trunk/stem"
            sourceTrunk: new THREE.Color(0x321709),
            // Replacement leaf colors — derived from the original procedural
            // tree colors (#5cb85c, #6a9a4a, #2a7a35, #3a8a3a, #4aad5b)
            leafColors: [
                new THREE.Color(0x5cb85c),
                new THREE.Color(0x6a9a4a),
                new THREE.Color(0x2a7a35),
                new THREE.Color(0x3a8a3a),
                new THREE.Color(0x4aad5b),
            ],
        };
        function _isLeafyColor(c) {
            // Detect "leafy" by checking if green dominates the other channels
            return c.g > c.r && c.g > c.b * 1.2;
        }`;

if (html.includes('NATURE_PALETTE = {')) {
    console.log('  NATURE_PALETTE already present');
} else if (html.includes(paletteAnchor)) {
    html = html.replace(paletteAnchor, paletteBlock);
    console.log('  NATURE_PALETTE injected');
} else {
    console.error('  palette anchor not found');
    process.exit(1);
}

// ---- 3. Update upgrade pass: pass colorRemap for trees/bushes, tint for rocks ----
// Find the call to _buildNatureClone in upgradeNatureToGLB and replace
const oldCall = `                const replacement = _buildNatureClone(parsed, targetWorldY, {
                    tint: typeOpts.applyTint ? obj._dominantColor : null,
                    scaleVariance: typeOpts.scaleVariance,
                });`;
const newCall = `                // Pick a leaf color for this instance once (so all leaf
                // materials in the same tree share the same green).
                const instanceLeaf = NATURE_PALETTE.leafColors[
                    Math.floor(Math.random() * NATURE_PALETTE.leafColors.length)
                ];
                const buildOpts = { scaleVariance: typeOpts.scaleVariance };
                if (obj.type === 'rock') {
                    // Rocks: solid tint with the procedural zone color.
                    buildOpts.tint = obj._dominantColor;
                } else if (obj.type === 'tree' || obj.type === 'bush') {
                    // Trees/bushes: remap leafy material -> rich procedural
                    // green; keep trunk material untouched.
                    buildOpts.colorRemap = (origColor) => {
                        if (_isLeafyColor(origColor)) return instanceLeaf.clone();
                        return null;
                    };
                }
                const replacement = _buildNatureClone(parsed, targetWorldY, buildOpts);`;

if (html.includes('instanceLeaf')) {
    console.log('  upgrade call already updated');
} else if (html.includes(oldCall)) {
    html = html.replace(oldCall, newCall);
    console.log('  upgrade call updated to use colorRemap for trees/bushes');
} else {
    console.error('  upgrade call marker not found');
    process.exit(1);
}

// ---- 4. Bump campfire scale ----
// Find the campfire rule
const oldCampfire = `campfire:        { radius: 0.8, biomes: null,        solid: false, sink: 0.3, scale: 0.8  },`;
const newCampfire = `campfire:        { radius: 0.8, biomes: null,        solid: false, sink: 0.3, scale: 1.6  },`;
if (html.includes(newCampfire)) {
    console.log('  campfire scale already 1.6');
} else if (html.includes(oldCampfire)) {
    html = html.replace(oldCampfire, newCampfire);
    console.log('  campfire scale: 0.8 -> 1.6');
} else {
    console.error('  campfire rule not found');
    process.exit(1);
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  index.html written, size:', fs.statSync(htmlPath).size);
