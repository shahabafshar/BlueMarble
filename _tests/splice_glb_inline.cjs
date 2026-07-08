// Self-contained tool to inline (or update) a base64-embedded GLB inside
// index.html as an inert <script type="text/plain" id="..."> block.
//
// Usage:
//   node _tests/splice_glb_inline.cjs <path-to-glb> [script-id]
//
// If [script-id] is omitted, defaults to 'character-glb-b64' (the player).
// If a block with that id already exists, it's replaced. Otherwise a new
// block is inserted right before the closing </body> tag.
//
// Run (from _tests/): node splice_glb_inline.cjs <path-to-glb> [script-id]
// Expected output: index.html is rewritten in place with the new base64
// block and the tool prints the encoded size. A swapped-in player model
// must expose clips named Idle/Walking/Running/Jump (or update the name
// lookups in animChar); verify the result with: node glbtest.cjs.
const fs = require('fs');
const path = require('path');

const glbArg = process.argv[2];
const scriptId = process.argv[3] || 'character-glb-b64';
if (!glbArg) {
    console.error('usage: node splice_glb_inline.cjs <path-to-glb> [script-id]');
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
console.log('GLB:', glbPath, '(' + fs.statSync(glbPath).size + ' bytes) -> id=' + scriptId);

let html = fs.readFileSync(htmlPath, 'utf8');
const tag = '<script type="text/plain" id="' + scriptId + '">' + b64 + '</script>';

// Match an existing block with this exact id
const escapedId = scriptId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp('<script type="text\\/plain" id="' + escapedId + '">[A-Za-z0-9+/=\\s]*<\\/script>');
if (re.test(html)) {
    html = html.replace(re, tag);
    console.log('replaced existing block');
} else if (html.includes('</body>')) {
    html = html.replace('</body>', '    ' + tag + '\n</body>');
    console.log('inserted new block before </body>');
} else {
    console.error('no </body> tag found and no existing block; aborting');
    process.exit(1);
}

fs.writeFileSync(htmlPath, html);
console.log('index.html size:', fs.statSync(htmlPath).size);
