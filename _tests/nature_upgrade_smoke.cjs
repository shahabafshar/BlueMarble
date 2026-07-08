// Verify the nature GLB upgrade pipeline:
//   - All 11 nature GLBs parse
//   - upgradeNatureToGLB runs and reports a non-zero count
//   - Rocks/trees/bushes in world.all have non-procedural meshes after the upgrade
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
    const logs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => {
        const t = m.text();
        if (m.type() === 'error') errs.push('[err] ' + t);
        if (t.includes('[nature]') || t.includes('[fox]') || t.includes('[npc]') || t.includes('[char]')) logs.push(t);
    });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await new Promise(r => setTimeout(r, 12000)); // longer wait — 11 GLBs to parse

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    console.log('=== NATURE UPGRADE SMOKE TEST ===\n');
    console.log('Boot logs:');
    logs.forEach(l => console.log('  ' + l));
    console.log('');

    // Inventory: count rocks/trees/bushes by category, see how many have
    // GLB-loaded materials vs procedural geometry
    const inventory = await page.evaluate(() => {
        const G = window._game;
        const counts = { rock: 0, tree: 0, bush: 0 };
        const upgraded = { rock: 0, tree: 0, bush: 0 };
        for (const obj of G.world.all) {
            if (obj.category !== 'vegetation') continue;
            if (!(obj.type in counts)) continue;
            counts[obj.type]++;
            // After upgrade, the obj.mesh has exactly ONE child (the
            // replacement Group), and that child's first mesh has cloned
            // materials (with userData._origColor or flatShading=true).
            // Procedural rocks have multiple mesh children directly.
            const childCount = obj.mesh.children.length;
            // A procedurally-built lpRock has 3 children (main + 2 satellites).
            // After upgrade, exactly 1 child (the replacement Group).
            if (childCount === 1) upgraded[obj.type]++;
        }
        return { counts, upgraded };
    });
    console.log('inventory:', JSON.stringify(inventory, null, 2));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['No load errors',                      errs.length === 0],
        ['Nature upgrade ran (log present)',    logs.some(l => l.includes('[nature]'))],
        ['World has rocks',                     inventory.counts.rock > 0],
        ['World has trees',                     inventory.counts.tree > 0],
        ['World has bushes',                    inventory.counts.bush > 0],
        ['ALL rocks were upgraded',             inventory.upgraded.rock === inventory.counts.rock],
        ['ALL trees were upgraded',             inventory.upgraded.tree === inventory.counts.tree],
        ['ALL bushes were upgraded',            inventory.upgraded.bush === inventory.counts.bush],
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
