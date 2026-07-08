// Diagnose what's actually wrong with rocks and campfires
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    page.on('pageerror', e => console.log('PAGEERR:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    // Diagnose rocks: report sizes of upgraded rock GLBs
    const diagnostic = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const sample = rocks.slice(0, 8).map(o => {
            o.mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(o.mesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            return {
                lat: o.lat.toFixed(1),
                lon: o.lon.toFixed(1),
                scale: o.scale.toFixed(2),
                worldSize: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
                childCount: o.mesh.children.length,
            };
        });

        // Diagnose campfires
        const campfires = G.world.all.filter(o => o.type === 'campfire');
        const cfSample = campfires.slice(0, 3).map(o => {
            o.mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(o.mesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            // Count what kinds of children it has
            let dodecCount = 0, totalChildren = 0, hasFireLight = false;
            o.mesh.traverse(n => {
                if (n.isMesh) {
                    totalChildren++;
                    if (n.geometry && n.geometry.type === 'DodecahedronGeometry') dodecCount++;
                }
                if (n.isLight) hasFireLight = true;
            });
            return {
                name: o.name,
                category: o.category,
                worldSize: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
                meshCount: totalChildren,
                dodecCount,
                hasFireLight,
                groupChildren: o.mesh.children.length,
            };
        });

        return {
            rockCount: rocks.length,
            rockSample: sample,
            campfireCount: campfires.length,
            campfireSample: cfSample,
        };
    });
    console.log(JSON.stringify(diagnostic, null, 2));

    // Find the closest campfire and screenshot it
    await page.evaluate(() => {
        const G = window._game;
        const campfires = G.world.all.filter(o => o.type === 'campfire');
        if (!campfires.length) return;
        // Move player next to the first campfire
        const cf = campfires[0];
        const dir = cf.pos.clone().normalize();
        const r = G.groundHeight(dir.x, dir.y, dir.z);
        // Sit slightly back so the campfire is in frame
        const back = new THREE.Vector3(0.04, 0, 0.04).add(dir).normalize();
        const backR = G.groundHeight(back.x, back.y, back.z);
        G.player.groundPos.copy(back.multiplyScalar(backR));
        G.setCamMode(3);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(__dirname,'screenshots','campfire_diagnostic.png') });
    console.log('Saved campfire_diagnostic.png');

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
