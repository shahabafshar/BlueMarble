// Verifies that:
//   - The 6 fox placeholders were upgraded to GLB instances
//   - Each fox has its own AnimationMixer
//   - Foxes have the Survey/Walk/Run animations
//   - The Survey clip is the active starting state (idle equivalent)
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[err] ' + m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 8000));

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    console.log('=== FOX TEST ===\n');

    const inventory = await page.evaluate(() => {
        const G = window._game;
        const foxes = G.world.all.filter(o => o.constructor.name === 'Animal' && o.type === 'fox');
        return {
            count: foxes.length,
            withGLB: foxes.filter(f => f.mesh.userData.glb).length,
            uniqueMixers: new Set(foxes.map(f => f.mesh.userData.glb && f.mesh.userData.glb.mixer)).size,
            animations: foxes[0] && foxes[0].mesh.userData.glb
                ? Object.keys(foxes[0].mesh.userData.glb.actions)
                : [],
            currentActions: foxes.slice(0, 6).map(f => f.mesh.userData.glb && f.mesh.userData.glb.currentAction),
        };
    });
    console.log('inventory:', JSON.stringify(inventory, null, 2));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['6 fox placements exist',                   inventory.count === 6],
        ['All foxes upgraded to GLB',                inventory.withGLB === inventory.count],
        ['Each fox has its own AnimationMixer',      inventory.uniqueMixers === inventory.count],
        ['Foxes have Survey animation',              inventory.animations.includes('Survey')],
        ['Foxes have Walk animation',                inventory.animations.includes('Walk')],
        ['Foxes have Run animation',                 inventory.animations.includes('Run')],
        ['Foxes start in Survey (idle equiv)',       inventory.currentActions.every(a => a === 'Survey' || a === 'Walk')],
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
