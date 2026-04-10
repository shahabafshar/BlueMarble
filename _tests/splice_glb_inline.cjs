// Self-contained tool to swap the inlined GLB character in index.html.
//
// Usage:  node _tests/splice_glb_inline.cjs path/to/character.glb
//
// Reads the given .glb, base64-encodes it, and rewrites the
// <script type="text/plain" id="character-glb-b64">...</script>
// block in index.html. No assets/ folder required — the model lives
// inside index.html for true single-file distribution.
const fs = require('fs');
const path = require('path');

const glbArg = process.argv[2];
if (!glbArg) {
    console.error('usage: node splice_glb_inline.cjs <path-to-glb>');
    process.exit(1);
}
const glbPath = path.resolve(glbArg);
if (!fs.existsSync(glbPath)) {
    console.error('file not found:', glbPath);
    process.exit(1);
}

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');

const b64 = fs.readFileSync(glbPath).toString('base64');
console.log('GLB:', glbPath, '(' + fs.statSync(glbPath).size + ' bytes)');
console.log('base64 length:', b64.length);

let html = fs.readFileSync(htmlPath, 'utf8');

const re = /<script type="text\/plain" id="character-glb-b64">[A-Za-z0-9+/=\s]*<\/script>/;
if (!re.test(html)) {
    console.error('could not find inlined GLB script block in index.html');
    process.exit(1);
}
html = html.replace(re, '<script type="text/plain" id="character-glb-b64">' + b64 + '</script>');
fs.writeFileSync(htmlPath, html);
console.log('index.html size:', fs.statSync(htmlPath).size);
console.log('done.');
