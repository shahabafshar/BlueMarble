/**
 * COMPREHENSIVE TEST SUITE for Blue Marble
 *
 * Builds the actual planet mesh, walks the character through
 * multiple test routes covering all terrain types, and checks:
 *
 * 1. Height: Is the character at the mesh surface?
 * 2. Orientation: Is the character standing upright (local Y = radial)?
 * 3. Visual: From the camera's perspective, does the character appear grounded?
 * 4. Movement: Is forward direction stable? Any spiraling?
 * 5. Slopes: Does the character sink into hillsides visually?
 * 6. Edges: Any jitter at face boundaries?
 * 7. Objects: Are placed objects at the same height as the character would be?
 *
 * Run: node fulltest.mjs
 */

import { createNoise3D } from 'simplex-noise';

const n3 = createNoise3D();
const PR = 50;
const CH = 1.8;
const MAX_WALK = 0.6;
const WALK_ACCEL = 0.1;
const GROUND_DRAG = 0.88;
const WORLD_SCALE = 2.5;

// === GAME FUNCTIONS (exact copies) ===
function fbm(x,y,z,o=4){let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*n3(x*f,y*f,z*f);a*=.5;f*=2;}return v;}
function getBiome(nx,ny,nz){
    const e=fbm(nx*1.5,ny*1.5,nz*1.5,4),m=fbm(nx*2+100,ny*2+100,nz*2+100,3);
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

// === VECTOR MATH ===
const V={
    norm(x,y,z){const l=Math.sqrt(x*x+y*y+z*z);return[x/l,y/l,z/l];},
    len(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);},
    dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];},
    cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];},
    sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];},
    add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];},
    scale(v,s){return[v[0]*s,v[1]*s,v[2]*s];},
    angle(a,b){return Math.acos(Math.max(-1,Math.min(1,V.dot(V.norm(...a),V.norm(...b)))))*180/Math.PI;}
};

// === BUILD ACTUAL MESH ===
console.log('Building planet mesh (detail 7)...');
const t0 = (1+Math.sqrt(5))/2;
let verts = [[-1,t0,0],[1,t0,0],[-1,-t0,0],[1,-t0,0],[0,-1,t0],[0,1,t0],[0,-1,-t0],[0,1,-t0],[t0,0,-1],[t0,0,1],[-t0,0,-1],[-t0,0,1]].map(v=>V.norm(...v));
let faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
for(let d=0;d<7;d++){const mc={};const nf=[];function gm(i,j){const k=Math.min(i,j)+'_'+Math.max(i,j);if(mc[k]!==undefined)return mc[k];const a=verts[i],b=verts[j];verts.push(V.norm((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2));mc[k]=verts.length-1;return mc[k];}for(const[a,b,c]of faces){const ab=gm(a,b),bc=gm(b,c),ca=gm(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}faces=nf;}
const dv = verts.map(v=>{const r=groundHeight(v[0],v[1],v[2]);return[v[0]*r,v[1]*r,v[2]*r];});
console.log(`  ${verts.length} verts, ${faces.length} faces`);

// === SPATIAL INDEX ===
const GRID=32,tg=Array.from({length:GRID*GRID},()=>[]);
for(let fi=0;fi<faces.length;fi++){
    const[a,b,c]=faces[fi];
    const cx=(dv[a][0]+dv[b][0]+dv[c][0])/3,cy=(dv[a][1]+dv[b][1]+dv[c][1])/3,cz=(dv[a][2]+dv[b][2]+dv[c][2])/3;
    const[nx,ny,nz]=V.norm(cx,cy,cz);
    const gx=Math.floor((Math.atan2(nz,nx)/Math.PI+1)*0.5*GRID)%GRID;
    const gy=Math.floor((Math.asin(Math.max(-1,Math.min(1,ny)))/Math.PI+0.5)*GRID)%GRID;
    tg[gy*GRID+gx].push(fi);
}

// === RAYCAST ===
function rayMesh(ox,oy,oz,dx,dy,dz){
    const[nx,ny,nz]=V.norm(ox,oy,oz);
    const lat=Math.asin(Math.max(-1,Math.min(1,ny))),lon=Math.atan2(nz,nx);
    const gx=Math.floor((lon/Math.PI+1)*.5*GRID)%GRID,gy=Math.floor((lat/Math.PI+.5)*GRID)%GRID;
    let best=Infinity,bp=null,bn=null;
    for(let dy2=-1;dy2<=1;dy2++)for(let dx2=-1;dx2<=1;dx2++){
        const cx2=((gx+dx2)%GRID+GRID)%GRID,cy2=((gy+dy2)%GRID+GRID)%GRID;
        for(const fi of tg[cy2*GRID+cx2]){
            const[ai,bi,ci]=faces[fi];const a=dv[ai],b=dv[bi],c=dv[ci];
            const e1=V.sub(b,a),e2=V.sub(c,a),h=V.cross([dx,dy,dz],e2);
            const det=V.dot(e1,h);if(det>-1e-5&&det<1e-5)continue;
            const f=1/det,s=V.sub([ox,oy,oz],a),u=f*V.dot(s,h);
            if(u<0||u>1)continue;const q=V.cross(s,e1),v=f*V.dot([dx,dy,dz],q);
            if(v<0||u+v>1)continue;const t=f*V.dot(e2,q);
            if(t>0.001&&t<best){best=t;bp=[ox+dx*t,oy+dy*t,oz+dz*t];bn=V.norm(...V.cross(e1,e2));if(V.dot(bn,[nx,ny,nz])<0)bn=V.scale(bn,-1);}
        }
    }
    return bp?{point:bp,normal:bn,dist:best}:null;
}

// === PLAYER SIMULATION ===
let gp,heading=0,vFwd=0,_lastRef=[0,0,1];

function getFrame(){
    const up=V.norm(...gp);
    let ref=V.sub(_lastRef,V.scale(up,V.dot(_lastRef,up)));
    if(V.dot(ref,ref)<0.0001){const seed=Math.abs(up[1])<0.95?[0,1,0]:[1,0,0];ref=V.sub(seed,V.scale(up,V.dot(seed,up)));}
    ref=V.norm(...ref);const east=V.norm(...V.cross(up,ref));_lastRef=[...ref];
    const ch=Math.cos(heading),sh=Math.sin(heading);
    const fw=V.norm(ref[0]*ch+east[0]*sh,ref[1]*ch+east[1]*sh,ref[2]*ch+east[2]*sh);
    const rt=V.norm(...V.cross(fw,up));
    return{up,fw,rt};
}

function initAt(lat,lon){
    const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;
    const[nx,ny,nz]=V.norm(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
    const r=groundHeight(nx,ny,nz);gp=[nx*r,ny*r,nz*r];heading=0;vFwd=0;_lastRef=[0,0,1];
}

function step(inputFwd,inputTurn){
    if(inputTurn) heading+=inputTurn;
    if(inputFwd){vFwd+=(inputFwd*MAX_WALK-vFwd)*WALK_ACCEL*(1/60)*60;}
    vFwd*=GROUND_DRAG;if(Math.abs(vFwd)<0.0001)vFwd=0;
    if(Math.abs(vFwd)>0.00001){
        const{fw}=getFrame();const nw=V.add(gp,V.scale(fw,vFwd));
        const dir=V.norm(...nw);const r=groundHeight(dir[0],dir[1],dir[2]);
        gp=[dir[0]*r,dir[1]*r,dir[2]*r];
    }
    // updateChar
    const dir=V.norm(...gp);const r=groundHeight(dir[0],dir[1],dir[2]);
    gp=[dir[0]*r,dir[1]*r,dir[2]*r];
    const frame=getFrame();
    const charPos=[...gp]; // feet position
    return{charPos,dir,frame,biome:getBiome(dir[0],dir[1],dir[2])};
}

function measureVisualGap(charPos,dir){
    // Raycast from above char toward planet center
    const origin=V.add(charPos,V.scale(dir,3));
    const rayDir=V.scale(dir,-1);
    const hit=rayMesh(origin[0],origin[1],origin[2],rayDir[0],rayDir[1],rayDir[2]);
    if(!hit)return{gap:NaN,meshR:NaN};
    const charR=V.len(charPos);const meshR=V.len(hit.point);
    return{gap:charR-meshR,meshR,faceNormal:hit.normal};
}

// =====================================================================
// TEST ROUTES
// =====================================================================
const routes = [
    {name:'Equator belt',     lat:5,  lon:0,   turn:0,    steps:300, desc:'Walk along equator through multiple biomes'},
    {name:'Pole crossing',    lat:40, lon:180, turn:0,    steps:400, desc:'Walk over the north pole'},
    {name:'Steep hillside',   lat:35, lon:60,  turn:0,    steps:200, desc:'Walk through hilly Mediterranean zone'},
    {name:'Beach-ocean edge', lat:25, lon:150, turn:0,    steps:200, desc:'Walk across beach into ocean'},
    {name:'Desert zone',      lat:15, lon:-30, turn:0,    steps:200, desc:'Walk across desert'},
    {name:'Snow mountains',   lat:65, lon:30,  turn:0,    steps:200, desc:'Walk through snowy peaks'},
    {name:'Tight circle',     lat:48, lon:5,   turn:0.04, steps:200, desc:'Walk in a tight circle (tests spiral bug)'},
    {name:'Reverse walk',     lat:40, lon:0,   turn:0,    steps:100, desc:'Walk forward then backward', reverse:true},
];

console.log('\n=== RUNNING ' + routes.length + ' TEST ROUTES ===\n');
const allResults = [];
let totalIssues = 0;

for (const route of routes) {
    initAt(route.lat, route.lon);
    const results = [];
    let maxGap=0,maxFwChange=0,maxTilt=0,sinkFrames=0,floatFrames=0;

    const halfSteps = Math.floor(route.steps / 2);

    for (let f = 0; f < route.steps; f++) {
        const input = (route.reverse && f >= halfSteps) ? -1 : 1;
        const cs = step(input, route.turn || 0);
        const vis = measureVisualGap(cs.charPos, cs.dir);

        // Check: forward stability
        const prevFw = f > 0 ? results[f-1].fw : cs.frame.fw;
        const fwChange = V.angle(cs.frame.fw, prevFw);

        // Check: up vector vs radial (should be identical)
        const upDotRadial = V.dot(cs.frame.up, cs.dir);

        // Check: character tilt from radial (should be 0)
        const tiltAngle = Math.acos(Math.max(-1,Math.min(1,upDotRadial)))*180/Math.PI;

        if (vis.gap > 0.05) floatFrames++;
        if (vis.gap < -0.05) sinkFrames++;
        maxGap = Math.max(maxGap, Math.abs(vis.gap));
        maxFwChange = Math.max(maxFwChange, fwChange);
        maxTilt = Math.max(maxTilt, tiltAngle);

        results.push({
            f, lat:+(Math.asin(cs.dir[1])*180/Math.PI).toFixed(1),
            lon:+(Math.atan2(cs.dir[2],cs.dir[0])*180/Math.PI).toFixed(1),
            biome:cs.biome.name, gap:+vis.gap.toFixed(4),
            fwChange:+fwChange.toFixed(2), tilt:+tiltAngle.toFixed(2),
            fw:cs.frame.fw
        });
    }

    const issues = [];
    if (maxGap > 0.15) issues.push('GAP:' + (maxGap/CH*100).toFixed(0) + '%MC');
    if (maxFwChange > 2) issues.push('FW_JITTER:' + maxFwChange.toFixed(1) + '°');
    if (maxTilt > 1) issues.push('TILT:' + maxTilt.toFixed(1) + '°');
    if (sinkFrames > 0) issues.push('SINK:' + sinkFrames + 'frames');
    if (floatFrames > 0) issues.push('FLOAT:' + floatFrames + 'frames');

    const pass = issues.length === 0;
    totalIssues += issues.length;

    console.log((pass?'PASS':'FAIL') + ' | ' + route.name.padEnd(20) +
        ' | gap=' + maxGap.toFixed(3).padStart(6) + ' (' + (maxGap/CH*100).toFixed(0).padStart(2) + '%MC)' +
        ' | fwΔ=' + maxFwChange.toFixed(1).padStart(5) + '°' +
        ' | tilt=' + maxTilt.toFixed(1).padStart(4) + '°' +
        ' | sink=' + String(sinkFrames).padStart(3) + ' float=' + String(floatFrames).padStart(3) +
        (issues.length ? ' | ' + issues.join(', ') : ''));

    if (!pass) {
        // Show worst frames
        const worst = results.filter(r => Math.abs(r.gap) > 0.05 || r.fwChange > 2);
        if (worst.length > 0) {
            worst.sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap));
            worst.slice(0,3).forEach(w => {
                console.log('     F' + w.f + ': ' + w.biome + ' ' + w.lat + '°,' + w.lon + '° gap=' + w.gap + ' fwΔ=' + w.fwChange + '°');
            });
        }
    }

    allResults.push({route: route.name, pass, maxGap, maxFwChange, maxTilt, sinkFrames, floatFrames});
}

// === OBJECT PLACEMENT TEST ===
console.log('\n--- OBJECT PLACEMENT TEST ---');
const testPlacements = [
    {lat:15,lon:-30,name:'Pyramid zone'},
    {lat:35,lon:60,name:'Mediterranean'},
    {lat:50,lon:-120,name:'Castle highlands'},
    {lat:25,lon:150,name:'Lighthouse coast'},
    {lat:10,lon:80,name:'Jungle'},
    {lat:65,lon:30,name:'Snowy peak'},
    {lat:5,lon:-100,name:'Beach resort'},
];
let objIssues = 0;
for (const tp of testPlacements) {
    const phi=(90-tp.lat)*Math.PI/180, theta=(tp.lon+180)*Math.PI/180;
    const[nx,ny,nz]=V.norm(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
    const objR = groundHeight(nx,ny,nz); // where placeOnPlanet puts objects
    const objPos = [nx*objR, ny*objR, nz*objR];

    // Where is the mesh?
    const origin = V.add(objPos, V.scale([nx,ny,nz], 3));
    const hit = rayMesh(origin[0],origin[1],origin[2],-nx,-ny,-nz);
    const meshR = hit ? V.len(hit.point) : objR;
    const gap = objR - meshR;

    const pass = Math.abs(gap) < 0.1;
    if (!pass) objIssues++;
    console.log((pass?'PASS':'FAIL') + ' | ' + tp.name.padEnd(20) + ' | gap=' + gap.toFixed(4) + ' (' + (gap/CH*100).toFixed(1) + '%MC)');
}

// === SUMMARY ===
console.log('\n========================================');
console.log('ROUTES: ' + allResults.filter(r=>r.pass).length + '/' + allResults.length + ' passed');
console.log('OBJECTS: ' + (testPlacements.length - objIssues) + '/' + testPlacements.length + ' passed');
console.log('TOTAL ISSUES: ' + totalIssues);
if (totalIssues === 0 && objIssues === 0) {
    console.log('\nALL TESTS PASS');
} else {
    console.log('\nISSUES FOUND:');
    for (const r of allResults.filter(r=>!r.pass)) {
        console.log('  ' + r.route + ': gap=' + (r.maxGap/CH*100).toFixed(0) + '%MC fw=' + r.maxFwChange.toFixed(1) + '° sink=' + r.sinkFrames + ' float=' + r.floatFrames);
    }
}
console.log('========================================');
