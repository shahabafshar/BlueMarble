// Capture: a rock area in-game, plus one of the source GLB rocks loaded fresh
// in preview.html for direct comparison
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // 1) Load preview.html fresh and drop a GLB rock onto it
    const previewPath = 'file:///' + path.resolve(path.join(__dirname,'..','characters','preview.html')).replace(/\\/g,'/');
    await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    const buf = fs.readFileSync(path.resolve(path.join(__dirname,'..','characters','nature','Rock1.glb')));
    const b64 = buf.toString('base64');
    await page.evaluate(async (b64) => {
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        window.loadFromArrayBuffer(bytes.buffer, 'Rock1.glb');
        await new Promise(r => setTimeout(r, 1500));
    }, b64);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(__dirname,'screenshots','rock_source_glb.png') });
    console.log('Saved rock_source_glb.png (the original GLB rock)');

    // 2) Now load index.html and walk to a rock-heavy area
    const gamePath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(gamePath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    // Inspect a few rocks to understand the difference
    const inspect = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const out = [];
        for (let i = 0; i < 3; i++) {
            const o = rocks[i];
            const child = o.mesh.children[0];
            const inner = child && child.children[0];
            // Walk into the model and find the first mesh
            let firstMesh = null;
            (child || o.mesh).traverse(n => { if (!firstMesh && n.isMesh) firstMesh = n; });
            const g = firstMesh && firstMesh.geometry;
            const positions = g && g.getAttribute('position');
            // Sample 5 vertex positions to see if jitter wrecked the mesh
            const samples = positions ? Array.from({length:5}, (_,k) => {
                const idx = Math.floor((k/5) * positions.count);
                return [positions.getX(idx).toFixed(2), positions.getY(idx).toFixed(2), positions.getZ(idx).toFixed(2)];
            }) : null;
            out.push({
                idx: i,
                vertexCount: positions ? positions.count : 0,
                sampleVerts: samples,
                materialColor: firstMesh && firstMesh.material ? '#' + firstMesh.material.color.getHexString() : null,
                materialFlatShading: firstMesh && firstMesh.material ? firstMesh.material.flatShading : null,
                materialVertexColors: firstMesh && firstMesh.material ? firstMesh.material.vertexColors : null,
                groupScale: child ? [child.scale.x.toFixed(2), child.scale.y.toFixed(2), child.scale.z.toFixed(2)] : null,
                groupRotY: child ? child.rotation.y.toFixed(2) : null,
            });
        }
        return out;
    });
    console.log('In-game rocks:', JSON.stringify(inspect, null, 2));

    // Walk player to a rock area
    await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        if (!rocks.length) return;
        const r = rocks[0];
        const dir = r.pos.clone().normalize();
        const back = new THREE.Vector3(0.03, 0, 0.03).add(dir).normalize();
        const rad = G.groundHeight(back.x, back.y, back.z);
        G.player.groundPos.copy(back.multiplyScalar(rad));
        G.setCamMode(2);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','rock_in_game.png') });
    console.log('Saved rock_in_game.png');

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
