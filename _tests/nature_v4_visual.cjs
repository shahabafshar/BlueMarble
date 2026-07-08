// Visual verification of v4: rocks should be solid (no jitter mangling),
// trees/bushes should keep their original 2-material colors (leafy + brown)
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    // Inspect a rock and a tree to confirm material counts + colors
    const data = await page.evaluate(() => {
        const G = window._game;

        function inspect(obj) {
            const child = obj.mesh.children[0];
            const colors = [];
            (child || obj.mesh).traverse(n => {
                if (n.isMesh && n.material) {
                    const mats = Array.isArray(n.material) ? n.material : [n.material];
                    for (const m of mats) {
                        if (m.color) colors.push('#' + m.color.getHexString());
                    }
                }
            });
            // Vertex range to detect mangled geometry
            let firstMesh = null;
            (child || obj.mesh).traverse(n => { if (!firstMesh && n.isMesh) firstMesh = n; });
            const p = firstMesh && firstMesh.geometry && firstMesh.geometry.getAttribute('position');
            let vRange = null;
            if (p) {
                let mn=Infinity, mx=-Infinity;
                for (let i = 0; i < p.count; i++) {
                    const v = Math.abs(p.getY(i));
                    if (v > mx) mx = v;
                    if (v < mn) mn = v;
                }
                vRange = [mn.toFixed(3), mx.toFixed(3)];
            }
            // World bbox to confirm visible size
            obj.mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(obj.mesh);
            const sz = new THREE.Vector3();
            box.getSize(sz);
            return {
                colors,
                vertexLocalYRange: vRange,
                worldSize: [sz.x.toFixed(2), sz.y.toFixed(2), sz.z.toFixed(2)],
                groupRotY: child ? child.rotation.y.toFixed(2) : null,
                groupScale: child ? [child.scale.x.toFixed(2), child.scale.y.toFixed(2), child.scale.z.toFixed(2)] : null,
            };
        }

        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const trees = G.world.all.filter(o => o.type === 'tree' && o.category === 'vegetation');
        const bushes = G.world.all.filter(o => o.type === 'bush' && o.category === 'vegetation');

        return {
            rock0: inspect(rocks[0]),
            rock_random: inspect(rocks[Math.floor(rocks.length / 2)]),
            tree0: inspect(trees[0]),
            tree_random: inspect(trees[Math.floor(trees.length / 2)]),
            bush0: inspect(bushes[0]),
        };
    });
    console.log(JSON.stringify(data, null, 2));

    // Walk to a tree-heavy zone (Mediterranean village = lat 37, lon 60)
    await page.evaluate(() => {
        const G = window._game;
        const phi = (90 - 37) * Math.PI / 180;
        const theta = (60 + 180) * Math.PI / 180;
        const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        const r = G.groundHeight(dir.x, dir.y, dir.z);
        G.player.groundPos.copy(dir.multiplyScalar(r));
        G.setCamMode(3);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','nature_v4_med.png') });

    // Walk to a desert camp (rocks visible)
    await page.evaluate(() => {
        const G = window._game;
        const cf = G.world.all.find(o => o.type === 'campfire' && o.name === 'Desert Camp');
        if (!cf) return;
        const dir = cf.pos.clone().normalize();
        const back = new THREE.Vector3(0.04, 0, 0.04).add(dir).normalize();
        const r = G.groundHeight(back.x, back.y, back.z);
        G.player.groundPos.copy(back.multiplyScalar(r));
        G.setCamMode(3);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','nature_v4_desert.png') });

    console.log('\nSaved nature_v4_med.png + nature_v4_desert.png');
    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
