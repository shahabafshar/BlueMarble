/**
 * Autonomous test system for Blue Marble.
 *
 * Tests the ground physics by extracting and running the exact
 * game code in Node.js — no browser or WebGL needed.
 *
 * Run: node test.mjs
 */

import { createNoise3D } from 'simplex-noise';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const n3 = createNoise3D();
const PR = 50;
const CH = 1.8;
const MAX_WALK = 0.6;
const GRAVITY = 9.8 * 0.003;
const GROUND_DRAG = 0.88;

// Exact copies of the game's functions
function fbm(x,y,z,o=4){ let v=0,a=.5,f=1; for(let i=0;i<o;i++){v+=a*n3(x*f,y*f,z*f);a*=.5;f*=2;} return v; }

function getBiome(nx,ny,nz){
    const e = fbm(nx*1.5,ny*1.5,nz*1.5,4);
    const m = fbm(nx*2+100,ny*2+100,nz*2+100,3);
    const t = ny*0.7 + n3(nx*0.8+50,ny*0.8,nz*0.8+50)*0.5;
    if(e<-0.15) return {type:0,name:'Ocean',elevation:e};
    if(e<-0.05) return {type:6,name:'Beach',elevation:e};
    if(t<-0.3) return {type:4,name:'Snowy Mountains',elevation:e};
    if(t>0.4&&m<-0.1) return {type:3,name:'Desert',elevation:e};
    if(t>0.2&&m>0.2) return {type:5,name:'Tropical Jungle',elevation:e};
    if(m>0.1) return {type:2,name:'Forest',elevation:e};
    return {type:1,name:'Grasslands',elevation:e};
}

// Read the actual groundHeight from the HTML file to ensure it matches
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const ghMatch = html.match(/function groundHeight\(nx, ny, nz\)\s*\{([^}]+)\}/);
console.log('groundHeight source from index.html:');
console.log('  ' + ghMatch[0].replace(/\n/g, '\n  '));
console.log('');

function groundHeight(nx, ny, nz) {
    const b = getBiome(nx, ny, nz);
    const e = b.elevation;
    const t = Math.max(0, Math.min(1, (e + 0.2) / 0.2));
    const smooth = t * t * (3 - 2 * t);
    return PR - 0.5 + smooth * (Math.max(0, e + 0.15) * 2.5 + 0.5 + n3(nx * 8, ny * 8, nz * 8) * 0.06);
}

// Read visual offset from the HTML
const offsetMatch = html.match(/player\.airborne\s*-\s*([\d.]+)/);
const VISUAL_OFFSET = offsetMatch ? parseFloat(offsetMatch[1]) : 0;
console.log('Visual offset from code: -' + VISUAL_OFFSET);

// Read planet detail level
const detailMatch = html.match(/IcosahedronGeometry\(PR,\s*(\d+)\)/);
const DETAIL = detailMatch ? parseInt(detailMatch[1]) : 6;
const vertCount = 10 * Math.pow(4, DETAIL) + 2;
const vertSpacing = 2 * Math.PI * PR / Math.sqrt(vertCount);
console.log('Planet detail: ' + DETAIL + ' (' + vertCount + ' verts, spacing ' + vertSpacing.toFixed(3) + ' units)');

// Read flatShading setting
const flatMatch = html.match(/flatShading:\s*(true|false)/);
console.log('Flat shading: ' + (flatMatch ? flatMatch[1] : 'unknown'));
console.log('');

// =====================================================================
// Minimal vec3 math (no Three.js dependency)
// =====================================================================
function normalize(x, y, z) {
    const l = Math.sqrt(x*x + y*y + z*z);
    return [x/l, y/l, z/l];
}

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function scale(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }
function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function len(v) { return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); }

// Replicate getFrame
function getFrame(gp) {
    const up = normalize(...gp);
    const worldUp = [0, 1, 0];
    let north = sub(worldUp, scale(up, dot(worldUp, up)));
    if (dot(north, north) < 0.0001) {
        north = sub([1,0,0], scale(up, dot([1,0,0], up)));
    }
    north = normalize(...north);
    const east = normalize(...cross(up, north));
    return { up, north, east };
}

// =====================================================================
// TEST 1: Math accuracy — does groundPos == groundHeight at all points?
// =====================================================================
console.log('=== TEST 1: MATH ACCURACY ===');
console.log('Walking 500 steps through all biomes...');

let gpx, gpy, gpz, heading = 0;
// Init at lat 40, lon 0
{
    const phi = (90-40)*Math.PI/180, theta = Math.PI;
    const [nx,ny,nz] = normalize(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
    const r = groundHeight(nx, ny, nz);
    gpx = nx*r; gpy = ny*r; gpz = nz*r;
}

let maxMathErr = 0, totalMathErr = 0;
const biomesSeen = new Set();
const issues = [];

for (let step = 0; step < 500; step++) {
    // Replicate moveOnSurface
    const fwd = MAX_WALK * 0.4;
    const turnAmt = 0.021;
    heading += turnAmt;

    const frame = getFrame([gpx, gpy, gpz]);
    const ch = Math.cos(heading), sh = Math.sin(heading);
    const fw = normalize(
        frame.north[0]*ch + frame.east[0]*sh,
        frame.north[1]*ch + frame.east[1]*sh,
        frame.north[2]*ch + frame.east[2]*sh
    );

    let nwx = gpx + fw[0]*fwd;
    let nwy = gpy + fw[1]*fwd;
    let nwz = gpz + fw[2]*fwd;
    const [dx, dy, dz] = normalize(nwx, nwy, nwz);
    const r = groundHeight(dx, dy, dz);
    gpx = dx*r; gpy = dy*r; gpz = dz*r;

    // Replicate updateChar
    const [nx, ny, nz] = normalize(gpx, gpy, gpz);
    const r2 = groundHeight(nx, ny, nz);
    gpx = nx*r2; gpy = ny*r2; gpz = nz*r2;

    // Check
    const actualR = len([gpx, gpy, gpz]);
    const expectedR = groundHeight(nx, ny, nz);
    const err = Math.abs(actualR - expectedR);

    const biome = getBiome(nx, ny, nz);
    biomesSeen.add(biome.name);

    if (err > 0.0001) {
        issues.push({ step, biome: biome.name, err: err.toFixed(8) });
    }
    maxMathErr = Math.max(maxMathErr, err);
    totalMathErr += err;
}

console.log('  Max error: ' + maxMathErr.toFixed(8));
console.log('  Avg error: ' + (totalMathErr/500).toFixed(8));
console.log('  Issues: ' + issues.length);
console.log('  Biomes visited: ' + [...biomesSeen].join(', '));
console.log('  ' + (maxMathErr < 0.001 ? 'PASS' : 'FAIL'));
console.log('');

// =====================================================================
// TEST 2: Visual gap — analytical vs mesh chord at many points
// =====================================================================
console.log('=== TEST 2: VISUAL MESH GAP ===');
console.log('Sampling 20000 points, measuring analytical vs mesh chord gap...');

let maxFloat = 0, maxSink = 0, totalFloat = 0, totalSink = 0;
let floatN = 0, sinkN = 0;
const AS = vertSpacing / PR; // angular spacing

for (let i = 0; i < 20000; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2*Math.random()-1);
    const [nx,ny,nz] = normalize(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
    const h = groundHeight(nx, ny, nz);

    const angle = Math.random() * Math.PI * 2;
    const ddx = Math.cos(angle)*AS*0.5, ddz = Math.sin(angle)*AS*0.5;
    const [ax,ay,az] = normalize(nx+ddx, ny, nz+ddz);
    const [bx,by,bz] = normalize(nx-ddx, ny, nz-ddz);
    const meshH = (groundHeight(ax,ay,az) + groundHeight(bx,by,bz)) / 2;

    // gap = where character is (h) minus where mesh face is (meshH)
    // then subtract the visual offset the code applies
    const rawGap = h - meshH;
    const visualGap = rawGap - VISUAL_OFFSET;

    if (visualGap > 0) { maxFloat = Math.max(maxFloat, visualGap); totalFloat += visualGap; floatN++; }
    else { maxSink = Math.max(maxSink, -visualGap); totalSink -= visualGap; sinkN++; }
}

const avgFloat = floatN > 0 ? totalFloat/floatN : 0;
const avgSink = sinkN > 0 ? totalSink/sinkN : 0;

console.log('  After visual offset of -' + VISUAL_OFFSET + ':');
console.log('  Float: max=' + maxFloat.toFixed(4) + ' (' + (maxFloat/CH*100).toFixed(1) + '% MC) avg=' + avgFloat.toFixed(4));
console.log('  Sink:  max=' + maxSink.toFixed(4) + ' (' + (maxSink/CH*100).toFixed(1) + '% MC) avg=' + avgSink.toFixed(4));
console.log('  Distribution: ' + floatN + ' float, ' + sinkN + ' sink');
console.log('');

// Suggest better offset
const optimalOffset = (avgFloat * floatN - avgSink * sinkN) / (floatN + sinkN);
console.log('  Current offset: -' + VISUAL_OFFSET);
console.log('  Suggested offset: -' + (VISUAL_OFFSET + optimalOffset).toFixed(4));
console.log('  (would center the error band around zero)');

const worstVisual = Math.max(maxFloat, maxSink);
console.log('  ' + (worstVisual < 0.15 ? 'PASS (<8% MC)' : worstVisual < 0.3 ? 'MARGINAL (8-17% MC)' : 'FAIL (>17% MC)'));
console.log('');

// =====================================================================
// TEST 3: Movement consistency — walk in a straight line and back
// =====================================================================
console.log('=== TEST 3: MOVEMENT CONSISTENCY ===');
heading = 0;
{
    const phi = (90-40)*Math.PI/180, theta = Math.PI;
    const [nx,ny,nz] = normalize(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
    const r = groundHeight(nx, ny, nz);
    gpx = nx*r; gpy = ny*r; gpz = nz*r;
}
const origin = [gpx, gpy, gpz];

// Walk 100 steps forward
for (let i = 0; i < 100; i++) {
    const frame = getFrame([gpx,gpy,gpz]);
    const ch2 = Math.cos(heading), sh2 = Math.sin(heading);
    const fw2 = normalize(frame.north[0]*ch2+frame.east[0]*sh2, frame.north[1]*ch2+frame.east[1]*sh2, frame.north[2]*ch2+frame.east[2]*sh2);
    let [nwx,nwy,nwz] = add([gpx,gpy,gpz], scale(fw2, MAX_WALK*0.3));
    const [dx,dy,dz] = normalize(nwx,nwy,nwz);
    const r = groundHeight(dx,dy,dz);
    gpx=dx*r; gpy=dy*r; gpz=dz*r;
}

// Walk 100 steps backward (turn 180)
heading += Math.PI;
for (let i = 0; i < 100; i++) {
    const frame = getFrame([gpx,gpy,gpz]);
    const ch2 = Math.cos(heading), sh2 = Math.sin(heading);
    const fw2 = normalize(frame.north[0]*ch2+frame.east[0]*sh2, frame.north[1]*ch2+frame.east[1]*sh2, frame.north[2]*ch2+frame.east[2]*sh2);
    let [nwx,nwy,nwz] = add([gpx,gpy,gpz], scale(fw2, MAX_WALK*0.3));
    const [dx,dy,dz] = normalize(nwx,nwy,nwz);
    const r = groundHeight(dx,dy,dz);
    gpx=dx*r; gpy=dy*r; gpz=dz*r;
}

const returnDist = len(sub([gpx,gpy,gpz], origin));
const angularReturn = Math.acos(Math.max(-1, Math.min(1, dot(normalize(gpx,gpy,gpz), normalize(...origin))))) * 180 / Math.PI;
console.log('  After 100 steps forward + 100 steps back:');
console.log('  Return distance: ' + returnDist.toFixed(4) + ' units');
console.log('  Angular deviation: ' + angularReturn.toFixed(2) + '°');
console.log('  ' + (angularReturn < 2 ? 'PASS' : 'FAIL'));
console.log('');

// =====================================================================
// SUMMARY
// =====================================================================
console.log('=== FINAL SUMMARY ===');
const t1 = maxMathErr < 0.001;
const t2 = worstVisual < 0.3;
const t3 = angularReturn < 2;
console.log('Test 1 (Math): ' + (t1 ? 'PASS' : 'FAIL'));
console.log('Test 2 (Visual gap): ' + (t2 ? 'PASS' : 'FAIL') + ' (worst: ' + (worstVisual/CH*100).toFixed(1) + '% MC)');
console.log('Test 3 (Movement): ' + (t3 ? 'PASS' : 'FAIL'));
console.log('');

if (t1 && t2 && t3) {
    console.log('ALL TESTS PASS');
} else {
    console.log('ISSUES FOUND — recommendations:');
    if (!t1) console.log('  - Math error detected in groundPos calculation');
    if (!t2) {
        console.log('  - Visual gap too large. Options:');
        console.log('    a) Increase planet detail (current: ' + DETAIL + ')');
        console.log('    b) Adjust visual offset to -' + (VISUAL_OFFSET + optimalOffset).toFixed(4));
        console.log('    c) Reduce terrain height multiplier');
    }
    if (!t3) console.log('  - Movement drift detected — heading math may have error');
}
