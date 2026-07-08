// v4 phase 2:
//   1. Campfire stone variation
//   2. Fantasy RTS items in zones
//   3. Moon with Castle 1234
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'index.v4.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const wasCRLF = html.includes('\r\n');
if (wasCRLF) html = html.replace(/\r\n/g, '\n');

// ---- 1. Campfire stone variation ----
// Find mkCampfire and modify the stone ring to have random size/offset
const oldStoneRing = `            // Ring of rocks
            for(let i=0;i<7;i++){const a=(i/7)*Math.PI*2;
                g.add(M(new THREE.Mesh(new THREE.DodecahedronGeometry(.15,0),LM(0x777770)),
                    {position:new THREE.Vector3(Math.cos(a)*.4,0.08,Math.sin(a)*.4)}));}`;

const newStoneRing = `            // Ring of rocks — each stone slightly different size/shape/position
            for(let i=0;i<7;i++){const a=(i/7)*Math.PI*2;
                const stoneR = 0.12 + Math.random() * 0.08;  // 0.12-0.20 radius
                const stoneGeo = new THREE.DodecahedronGeometry(stoneR, 0);
                // Slight vertex deformation for unique silhouette
                const sp = stoneGeo.getAttribute('position');
                for(let j=0;j<sp.count;j++) sp.setXYZ(j,
                    sp.getX(j)+(Math.random()-.5)*stoneR*.3,
                    sp.getY(j)+(Math.random()-.5)*stoneR*.2,
                    sp.getZ(j)+(Math.random()-.5)*stoneR*.3);
                stoneGeo.computeVertexNormals();
                // Vary color slightly: gray-brown spectrum
                const shade = 0x60 + Math.floor(Math.random() * 0x20);
                const stoneColor = (shade << 16) | (shade - 8 << 8) | (shade - 16);
                const stone = new THREE.Mesh(stoneGeo, LM(stoneColor));
                const ringR = 0.35 + Math.random() * 0.1;
                const yOff = 0.05 + Math.random() * 0.06;
                stone.position.set(Math.cos(a)*ringR, yOff, Math.sin(a)*ringR);
                stone.rotation.set(Math.random()*.4, Math.random()*Math.PI*2, Math.random()*.4);
                g.add(stone);}`;

if (html.includes('stoneR = 0.12')) {
    console.log('  campfire stones already varied');
} else if (html.includes(oldStoneRing)) {
    html = html.replace(oldStoneRing, newStoneRing);
    console.log('  1. Campfire stones: random size, shape, color, rotation');
} else {
    console.log('  WARNING: campfire stone marker not found');
}

// ---- 2. Fantasy RTS items + more CDN objects ----
// Add CDN URLs for fantasy items
const cdnAnchor = "            'flowerpot':  'https://static.poly.pizza/a4099037-d834-455a-b706-d7878b039ceb.glb',";
const cdnFantasy = cdnAnchor + `
            // v4 phase 2: Fantasy RTS + additional items
            'marktstall':  'https://static.poly.pizza/e5bf8ed1-969f-424b-924a-a7aea1d92d9a.glb',
            'hut':         'https://static.poly.pizza/36d65045-d2ff-4689-a34d-a4acbe1873cb.glb',
            'fortress':    'https://static.poly.pizza/c3ccd51c-0343-4237-83f4-0bc0183911d6.glb',
            'port':        'https://static.poly.pizza/27270a0e-cb71-40f7-91b1-1421ab9b17b9.glb',
            'villagemkt':  'https://static.poly.pizza/d99b4be3-5157-4dda-b308-ad77acbe8801.glb',`;

if (html.includes("'marktstall':")) {
    console.log('  fantasy CDN already added');
} else if (html.includes(cdnAnchor)) {
    html = html.replace(cdnAnchor, cdnFantasy);
    console.log('  2a. Added 5 fantasy CDN objects');
}

// Add ABS_HEIGHT
const absAnchor = '                        flowerpot: 0.7,';
const absFantasy = absAnchor + `
                        marktstall: 3.5,
                        hut: 5,
                        fortress: 10,
                        port: 4,
                        villagemkt: 4,`;
if (html.includes('marktstall: 3.5')) {
    console.log('  fantasy ABS_HEIGHT already added');
} else if (html.includes(absAnchor)) {
    html = html.replace(absAnchor, absFantasy);
    console.log('  2b. Added ABS_HEIGHT for fantasy items');
}

// Add ObjectRules for fantasy types
const rulesAnchor = "            barrel:         { radius: 0.5,";
const rulesFantasy = `            marktstall:     { radius: 2.5, biomes: null,        solid: true,  sink: 0.1, scale: 0.8 },
            hut:            { radius: 3.0, biomes: [5,6],       solid: true,  sink: 0.2, scale: 0.9 },
            fortress:       { radius: 5.0, biomes: null,        solid: true,  sink: 0.3, scale: 1.0 },
            port:           { radius: 4.0, biomes: [6],         solid: true,  sink: 0.15, scale: 0.8 },
            villagemkt:     { radius: 3.0, biomes: [1,2],       solid: false, sink: 0.1, scale: 0.8 },
            barrel:         { radius: 0.5,`;

if (html.includes("marktstall:     {")) {
    console.log('  fantasy rules already added');
} else if (html.includes(rulesAnchor)) {
    html = html.replace(rulesAnchor, rulesFantasy);
    console.log('  2c. Added ObjectRules for fantasy items');
}

// Place fantasy items in appropriate zones
// Pyramid zone — market stalls fit an Egyptian bazaar
const zone1anchor = "        // ZONE 2: Mediterranean Village";
const zone1new = `        // v4: Desert market stalls near pyramids
        place('marktstall', 'structure', mkCDNPlaceholder, 14, -22);
        place('marktstall', 'structure', mkCDNPlaceholder, 10, -28);

        // ZONE 2: Mediterranean Village`;
if (html.includes('Desert market stalls')) {
    console.log('  zone 1 fantasy already placed');
} else if (html.includes(zone1anchor)) {
    html = html.replace(zone1anchor, zone1new);
    console.log('  2d. Added market stalls to pyramid zone');
}

// Mediterranean — village market
const zone2anchor = "        place('flag', 'furniture', mkCDNPlaceholder, 35, 62);";
const zone2new = zone2anchor + `
        place('villagemkt', 'structure', mkCDNPlaceholder, 31, 70);`;
if (html.includes("'villagemkt', 'structure', mkCDNPlaceholder, 31, 70")) {
    console.log('  zone 2 village market already placed');
} else if (html.includes(zone2anchor)) {
    html = html.replace(zone2anchor, zone2new);
    console.log('  2e. Added village market to Mediterranean');
}

// Jungle — hut
const zone8anchor = "        placeNPC(0xaa7744,3, 4,93);";
const zone8new = zone8anchor + `
        // v4: Jungle huts
        place('hut', 'structure', mkCDNPlaceholder, 8, 88);
        place('hut', 'structure', mkCDNPlaceholder, 5, 95);`;
if (html.includes('Jungle huts')) {
    console.log('  zone 8 huts already placed');
} else if (html.includes(zone8anchor)) {
    html = html.replace(zone8anchor, zone8new);
    console.log('  2f. Added huts to jungle zone');
}

// Castle zone — fortress wall segment
const zone3anchor = "        place('barrel', 'furniture', mkCDNPlaceholder, 44, -119);";
const zone3new = zone3anchor + `
        place('fortress', 'structure', mkCDNPlaceholder, 48, -116);`;
if (html.includes("'fortress', 'structure', mkCDNPlaceholder, 48")) {
    console.log('  zone 3 fortress already placed');
} else if (html.includes(zone3anchor)) {
    html = html.replace(zone3anchor, zone3new);
    console.log('  2g. Added fortress wall to castle zone');
}

// Lighthouse — port
const zone5anchor = "        place('barrel', 'furniture', mkCDNPlaceholder, 21, 143);";
const zone5new = zone5anchor + `
        place('port', 'structure', mkCDNPlaceholder, 19, 148);`;
if (html.includes("'port', 'structure', mkCDNPlaceholder, 19")) {
    console.log('  zone 5 port already placed');
} else if (html.includes(zone5anchor)) {
    html = html.replace(zone5anchor, zone5new);
    console.log('  2h. Added port to lighthouse zone');
}

// ---- 3. MOON with Castle 1234 ----
// Find the clouds section and add the moon right after
const cloudsEnd = html.indexOf('// ============================================================\n        // VEGETATION');
if (cloudsEnd < 0) {
    console.log('  WARNING: clouds/vegetation boundary not found for moon insertion');
} else {
    if (html.includes('moonGroup')) {
        console.log('  moon already present');
    } else {
        const moonCode = `
        // ============================================================
        // MOON — a fantasy mini-planet orbiting Blue Marble
        // ============================================================
        const moonGroup = new THREE.Group();
        scene.add(moonGroup);
        const MOON_R = 25;           // moon radius
        const MOON_ORBIT = PR * 3.5;  // distance from planet center
        const MOON_SPEED = 0.015;     // radians per second

        // Moon sphere — rocky gray with slight noise displacement
        const moonGeo = new THREE.IcosahedronGeometry(MOON_R, 4);
        const moonPosAttr = moonGeo.getAttribute('position');
        const moonV = new THREE.Vector3();
        for (let i = 0; i < moonPosAttr.count; i++) {
            moonV.set(moonPosAttr.getX(i), moonPosAttr.getY(i), moonPosAttr.getZ(i));
            const dir = moonV.clone().normalize();
            // Gentle craters/hills
            const disp = MOON_R + fbm(dir.x*2, dir.y*2, dir.z*2, 3) * MOON_R * 0.08;
            moonV.copy(dir.multiplyScalar(disp));
            moonPosAttr.setXYZ(i, moonV.x, moonV.y, moonV.z);
        }
        moonGeo.computeVertexNormals();
        const moonMesh = new THREE.Mesh(moonGeo, new THREE.MeshLambertMaterial({
            color: 0xb8b0a8, flatShading: true
        }));
        moonMesh.castShadow = true;
        moonMesh.receiveShadow = true;
        moonGroup.add(moonMesh);

        // Castle 1234 on top of the moon — loaded from CDN
        const MOON_CASTLE_URL = 'https://static.poly.pizza/3d4ba088-9759-4c61-8428-e287fdb331be.glb';
        parseGLBOnce(MOON_CASTLE_URL, function(parsed) {
            if (!parsed) { console.warn('[moon] castle failed to load'); return; }
            const castle = parsed.scene.clone(true);
            castle.traverse(function(n) {
                if (!n.isMesh) return;
                n.castShadow = true;
                if (n.material) {
                    const convert = function(m) {
                        if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                            return new THREE.MeshLambertMaterial({
                                color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
                                map: m.map || null,
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
            // Scale castle to ~30% of moon diameter
            const cBox = new THREE.Box3().setFromObject(castle);
            const cSize = new THREE.Vector3();
            cBox.getSize(cSize);
            const targetH = MOON_R * 0.6;  // 30% of diameter
            if (cSize.y > 0.001) castle.scale.setScalar(targetH / cSize.y);
            // Position on top of moon (north pole)
            const cBox2 = new THREE.Box3().setFromObject(castle);
            castle.position.set(0, MOON_R + 0.5, 0);
            castle.position.y -= cBox2.min.y * castle.scale.y;
            moonGroup.add(castle);
            console.log('[moon] Castle 1234 placed on moon');
        });

        // Moon orbit position — updated each frame in animate loop
        moonGroup.position.set(MOON_ORBIT, MOON_ORBIT * 0.3, 0);

`;
        html = html.substring(0, cloudsEnd) + moonCode + html.substring(cloudsEnd);
        console.log('  3. Moon created with Castle 1234');
    }
}

// Add moon orbit animation in the animate loop
const animateWorldAnchor = '            for(const b of windmills)';
const moonAnimate = `            // Moon orbit
            if (typeof moonGroup !== 'undefined') {
                const moonAngle = performance.now() * 0.001 * MOON_SPEED;
                moonGroup.position.set(
                    Math.cos(moonAngle) * MOON_ORBIT,
                    Math.sin(moonAngle * 0.3) * MOON_ORBIT * 0.15,
                    Math.sin(moonAngle) * MOON_ORBIT
                );
                // Slow self-rotation
                moonGroup.rotation.y += 0.001;
            }
            for(const b of windmills)`;

if (html.includes('Moon orbit')) {
    console.log('  moon animation already present');
} else if (html.includes(animateWorldAnchor)) {
    html = html.replace(animateWorldAnchor, moonAnimate);
    console.log('  3b. Moon orbit animation added to animate loop');
}

// ---- title ----
if (!html.includes('[v4]')) {
    html = html.replace('[v3] Blue Marble', '[v4] Blue Marble');
}

if (wasCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync(htmlPath, html);
console.log('  v4 phase 2 done:', fs.statSync(htmlPath).size, 'bytes');
