/**
 * Visual ground adherence test.
 *
 * The REAL question: how far are the character's FEET from the
 * RENDERED mesh surface? Not from groundHeight() — from the actual
 * flat triangle face that the player sees.
 *
 * To measure this, we:
 * 1. Generate the actual planet mesh vertices (same as the game)
 * 2. Build triangle faces
 * 3. Walk the character along a path
 * 4. At each step, find the nearest triangle below the character
 * 5. Measure the distance from feet to that triangle
 *
 * This is what the player's eyes see.
 */

import { createNoise3D } from 'simplex-noise';

const n3 = createNoise3D();
const PR = 50;
const DETAIL = 7;
const CH = 1.8;
const MAX_WALK = 0.6;
const WALK_ACCEL = 0.1;
const GROUND_DRAG = 0.88;

function fbm(x,y,z,o=4){ let v=0,a=.5,f=1; for(let i=0;i<o;i++){v+=a*n3(x*f,y*f,z*f);a*=.5;f*=2;} return v; }
function getBiome(nx,ny,nz){
    const e=fbm(nx*1.5,ny*1.5,nz*1.5,4);
    const m=fbm(nx*2+100,ny*2+100,nz*2+100,3);
    const t=ny*0.7+n3(nx*0.8+50,ny*0.8,nz*0.8+50)*0.5;
    if(e<-0.15)return{type:0,name:'Ocean',elevation:e};
    if(e<-0.05)return{type:6,name:'Beach',elevation:e};
    if(t<-0.3)return{type:4,name:'Snow',elevation:e};
    if(t>0.4&&m<-0.1)return{type:3,name:'Desert',elevation:e};
    if(t>0.2&&m>0.2)return{type:5,name:'Jungle',elevation:e};
    if(m>0.1)return{type:2,name:'Forest',elevation:e};
    return{type:1,name:'Grass',elevation:e};
}
function groundHeight(nx,ny,nz){
    const b=getBiome(nx,ny,nz);const e=b.elevation;
    const t=Math.max(0,Math.min(1,(e+0.2)/0.2));const s=t*t*(3-2*t);
    return PR-0.5+s*(Math.max(0,e+0.15)*2.5+0.5+n3(nx*8,ny*8,nz*8)*0.06);
}

// Vec3 helpers
function normalize(x,y,z){const l=Math.sqrt(x*x+y*y+z*z);return[x/l,y/l,z/l];}
function len(x,y,z){return Math.sqrt(x*x+y*y+z*z);}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function scale(v,s){return[v[0]*s,v[1]*s,v[2]*s];}

// =====================================================================
// STEP 1: Generate the actual mesh vertices
// Replicate Three.js IcosahedronGeometry vertex generation
// =====================================================================
console.log('Building planet mesh (detail ' + DETAIL + ')...');

// Start with icosahedron base
const t2 = (1 + Math.sqrt(5)) / 2;
let vertices = [
    [-1,t2,0],[1,t2,0],[-1,-t2,0],[1,-t2,0],
    [0,-1,t2],[0,1,t2],[0,-1,-t2],[0,1,-t2],
    [t2,0,-1],[t2,0,1],[-t2,0,-1],[-t2,0,1]
].map(v => normalize(...v));

let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
];

// Subdivide
for (let d = 0; d < DETAIL; d++) {
    const midCache = {};
    const newFaces = [];

    function getMid(i, j) {
        const key = Math.min(i,j) + '_' + Math.max(i,j);
        if (midCache[key] !== undefined) return midCache[key];
        const a = vertices[i], b = vertices[j];
        const mid = normalize((a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2);
        vertices.push(mid);
        midCache[key] = vertices.length - 1;
        return midCache[key];
    }

    for (const [a, b, c] of faces) {
        const ab = getMid(a, b);
        const bc = getMid(b, c);
        const ca = getMid(c, a);
        newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = newFaces;
}

// Displace vertices using groundHeight
const displaced = vertices.map(v => {
    const r = groundHeight(v[0], v[1], v[2]);
    return [v[0]*r, v[1]*r, v[2]*r];
});

console.log('  Vertices: ' + vertices.length + ', Faces: ' + faces.length);

// =====================================================================
// STEP 2: Build spatial index for fast triangle lookup
// =====================================================================
console.log('Building spatial index...');
const GRID = 32;
const triGrid = new Array(GRID * GRID);
for (let i = 0; i < triGrid.length; i++) triGrid[i] = [];

for (let fi = 0; fi < faces.length; fi++) {
    const [a, b, c] = faces[fi];
    const cx = (displaced[a][0]+displaced[b][0]+displaced[c][0])/3;
    const cy = (displaced[a][1]+displaced[b][1]+displaced[c][1])/3;
    const cz = (displaced[a][2]+displaced[b][2]+displaced[c][2])/3;
    const [nx,ny,nz] = normalize(cx, cy, cz);
    const lat = Math.asin(Math.max(-1,Math.min(1,ny)));
    const lon = Math.atan2(nz, nx);
    const gx = Math.floor((lon/Math.PI+1)*0.5*GRID) % GRID;
    const gy = Math.floor((lat/Math.PI+0.5)*GRID) % GRID;
    triGrid[gy*GRID+gx].push(fi);
}

// =====================================================================
// STEP 3: Ray-triangle intersection against actual mesh
// =====================================================================
function raycastMesh(ox, oy, oz, dx, dy, dz) {
    // Find grid cell
    const [nx,ny,nz] = normalize(ox,oy,oz);
    const lat = Math.asin(Math.max(-1,Math.min(1,ny)));
    const lon = Math.atan2(nz, nx);
    const gx = Math.floor((lon/Math.PI+1)*0.5*GRID) % GRID;
    const gy = Math.floor((lat/Math.PI+0.5)*GRID) % GRID;

    let bestDist = Infinity, bestPoint = null;

    for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
        const cx = ((gx+ddx)%GRID+GRID)%GRID;
        const cy = ((gy+ddy)%GRID+GRID)%GRID;
        for (const fi of triGrid[cy*GRID+cx]) {
            const [ai, bi, ci] = faces[fi];
            const a = displaced[ai], b = displaced[bi], c = displaced[ci];

            // Möller–Trumbore
            const e1 = sub(b, a), e2 = sub(c, a);
            const h = cross([dx,dy,dz], e2);
            const det = dot(e1, h);
            if (det > -0.00001 && det < 0.00001) continue;
            const f = 1/det;
            const s = sub([ox,oy,oz], a);
            const u = f * dot(s, h);
            if (u < 0 || u > 1) continue;
            const q = cross(s, e1);
            const v = f * dot([dx,dy,dz], q);
            if (v < 0 || u+v > 1) continue;
            const t = f * dot(e2, q);
            if (t > 0.001 && t < bestDist) {
                bestDist = t;
                bestPoint = [ox+dx*t, oy+dy*t, oz+dz*t];
            }
        }
    }
    return bestPoint ? { dist: bestDist, point: bestPoint } : null;
}

// =====================================================================
// STEP 4: Walk the character and measure VISUAL gap
// =====================================================================
console.log('\nWalking character and measuring visual gap...\n');

let gp, heading = 0, vFwd = 0;
let _lastRef = [0, 0, 1];

function getFrame(gp) {
    const up = normalize(...gp);
    let ref = sub(_lastRef, scale(up, dot(_lastRef, up)));
    if (dot(ref,ref) < 0.0001) {
        const seed = Math.abs(up[1]) < 0.95 ? [0,1,0] : [1,0,0];
        ref = sub(seed, scale(up, dot(seed, up)));
    }
    ref = normalize(...ref);
    const east = normalize(...cross(up, ref));
    _lastRef = [...ref];
    return { up, north: ref, east };
}

// Init at lat 40, lon 0
{
    const phi=(90-40)*Math.PI/180, theta=Math.PI;
    const [nx,ny,nz] = normalize(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
    const r = groundHeight(nx,ny,nz);
    gp = [nx*r, ny*r, nz*r];
}

const FRAMES = 400;
let maxVisGap = 0, totalVisGap = 0, visGapCount = 0;
let maxFloat = 0, maxSink = 0;
const problems = [];

for (let f = 0; f < FRAMES; f++) {
    // Physics step
    const target = MAX_WALK;
    vFwd += (target - vFwd) * WALK_ACCEL * (1/60) * 60;
    vFwd *= GROUND_DRAG;

    // Move
    heading += 0; // straight line
    if (Math.abs(vFwd) > 0.00001) {
        const frame = getFrame(gp);
        const ch = Math.cos(heading), sh = Math.sin(heading);
        const fw = normalize(
            frame.north[0]*ch + frame.east[0]*sh,
            frame.north[1]*ch + frame.east[1]*sh,
            frame.north[2]*ch + frame.east[2]*sh
        );
        const nw = add(gp, scale(fw, vFwd));
        const dir = normalize(...nw);
        const r = groundHeight(dir[0], dir[1], dir[2]);
        gp = [dir[0]*r, dir[1]*r, dir[2]*r];
    }

    // UpdateChar
    const dir = normalize(...gp);
    const r = groundHeight(dir[0], dir[1], dir[2]);
    gp = [dir[0]*r, dir[1]*r, dir[2]*r];

    // Character position (what the game sets)
    const frame = getFrame(gp);
    const charPos = [...gp]; // airborne=0, no offset

    // Now raycast DOWN from character position to find the MESH surface
    const rayDir = scale(dir, -1); // inward toward planet center
    const rayOrigin = add(charPos, scale(dir, 2)); // start 2 units above
    const hit = raycastMesh(rayOrigin[0], rayOrigin[1], rayOrigin[2], rayDir[0], rayDir[1], rayDir[2]);

    if (hit) {
        // Distance from character feet to mesh surface
        const charR = len(...charPos);
        const meshR = len(...hit.point);
        const gap = charR - meshR; // positive = floating, negative = sinking

        const biome = getBiome(dir[0], dir[1], dir[2]);
        const lat = Math.asin(dir[1]) * 180 / Math.PI;
        const lon = Math.atan2(dir[2], dir[0]) * 180 / Math.PI;

        if (gap > maxFloat) maxFloat = gap;
        if (gap < maxSink) maxSink = gap;
        maxVisGap = Math.max(maxVisGap, Math.abs(gap));
        totalVisGap += Math.abs(gap);
        visGapCount++;

        if (Math.abs(gap) > 0.05) {
            problems.push({
                f, lat: +lat.toFixed(1), lon: +lon.toFixed(1), biome: biome.name,
                gap: +gap.toFixed(4), charR: +charR.toFixed(3), meshR: +meshR.toFixed(3),
                analyticalR: +r.toFixed(3)
            });
        }

        if (f % 50 === 0) {
            console.log(`F${f}: ${biome.name} ${lat.toFixed(1)}°,${lon.toFixed(1)}° | charR=${charR.toFixed(3)} meshR=${meshR.toFixed(3)} gap=${gap.toFixed(4)} (${(gap/CH*100).toFixed(1)}% MC)`);
        }
    }
}

console.log('\n=== VISUAL GAP RESULTS ===');
console.log('Frames: ' + visGapCount);
console.log('Max float: ' + maxFloat.toFixed(4) + ' (' + (maxFloat/CH*100).toFixed(1) + '% MC)');
console.log('Max sink: ' + maxSink.toFixed(4) + ' (' + (Math.abs(maxSink)/CH*100).toFixed(1) + '% MC)');
console.log('Avg gap: ' + (totalVisGap/visGapCount).toFixed(4) + ' (' + (totalVisGap/visGapCount/CH*100).toFixed(1) + '% MC)');
console.log('Problem frames (>0.05 gap): ' + problems.length + '/' + visGapCount);

if (problems.length > 0) {
    console.log('\nWorst problem frames:');
    problems.sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap));
    problems.slice(0, 10).forEach(p => {
        console.log(`  F${p.f}: ${p.biome} ${p.lat}°,${p.lon}° | gap=${p.gap} | charR=${p.charR} meshR=${p.meshR} analyticalR=${p.analyticalR}`);
    });
}

console.log('\nVerdict:');
if (maxVisGap < 0.05) console.log('  PASS — character feet within 3% of mesh surface');
else if (maxVisGap < 0.15) console.log('  MARGINAL — visible at close zoom, OK at normal distance');
else console.log('  FAIL — character visibly floats/sinks. Gap = ' + (maxVisGap/CH*100).toFixed(1) + '% of character height');

console.log('\n=== TEST COMPLETE ===');
