// Fix v2: strip Rig| prefix from clip names + convert PBR→Lambert in buildGLBInstance
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Strip animation name prefixes in buildGLBInstance ----
// Find the actions-building loop
const oldActionsLoop = `            for (const clip of parsed.animations) {
                actions[clip.name] = mixer.clipAction(clip);
            }`;
const newActionsLoop = `            for (const clip of parsed.animations) {
                // Strip common prefixes: Rig|, CharacterArmature|, Armature|
                // so Rig|Walk becomes Walk, Rig|Idle becomes Idle, etc.
                // The state machine and taunt system use unprefixed names.
                const cleanName = clip.name.replace(/^(Rig|CharacterArmature|Armature)\\|/, '');
                actions[cleanName] = mixer.clipAction(clip);
            }`;

if (html.includes('cleanName')) {
    console.log('  clip prefix strip already applied');
} else if (html.includes(oldActionsLoop)) {
    html = html.replace(oldActionsLoop, newActionsLoop);
    console.log('  clip names: strip Rig| prefix');
} else {
    console.error('  actions loop not found');
}

// ---- 2. Convert PBR→Lambert in buildGLBInstance's material clone ----
// Find the material cloning block in buildGLBInstance
const oldMatClone = `                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material = node.material.map(m => {
                                const c = m.clone();
                                c.flatShading = true;
                                c.needsUpdate = true;
                                return c;
                            });
                        } else {
                            node.material = node.material.clone();
                            node.material.flatShading = true;
                            node.material.needsUpdate = true;
                        }
                    }`;

const newMatClone = `                    if (node.material) {
                        // Convert PBR (StandardMaterial) → Lambert (matte)
                        // so imported characters match the world's flat look.
                        const toLambert = (m) => {
                            let c;
                            if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                                c = new THREE.MeshLambertMaterial({
                                    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
                                    map: m.map || null,
                                    transparent: m.transparent,
                                    opacity: m.opacity,
                                    side: m.side,
                                    skinning: true,
                                });
                            } else {
                                c = m.clone();
                            }
                            c.flatShading = true;
                            c.needsUpdate = true;
                            return c;
                        };
                        if (Array.isArray(node.material)) {
                            node.material = node.material.map(toLambert);
                        } else {
                            node.material = toLambert(node.material);
                        }
                    }`;

if (html.includes('toLambert')) {
    console.log('  PBR→Lambert already applied');
} else if (html.includes(oldMatClone)) {
    html = html.replace(oldMatClone, newMatClone);
    console.log('  buildGLBInstance: PBR → Lambert conversion added');
} else {
    console.error('  material clone block not found in buildGLBInstance');
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v2 fixed:', fs.statSync(htmlPath).size, 'bytes');
