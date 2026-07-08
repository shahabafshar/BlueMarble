// Rewrite a GLB so that every external `images[].uri` becomes an inlined
// `data:image/png;base64,...` URI. This removes external fetch dependencies
// so the GLB is fully self-contained (required for our file:// distribution).
//
// Usage:  node _tests/embed_glb_textures.cjs <input.glb> <output.glb> <texture-dir>
//
// Textures are looked up at <texture-dir>/<uri>. For Kenney's starter kits
// the uri is 'Textures/colormap.png' and <texture-dir> is the folder where
// you downloaded the colormap.
//
// How it works:
//   1. Parse the GLB header and extract the JSON chunk + BIN chunk
//   2. For each image with an external uri, read the file, convert to
//      data URI, and replace uri in the JSON
//   3. Re-pad the JSON chunk to a multiple of 4 bytes (GLB spec)
//   4. Write out a new GLB with the rewritten JSON + same BIN chunk
const fs = require('fs');
const path = require('path');

const [,, inPath, outPath, textureDir] = process.argv;
if (!inPath || !outPath || !textureDir) {
    console.error('usage: node embed_glb_textures.cjs <input.glb> <output.glb> <texture-dir>');
    process.exit(1);
}

const buf = fs.readFileSync(inPath);

// --- Parse GLB container ---
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) { console.error('not a GLB file'); process.exit(1); }
const version = buf.readUInt32LE(4);
const totalLen = buf.readUInt32LE(8);
const jsonChunkLen = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16); // should be 'JSON' = 0x4e4f534a
const jsonStart = 20;
const jsonEnd = jsonStart + jsonChunkLen;
const jsonStr = buf.slice(jsonStart, jsonEnd).toString('utf8');
const json = JSON.parse(jsonStr);

const binChunkLen = buf.readUInt32LE(jsonEnd);
const binChunkType = buf.readUInt32LE(jsonEnd + 4); // should be 'BIN\0' = 0x004e4942
const binStart = jsonEnd + 8;
const binBytes = buf.slice(binStart, binStart + binChunkLen);

// --- Rewrite images[].uri ---
let rewritten = 0;
for (const img of (json.images || [])) {
    if (!img.uri || img.uri.startsWith('data:')) continue;
    const texPath = path.join(textureDir, img.uri);
    if (!fs.existsSync(texPath)) {
        console.error('  MISSING TEXTURE:', texPath);
        continue;
    }
    const texBytes = fs.readFileSync(texPath);
    const mime = img.uri.endsWith('.jpg') || img.uri.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    img.uri = 'data:' + mime + ';base64,' + texBytes.toString('base64');
    rewritten++;
    console.log('  inlined ' + texPath + ' (' + texBytes.length + 'B)');
}
console.log('  rewrote ' + rewritten + ' image uri(s)');

// --- Write new GLB ---
let newJsonStr = JSON.stringify(json);
// Pad to multiple of 4 with trailing spaces (required by GLB spec)
while (newJsonStr.length % 4 !== 0) newJsonStr += ' ';
const newJsonBytes = Buffer.from(newJsonStr, 'utf8');
const newTotalLen = 12 + 8 + newJsonBytes.length + 8 + binBytes.length;
const out = Buffer.alloc(newTotalLen);
// Header
out.writeUInt32LE(0x46546c67, 0);   // magic
out.writeUInt32LE(version, 4);       // version
out.writeUInt32LE(newTotalLen, 8);   // total length
// JSON chunk
out.writeUInt32LE(newJsonBytes.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);   // 'JSON'
newJsonBytes.copy(out, 20);
// BIN chunk
const binHeaderOffset = 20 + newJsonBytes.length;
out.writeUInt32LE(binChunkLen, binHeaderOffset);
out.writeUInt32LE(0x004e4942, binHeaderOffset + 4);
binBytes.copy(out, binHeaderOffset + 8);

fs.writeFileSync(outPath, out);
console.log('  wrote ' + outPath + ' (' + out.length + 'B)');
