// Fix nature v4: remove vertex jitter, disable tinting for trees/bushes
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Update TYPE_OPTS: zero vertexJitter on rocks, add `applyTint` flag
const start = html.indexOf('const TYPE_OPTS = {');
if (start < 0) { console.error('TYPE_OPTS not found'); process.exit(1); }
const end = html.indexOf('};', start) + 2;
const oldBlock = html.substring(start, end);
const newBlock = `const TYPE_OPTS = {
                // Rocks: GLB native color (#1f1f1f) is too dark; we tint
                // them with the procedural zone color (#a09880 desert,
                // #8a8a98 snowy etc). NO vertex jitter — the GLB rocks
                // have native vertex coords at ~0.01 scale, so jitter
                // mangles the silhouette. Variation comes from 3 source
                // shapes + scale variance + Y rotation.
                rock:  { tuning: 0.55, applyTint: true,  scaleVariance: 0.22 },
                // Trees: keep ALL native materials (leaves AND trunk).
                // Tinting was overwriting the trunk brown with leaf green.
                tree:  { tuning: 1.10, applyTint: false, scaleVariance: 0.15 },
                // Bushes: same — they have leafy + stem materials.
                bush:  { tuning: 0.85, applyTint: false, scaleVariance: 0.18 },
            }`;

if (html.includes('applyTint: true')) {
    console.log('  TYPE_OPTS already updated');
} else {
    html = html.substring(0, start) + newBlock + ';' + html.substring(end);
    console.log('  TYPE_OPTS updated');
}

// ---- 2. Update upgradeNatureToGLB to honor applyTint ----
const tintLine = `                    tint: obj._dominantColor,`;
const newTintLine = `                    tint: typeOpts.applyTint ? obj._dominantColor : null,`;
if (html.includes(newTintLine)) {
    console.log('  tint guard already in place');
} else if (html.includes(tintLine)) {
    html = html.replace(tintLine, newTintLine);
    console.log('  upgrade pass now honors applyTint');
} else {
    console.error('  tint marker not found');
    process.exit(1);
}

// ---- 3. Remove vertexJitter line from upgrade call ----
const jitterLine = `                    vertexJitter: typeOpts.vertexJitter,`;
if (html.includes(jitterLine)) {
    html = html.replace(jitterLine + '\n', '');
    console.log('  removed vertexJitter from upgrade call');
} else {
    console.log('  vertexJitter line already removed');
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  index.html written, size:', fs.statSync(htmlPath).size);
