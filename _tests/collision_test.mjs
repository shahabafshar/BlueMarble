/**
 * COLLISION TEST — Fully autonomous.
 *
 * Creates a test world with objects at known positions,
 * walks the MC directly into each one, and checks if it was blocked.
 *
 * Run: node _tests/collision_test.mjs
 */

import { createNoise3D } from 'simplex-noise';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

const n3 = createNoise3D();
const PR = 50, WORLD_SCALE = 2.5, MC_RADIUS = 0.4;
const MAX_WALK = 0.6, WALK_ACCEL = 0.1, GROUND_DRAG = 0.88;

// === GAME FUNCTIONS (exact copies) ===
function fbm(x,y,z,o=4){let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*n3(x*f,y*f,z*f);a*=.5;f*=2;}return v;}
function getBiome(nx,ny,nz){
    const e=fbm(nx*1.5,ny*1.5,nz*1.5,4),m=fbm(nx*2+100,ny*2+100,nz*2+100,3);
    const t=ny*0.7+n3(nx*0.8+50,ny*0.8,nz*0.8+50)*0.5;
    if(e<-0.15)return{type:0,elevation:e};if(e<-0.05)return{type:6,elevation:e};
    if(t<-0.3)return{type:4,elevation:e};if(t>0.4&&m<-0.1)return{type:3,elevation:e};
    if(t>0.2&&m>0.2)return{type:5,elevation:e};if(m>0.1)return{type:2,elevation:e};
    return{type:1,elevation:e};
}
function groundHeight(nx,ny,nz){
    const b=getBiome(nx,ny,nz);const e=b.elevation;
    const t=Math.max(0,Math.min(1,(e+0.2)/0.2));const s=t*t*(3-2*t);
    return PR-0.5+s*(Math.max(0,e+0.15)*2.5+0.5+n3(nx*8,ny*8,nz*8)*0.06);
}

// === VECTOR MATH ===
function norm(x,y,z){const l=Math.sqrt(x*x+y*y+z*z);return[x/l,y/l,z/l];}
function len3(a){return Math.sqrt(a[0]**2+a[1]**2+a[2]**2);}
function dist3(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scale3(v,s){return[v[0]*s,v[1]*s,v[2]*s];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}

function latLonToPos(lat, lon) {
    const phi=(90-lat)*Math.PI/180, theta=(lon+180)*Math.PI/180;
    const nx=Math.sin(phi)*Math.cos(theta),ny=Math.cos(phi),nz=Math.sin(phi)*Math.sin(theta);
    const r=groundHeight(nx,ny,nz);
    return [nx*r, ny*r, nz*r];
}

// === EXTRACT ObjectRules FROM HTML ===
const rulesMatch = html.match(/const ObjectRules = \{([\s\S]*?)\};/);
const ObjectRules = {};
if (rulesMatch) {
    const entries = rulesMatch[1].matchAll(/(\w+):\s*\{\s*radius:\s*([\d.]+).*?solid:\s*(true|false)/g);
    for (const m of entries) {
        ObjectRules[m[1]] = { radius: parseFloat(m[2]), solid: m[3] === 'true' };
    }
}
console.log('Extracted ObjectRules:', Object.keys(ObjectRules).length, 'types');
console.log('Solid types:', Object.entries(ObjectRules).filter(([k,v])=>v.solid).map(([k])=>k).join(', '));
console.log('');

function getRules(t) { return ObjectRules[t] || { radius: 0.5, solid: false }; }

// === SIMULATE getFrame + moveOnSurface + collision ===
let gp, heading = 0, _lastRef = [0,0,1];

function getFrame() {
    const up = norm(...gp);
    let ref = sub3(_lastRef, scale3(up, dot3(_lastRef, up)));
    if (dot3(ref,ref) < 0.0001) { ref = sub3([0,1,0], scale3(up, up[1])); }
    if (dot3(ref,ref) < 0.0001) { ref = sub3([1,0,0], scale3(up, up[0])); }
    ref = norm(...ref);
    const east = norm(...cross3(up, ref));
    _lastRef = [...ref];
    const ch=Math.cos(heading), sh=Math.sin(heading);
    const fw = norm(ref[0]*ch+east[0]*sh, ref[1]*ch+east[1]*sh, ref[2]*ch+east[2]*sh);
    return { up, fw };
}

function moveWithCollision(fwdAmt, solidObjects) {
    if (Math.abs(fwdAmt) < 0.00001) return;
    const { fw } = getFrame();
    const mv = scale3(fw, fwdAmt);
    const nw = add3(gp, mv);
    const dir = norm(...nw);
    const r = groundHeight(dir[0], dir[1], dir[2]);
    let cand = [dir[0]*r, dir[1]*r, dir[2]*r];

    // Collision check — same as game code
    let collided = false;
    for (const obj of solidObjects) {
        const rules = getRules(obj.type);
        if (!rules.solid) continue;
        const minDist = rules.radius + MC_RADIUS;
        const d = dist3(cand, obj.pos);
        if (d < minDist) {
            collided = true;
            const push = sub3(cand, obj.pos);
            const up = norm(...cand);
            const pushFlat = sub3(push, scale3(up, dot3(push, up)));
            if (dot3(pushFlat, pushFlat) > 0.0001) {
                const pn = norm(...pushFlat);
                cand = add3(obj.pos, scale3(pn, minDist + 0.01));
                const d2 = norm(...cand);
                const r2 = groundHeight(d2[0], d2[1], d2[2]);
                cand = [d2[0]*r2, d2[1]*r2, d2[2]*r2];
            } else {
                return true; // blocked, don't move
            }
        }
    }
    gp = cand;
    return collided;
}

// === TEST SCENARIOS ===
console.log('=== COLLISION TEST SUITE ===\n');

const testTypes = [
    { type: 'tree', label: 'Tree (radius 1.2)' },
    { type: 'pine', label: 'Pine (radius 1.0)' },
    { type: 'rock', label: 'Rock (radius 0.5)' },
    { type: 'house', label: 'House (radius 3.0)' },
    { type: 'castle', label: 'Castle (radius 5.0)' },
    { type: 'pyramid', label: 'Pyramid (radius 5.0)' },
    { type: 'lamppost', label: 'Lamppost (radius 0.3)' },
    { type: 'bush', label: 'Bush (radius 0.4, NOT solid)' },
    { type: 'flower', label: 'Flower (radius 0.15, NOT solid)' },
];

let passed = 0, failed = 0;

for (const test of testTypes) {
    const rules = getRules(test.type);
    const objLat = 40, objLon = 0;
    const objPos = latLonToPos(objLat, objLon);
    const obj = { type: test.type, pos: objPos };
    const solidObjects = [obj];

    // Start MC directly toward the object.
    // Compute a position on the sphere 2 units away from the object
    // and aim the MC to walk straight at it.
    const objDir = norm(...objPos);
    // Find a tangent direction on the sphere at the object position
    const up = objDir;
    let tangent = sub3([0,1,0], scale3(up, dot3([0,1,0], up)));
    if (dot3(tangent, tangent) < 0.001) tangent = sub3([1,0,0], scale3(up, up[0]));
    tangent = norm(...tangent);
    // Start position: 2 world units away along this tangent
    const startDist = Math.max(getRules(test.type).radius + 3, 5);
    const startDir = norm(...add3(scale3(objDir, PR), scale3(tangent, startDist)));
    const startR = groundHeight(startDir[0], startDir[1], startDir[2]);
    gp = [startDir[0]*startR, startDir[1]*startR, startDir[2]*startR];
    _lastRef = [...tangent];
    // Heading should point from start toward object
    // The forward direction at start is along _lastRef projected into tangent plane
    // We want to walk toward objPos, so compute the direction
    const toObj = sub3(objPos, gp);
    const toObjFlat = sub3(toObj, scale3(norm(...gp), dot3(toObj, norm(...gp))));
    const toObjDir = norm(...toObjFlat);
    // Set heading so that fw aligns with toObjDir
    // fw = ref*cos(h) + east*sin(h), we need to find h
    const frame0 = getFrame();
    const ref0 = [..._lastRef];
    const east0 = norm(...cross3(norm(...gp), ref0));
    const cosH = dot3(toObjDir, ref0);
    const sinH = dot3(toObjDir, east0);
    heading = Math.atan2(sinH, cosH);

    // Accelerate to full speed
    let vFwd = 0;
    let reachedObject = false;
    let wasBlocked = false;
    let closestDist = Infinity;
    let stepAtClosest = -1;

    for (let step = 0; step < 200; step++) {
        // Accelerate
        vFwd += (MAX_WALK - vFwd) * WALK_ACCEL * (1/60) * 60;
        vFwd *= GROUND_DRAG;

        const prevPos = [...gp];
        const collided = moveWithCollision(vFwd, solidObjects);

        const d = dist3(gp, objPos);
        if (d < closestDist) { closestDist = d; stepAtClosest = step; }

        // Did we pass through? Check if we went from one side to the other
        const prevD = dist3(prevPos, objPos);
        if (prevD < rules.radius + MC_RADIUS + 1 && !collided) {
            // We're near the object and NOT blocked
        }
        if (collided) wasBlocked = true;

        // Did we get past? If MC lat < object lat, we passed it
        const mcDir = norm(...gp);
        const mcLat = Math.asin(mcDir[1]) * 180 / Math.PI;
        if (mcLat < objLat - 1) {
            reachedObject = true;
            break;
        }
    }

    const shouldBlock = rules.solid;
    const didBlock = wasBlocked;
    const ok = shouldBlock === didBlock;

    if (ok) passed++; else failed++;

    const minDistExpected = rules.radius + MC_RADIUS;
    console.log(
        (ok ? 'PASS' : 'FAIL') + ' | ' + test.label.padEnd(35) +
        ' | solid=' + String(rules.solid).padEnd(5) +
        ' | blocked=' + String(didBlock).padEnd(5) +
        ' | closest=' + closestDist.toFixed(3) +
        ' | minDist=' + minDistExpected.toFixed(3) +
        (didBlock ? ' | stopped at step ' + stepAtClosest : ' | walked through')
    );

    if (!ok) {
        console.log('  DETAIL: closest approach ' + closestDist.toFixed(4) +
            ' vs required ' + minDistExpected.toFixed(4) +
            ' — ' + (closestDist < minDistExpected ? 'inside collision zone but not blocked!' : 'never reached collision zone'));
    }
}

console.log('\n=== RESULTS: ' + passed + '/' + testTypes.length + ' passed, ' + failed + ' failed ===');

if (failed > 0) {
    console.log('\nDIAGNOSTICS:');
    console.log('MC_RADIUS:', MC_RADIUS);
    console.log('1° lat on surface ≈', dist3(latLonToPos(40, 0), latLonToPos(41, 0)).toFixed(3), 'world units');

    // Check if the collision comparison even makes sense
    const testObj = { type: 'tree', pos: latLonToPos(40, 0) };
    const testMC = latLonToPos(40.5, 0);
    console.log('MC at 40.5° vs tree at 40°: dist =', dist3(testMC, testObj.pos).toFixed(4));
    console.log('Tree minDist:', (getRules('tree').radius + MC_RADIUS).toFixed(4));
    console.log('Should collide:', dist3(testMC, testObj.pos) < getRules('tree').radius + MC_RADIUS);
}
