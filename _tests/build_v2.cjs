// Transform index.v2.html:
//   1. Strip ALL <script type="text/plain" id="*-glb-b64"> blocks
//   2. Replace parseGLBOnce with a CDN-fetch version
//   3. Replace MC_CHARACTERS entries with CDN URLs
//   4. Replace NPC upgrade to use CDN character pool
//   5. Replace nature upgrade to use CDN nature URLs
//   6. Replace fox upgrade to use CDN animal URL
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

console.log('  original size:', html.length);

// ---- 1. Strip ALL inlined GLB base64 blocks ----
const before = html.length;
html = html.replace(/<script type="text\/plain" id="[^"]*-glb-b64">[A-Za-z0-9+/=\s]*<\/script>\s*/g, '');
const after = html.length;
console.log('  stripped', (before - after), 'bytes of base64 (' + ((before-after)/1024/1024).toFixed(1) + ' MB)');

// ---- 2. Replace parseGLBOnce with CDN-fetch version ----
// Find the existing parseGLBOnce function
const parseStart = html.indexOf('function parseGLBOnce(');
if (parseStart < 0) { console.error('  parseGLBOnce not found'); process.exit(1); }
// Find the end of this function (next function declaration at same indent)
const parseEnd = html.indexOf('\n\n        // Build a', parseStart);
if (parseEnd < 0) { console.error('  parseGLBOnce end not found'); process.exit(1); }

const newParseGLB = `function parseGLBOnce(urlOrId, callback) {
            // v2: fetches from a URL (CDN or relative path).
            // Falls back to reading an inlined <script> block if the
            // argument looks like a DOM id (for v1 compat / file://).
            if (_parsedGLBCache[urlOrId]) { callback(_parsedGLBCache[urlOrId]); return; }

            // If it looks like a URL, fetch it
            if (urlOrId.startsWith('http') || urlOrId.startsWith('/') || urlOrId.startsWith('.')) {
                fetch(urlOrId)
                    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
                    .then(buf => {
                        const loader = new THREE.GLTFLoader();
                        if (typeof THREE.DRACOLoader === 'function') {
                            const draco = new THREE.DRACOLoader();
                            draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                            loader.setDRACOLoader(draco);
                        }
                        loader.parse(buf, '', (gltf) => {
                            const result = { scene: gltf.scene, animations: gltf.animations };
                            _parsedGLBCache[urlOrId] = result;
                            callback(result);
                        }, (err) => {
                            console.warn('[glb] parse error for ' + urlOrId + ':', err);
                            callback(null);
                        });
                    })
                    .catch(err => {
                        console.warn('[glb] fetch failed for ' + urlOrId + ':', err.message);
                        callback(null);
                    });
                return;
            }

            // Legacy: try reading from an inlined <script> block (v1 compat / file://)
            const dataNode = document.getElementById(urlOrId);
            if (!dataNode || !THREE.GLTFLoader) { callback(null); return; }
            try {
                const b64 = dataNode.textContent.replace(/\\s/g, '');
                const binStr = atob(b64);
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                const loader = new THREE.GLTFLoader();
                if (typeof THREE.DRACOLoader === 'function') {
                    const draco = new THREE.DRACOLoader();
                    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                    loader.setDRACOLoader(draco);
                }
                loader.parse(bytes.buffer, '', (gltf) => {
                    const result = { scene: gltf.scene, animations: gltf.animations };
                    _parsedGLBCache[urlOrId] = result;
                    callback(result);
                }, (err) => {
                    console.error('[glb] parse error for ' + urlOrId + ':', err);
                    callback(null);
                });
            } catch (e) {
                console.error('[glb] error for ' + urlOrId + ':', e);
                callback(null);
            }
        }`;

html = html.substring(0, parseStart) + newParseGLB + html.substring(parseEnd);
console.log('  parseGLBOnce replaced with CDN-fetch version');

// ---- 3. Replace MC_CHARACTERS with CDN URLs ----
const mcStart = html.indexOf('const MC_CHARACTERS = [');
if (mcStart < 0) { console.error('  MC_CHARACTERS not found'); process.exit(1); }
const mcEnd = html.indexOf('];', mcStart) + 2;

const newMC = `const MC_CHARACTERS = [
            // v2: All characters loaded from Poly Pizza CDN (CC0 Quaternius)
            // Men Pack (24 animations each: idle, walk, run, jump, dance, sit, crouch, etc.)
            { id: 'https://static.poly.pizza/bbe369ee-a686-42c7-adad-14356f5f2f15.glb', name: 'Adventurer',     heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/90a9e2d4-053f-42f1-99a2-8f5e1180ea7f.glb', name: 'Casual',         heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/bcd66ec5-5e81-4901-a222-47abc875fe2a.glb', name: 'Hoodie',         heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/e56f23b5-3270-406f-8924-f77cad980c43.glb', name: 'Punk',           heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/29a3436b-3b06-4dbf-a236-bcec18f3351a.glb', name: 'King',           heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/81f2f0cf-6f53-4b57-92ea-dba0928620f2.glb', name: 'Farmer',         heightFactor: 1.00 },
            // Women Pack
            { id: 'https://static.poly.pizza/69689495-028d-4b81-8678-792338a5693e.glb', name: 'Adventurer W',   heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/1d368679-1d9a-4d5c-9095-877144b02d00.glb', name: 'Punk W',         heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/66a55d04-4286-44a3-b289-0d774c27db5b.glb', name: 'Soldier W',      heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/a43d6661-8a89-4818-a7eb-40e1e8430a4c.glb', name: 'Witch',          heightFactor: 1.00 },
            { id: 'https://static.poly.pizza/3186b8e9-afd5-4d48-846c-b2b530cd23e2.glb', name: 'Hooded',         heightFactor: 1.00 },
            // Compact character (smallest file, good default)
            { id: 'https://static.poly.pizza/906e29d9-2e15-4c5c-a38a-fb99023acc9c.glb', name: 'Platformer',     heightFactor: 1.00 },
        ]`;

html = html.substring(0, mcStart) + newMC + ';' + html.substring(mcEnd);
console.log('  MC_CHARACTERS replaced with 12 CDN entries');

// ---- 4. Replace NPC character pool URL ----
// Find the robot archetype reference in loadGLBCharacter
const npcRobotLine = "parseGLBOnce('character-glb-b64',";
const npcRobotIdx = html.indexOf(npcRobotLine);
if (npcRobotIdx >= 0) {
    // Replace with the Platformer CDN URL (smallest, has idle/walk/wave)
    html = html.replace(npcRobotLine,
        "parseGLBOnce('https://static.poly.pizza/906e29d9-2e15-4c5c-a38a-fb99023acc9c.glb',");
    console.log('  NPC archetype → CDN Platformer');
}

// ---- 5. Replace nature GLB IDs with CDN URLs ----
const natureIdsStart = html.indexOf('const NATURE_IDS = {');
if (natureIdsStart >= 0) {
    const natureIdsEnd = html.indexOf('};', natureIdsStart) + 2;
    const newNatureIds = `const NATURE_IDS = {
            // v2: Nature from Poly Pizza CDN (Stylized Nature MegaKit)
            rock:  [
                'https://static.poly.pizza/802d6e7e-73a5-4a54-8848-54ae9350077c.glb',  // Pebble
                'https://static.poly.pizza/de15e8eb-53a1-4e7e-a4c5-fc2299f57158.glb',  // Rock (Fantasy)
            ],
            tree:  [
                'https://static.poly.pizza/c55b8641-4679-4a85-8bd8-2a20e79abecd.glb',  // Pine
                'https://static.poly.pizza/229336e6-4632-4bc7-af2e-ec1f3c8245f7.glb',  // Twisted Tree
                'https://static.poly.pizza/4db29f97-8e10-413d-be54-39ecda1a7c8d.glb',  // Dead Tree
            ],
            bush:  [
                'https://static.poly.pizza/b81bea53-a5a8-4c01-a43c-e1f6a3d5d170.glb',  // Grass Wispy
            ],
            grass: [],
        }`;
    html = html.substring(0, natureIdsStart) + newNatureIds + html.substring(natureIdsEnd);
    console.log('  NATURE_IDS replaced with CDN URLs');
}

// ---- 6. Replace fox GLB ID with CDN animal URL ----
const foxLine = "parseGLBOnce('fox-glb-b64',";
if (html.includes(foxLine)) {
    // Use Quaternius Sheep from Farm Pack as the animal
    html = html.replace(foxLine,
        "parseGLBOnce('https://static.poly.pizza/a4bd2c4e-fe71-4dbd-9881-cf3ac8a00bbf.glb',");
    console.log('  fox/animal archetype → CDN Sheep');
}

// ---- 7. Add title marker so you know it's v2 ----
html = html.replace('<title>Blue Marble - Explore the Little Planet</title>',
    '<title>[v2] Blue Marble - Explore the Little Planet</title>');

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v2 written:', fs.statSync(htmlPath).size, 'bytes (' + (fs.statSync(htmlPath).size/1024).toFixed(0) + ' KB)');
