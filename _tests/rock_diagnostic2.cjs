// Deeper diagnostic: measure procedural vs GLB sizes for the same rock
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    const data = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const out = [];
        for (let i = 0; i < Math.min(5, rocks.length); i++) {
            const o = rocks[i];
            // Measure parent scale, child local bbox, world bbox
            const parentScale = o.scale;
            // Local bbox: temporarily zero parent scale and measure
            const savedScale = o.mesh.scale.clone();
            o.mesh.scale.set(1, 1, 1);
            o.mesh.updateMatrixWorld(true);
            const localBox = new THREE.Box3().setFromObject(o.mesh);
            const localSize = new THREE.Vector3();
            localBox.getSize(localSize);
            o.mesh.scale.copy(savedScale);
            o.mesh.updateMatrixWorld(true);
            // World bbox
            const worldBox = new THREE.Box3().setFromObject(o.mesh);
            const worldSize = new THREE.Vector3();
            worldBox.getSize(worldSize);
            out.push({
                idx: i,
                parentScale: parentScale.toFixed(3),
                localY: localSize.y.toFixed(3),
                worldY: worldSize.y.toFixed(3),
                ratio: (worldSize.y / Math.max(0.001, localSize.y)).toFixed(2),
            });
        }
        return out;
    });
    console.log(JSON.stringify(data, null, 2));

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
