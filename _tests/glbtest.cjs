// Focused test: load the game, verify the GLB character loaded,
// switch animations by simulating walk, and capture screenshots.
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
               '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    const logs = [];
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => {
        const t = '[' + m.type() + '] ' + m.text();
        logs.push(t);
        if (m.type() === 'error') errs.push(t);
    });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname, '..', 'index.html')).replace(/\\/g, '/');
    console.log('Loading:', htmlPath);
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 8000));

    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));

    console.log('\n=== ERRORS ===');
    if (errs.length === 0) console.log('(none)');
    else errs.forEach(e => console.log(e));

    const result = await page.evaluate(() => {
        const c = window._game && window._game.character;
        if (!c) return { error: 'no character' };
        const childCount = c.children.length;
        const hasGlb = !!(c.userData && c.userData.glb);
        const animations = hasGlb ? Object.keys(c.userData.glb.actions) : [];
        const currentAction = hasGlb ? c.userData.glb.currentAction : null;
        const box = new THREE.Box3().setFromObject(c);
        const size = new THREE.Vector3();
        box.getSize(size);
        return {
            childCount, hasGlb, animations, currentAction,
            boxSize: { x: size.x.toFixed(3), y: size.y.toFixed(3), z: size.z.toFixed(3) },
            charScale: { x: c.scale.x.toFixed(3), y: c.scale.y.toFixed(3), z: c.scale.z.toFixed(3) },
            posLen: c.position.length().toFixed(3),
        };
    });
    console.log('\n=== CHARACTER STATE ===');
    console.log(JSON.stringify(result, null, 2));

    await page.evaluate(() => window._game.setCamMode(2));
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'glbtest_close.png') });

    await page.evaluate(async () => {
        const G = window._game;
        for (let i = 0; i < 60; i++) {
            G.player.vFwd = 0.5;
            G.moveOnSurface(G.player.vFwd, 0, 0);
            G.updateChar();
        }
    });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'glbtest_walking.png') });

    const finalAction = await page.evaluate(() => {
        const c = window._game.character;
        return c.userData.glb ? c.userData.glb.currentAction : null;
    });
    console.log('\nAction after walking:', finalAction);

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
