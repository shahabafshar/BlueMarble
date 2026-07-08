// Diagnose: material types of upgraded objects + state of campfires
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    const data = await page.evaluate(() => {
        const G = window._game;

        // 1. Material types of upgraded vegetation
        const veg = G.world.all.filter(o => o.category === 'vegetation' && (o.type === 'rock' || o.type === 'tree' || o.type === 'bush'));
        const matSamples = {};
        for (const t of ['rock', 'tree', 'bush']) {
            const obj = veg.find(o => o.type === t);
            if (!obj) continue;
            const mats = [];
            obj.mesh.traverse(n => {
                if (n.isMesh && n.material) {
                    const ms = Array.isArray(n.material) ? n.material : [n.material];
                    for (const m of ms) {
                        mats.push({
                            type: m.type,
                            color: '#' + m.color.getHexString(),
                            roughness: m.roughness !== undefined ? m.roughness : 'n/a',
                            metalness: m.metalness !== undefined ? m.metalness : 'n/a',
                            flatShading: m.flatShading,
                        });
                    }
                }
            });
            matSamples[t] = mats;
        }

        // 2. Campfires inventory + condition
        const campfires = G.world.all.filter(o => o.type === 'campfire');
        const cfData = campfires.map(o => {
            o.mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(o.mesh);
            const sz = new THREE.Vector3();
            box.getSize(sz);
            // Count children meshes vs lights
            let meshCount = 0, lightCount = 0;
            o.mesh.traverse(n => {
                if (n.isMesh) meshCount++;
                if (n.isLight) lightCount++;
            });
            return {
                name: o.name,
                category: o.category,
                groupChildCount: o.mesh.children.length,
                meshCount, lightCount,
                worldSize: [sz.x.toFixed(2), sz.y.toFixed(2), sz.z.toFixed(2)],
                pos: [o.mesh.position.x.toFixed(1), o.mesh.position.y.toFixed(1), o.mesh.position.z.toFixed(1)],
            };
        });

        // 3. Original procedural lpTree colors used in zones (from the lp* calls)
        // Find a procedural tree color from world (we kept the dominant colors)
        const treeColorsUsed = new Set();
        for (const o of veg) {
            if (o.type === 'tree' && o._dominantColor) {
                treeColorsUsed.add('#' + o._dominantColor.getHexString());
            }
        }

        return {
            materials: matSamples,
            campfires: cfData,
            originalTreeColors: Array.from(treeColorsUsed),
        };
    });
    console.log(JSON.stringify(data, null, 2));

    // Walk to a campfire and take a screenshot
    await page.evaluate(() => {
        const G = window._game;
        const cf = G.world.all.find(o => o.type === 'campfire' && o.name === 'Desert Camp');
        if (!cf) return;
        const dir = cf.pos.clone().normalize();
        // Move player a tiny bit back
        const back = new THREE.Vector3(0.025, 0, 0.025).add(dir).normalize();
        const r = G.groundHeight(back.x, back.y, back.z);
        G.player.groundPos.copy(back.multiplyScalar(r));
        G.setCamMode(2);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','diag_v4_campfire.png') });
    console.log('saved diag_v4_campfire.png');

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
