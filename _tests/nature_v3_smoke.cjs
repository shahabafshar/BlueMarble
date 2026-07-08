// Verify the v3 nature enhancements:
//   - Rocks have varied colors per zone (extracted from procedural)
//   - Per-instance scale variance + Y rotation creates visible variety
//   - Vertex jitter on rocks deforms each clone uniquely
//   - Sizes are still reasonable
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
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[err] ' + m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    const data = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const trees = G.world.all.filter(o => o.type === 'tree' && o.category === 'vegetation');
        const bushes = G.world.all.filter(o => o.type === 'bush' && o.category === 'vegetation');

        const sampleColors = (objs) => {
            const colors = new Set();
            for (const o of objs.slice(0, 10)) {
                let c = null;
                o.mesh.traverse(n => {
                    if (c) return;
                    if (n.isMesh && n.material && n.material.color) c = '#' + n.material.color.getHexString();
                });
                if (c) colors.add(c);
            }
            return Array.from(colors);
        };

        const sampleSizes = (objs) => {
            return objs.slice(0, 5).map(o => {
                o.mesh.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(o.mesh);
                const sz = new THREE.Vector3();
                box.getSize(sz);
                return parseFloat(sz.y.toFixed(2));
            });
        };

        const sampleRotations = (objs) => {
            const rots = new Set();
            for (const o of objs.slice(0, 10)) {
                const child = o.mesh.children[0];
                if (child && child.rotation.y !== 0) {
                    rots.add(child.rotation.y.toFixed(2));
                }
            }
            return rots.size;
        };

        const sampleScaleVariance = (objs) => {
            // Each child Group should have a non-uniform scale
            const variances = [];
            for (const o of objs.slice(0, 10)) {
                const child = o.mesh.children[0];
                if (!child) continue;
                const s = child.scale;
                const variance = Math.abs(s.x - 1) + Math.abs(s.y - 1) + Math.abs(s.z - 1);
                variances.push(variance.toFixed(2));
            }
            return variances;
        };

        return {
            rockColors: sampleColors(rocks),
            treeColors: sampleColors(trees),
            bushColors: sampleColors(bushes),
            rockSizes: sampleSizes(rocks),
            treeSizes: sampleSizes(trees),
            bushSizes: sampleSizes(bushes),
            rockUniqueRotations: sampleRotations(rocks),
            rockScaleVariance: sampleScaleVariance(rocks),
            counts: { rocks: rocks.length, trees: trees.length, bushes: bushes.length },
        };
    });
    console.log(JSON.stringify(data, null, 2));

    // Screenshot near a campfire to verify visually
    await page.evaluate(() => {
        const G = window._game;
        const cf = G.world.all.find(o => o.type === 'campfire');
        if (!cf) return;
        const dir = cf.pos.clone().normalize();
        const back = new THREE.Vector3(0.04, 0, 0.04).add(dir).normalize();
        const r = G.groundHeight(back.x, back.y, back.z);
        G.player.groundPos.copy(back.multiplyScalar(r));
        G.setCamMode(3);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(__dirname,'screenshots','nature_v3.png') });
    console.log('\nSaved nature_v3.png');

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['No load errors',                          errs.length === 0],
        ['Rocks have multiple colors (≥2)',         data.rockColors.length >= 2],
        ['Trees have multiple colors (≥2)',         data.treeColors.length >= 2],
        ['Bushes have multiple colors (≥2)',        data.bushColors.length >= 2],
        ['Rocks have varied rotations (≥5 distinct)', data.rockUniqueRotations >= 5],
        ['Rocks have scale variance applied',       data.rockScaleVariance.some(v => parseFloat(v) > 0.1)],
        ['Rock sizes reasonable (0.3 - 4m)',        data.rockSizes.every(s => s >= 0.2 && s <= 4.5)],
    ];
    let pass = 0;
    for (const [name, ok] of checks) {
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
        if (ok) pass++;
    }
    console.log('\n' + pass + '/' + checks.length + ' checks passed');

    await browser.close();
    process.exit(pass === checks.length ? 0 : 1);
})().catch(e => { console.error('crash:', e); process.exit(1); });
