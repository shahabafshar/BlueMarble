const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v3.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// Find and replace from 'function updateCameraOcclusion' to 'function animate'
const fnStart = html.indexOf('function updateCameraOcclusion() {');
const animateStart = html.indexOf('function animate()', fnStart);
if (fnStart < 0 || animateStart < 0) {
    console.error('markers not found', fnStart, animateStart);
    process.exit(1);
}

// Walk back from animateStart to find the line start
let insertPoint = animateStart;
while (insertPoint > 0 && html[insertPoint - 1] !== '\n') insertPoint--;

const newCode = `let _occFrame = 0;
        let _occCandidates = [];

        function updateCameraOcclusion() {
            var camPos = camera.position;
            var charPos = character.position;
            var mainDir = charPos.clone().sub(camPos);
            var dist = mainDir.length();
            if (dist < 0.5) return;
            mainDir.normalize();

            var up = new THREE.Vector3(0, 1, 0);
            var right = new THREE.Vector3().crossVectors(mainDir, up).normalize();
            var spread = 0.18;
            var rays = [
                mainDir.clone(),
                mainDir.clone().add(right.clone().multiplyScalar(spread)).normalize(),
                mainDir.clone().add(right.clone().multiplyScalar(-spread)).normalize(),
                mainDir.clone().add(up.clone().multiplyScalar(spread * 0.7)).normalize(),
                mainDir.clone().add(up.clone().multiplyScalar(-spread * 0.7)).normalize(),
            ];

            // Rebuild candidate list periodically
            _occFrame++;
            if (_occFrame % 30 === 1 || _occCandidates.length === 0) {
                _occCandidates = [];
                scene.traverse(function(n) {
                    if (!n.isMesh) return;
                    if (n === planet) return;
                    // Skip character's own meshes
                    var par = n.parent;
                    while (par) { if (par === character) return; par = par.parent; }
                    _occCandidates.push(n);
                });
            }

            if (_occCandidates.length === 0) return;

            var newSet = new Set();
            for (var r = 0; r < rays.length; r++) {
                _occRay.set(camPos, rays[r]);
                _occRay.far = dist - 0.2;
                var hits = _occRay.intersectObjects(_occCandidates, false);
                for (var h = 0; h < hits.length; h++) {
                    if (hits[h].object && hits[h].object.material) {
                        newSet.add(hits[h].object);
                    }
                }
            }

            // Fade all blocking meshes
            newSet.forEach(function(m) {
                if (_occluded.has(m)) return;
                var mats = Array.isArray(m.material) ? m.material : [m.material];
                for (var i = 0; i < mats.length; i++) {
                    mats[i]._sOp = mats[i].opacity;
                    mats[i]._sTr = mats[i].transparent;
                    mats[i]._sDw = mats[i].depthWrite;
                    mats[i].transparent = true;
                    mats[i].opacity = 0.08;
                    mats[i].depthWrite = false;
                    mats[i].needsUpdate = true;
                }
            });

            // Restore cleared meshes
            _occluded.forEach(function(m) {
                if (newSet.has(m)) return;
                if (!m.material) return;
                var mats = Array.isArray(m.material) ? m.material : [m.material];
                for (var i = 0; i < mats.length; i++) {
                    if (mats[i]._sOp !== undefined) mats[i].opacity = mats[i]._sOp;
                    if (mats[i]._sTr !== undefined) mats[i].transparent = mats[i]._sTr;
                    if (mats[i]._sDw !== undefined) mats[i].depthWrite = mats[i]._sDw;
                    mats[i].needsUpdate = true;
                }
            });

            _occluded.clear();
            newSet.forEach(function(m) { _occluded.add(m); });
        }

        `;

html = html.substring(0, fnStart) + newCode + html.substring(insertPoint);

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('occlusion rewritten cleanly');
