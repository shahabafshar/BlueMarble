// Single fast smoke test:
//   1. Game loads with no errors
//   2. Procedural wave functions are gone
//   3. cycleTaunt cycles through Robot's non-movement clips
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
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await new Promise(r => setTimeout(r, 8000));

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    // Wait for ritual to complete
    let waited = 0;
    while (waited < 25000) {
        const done = await page.evaluate(() => window._game.player.ritualStartTime > 0 && !window._game.player.ritualActive);
        if (done) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }

    console.log('=== TAUNT SMOKE TEST ===\n');

    // Verify procedural wave is gone (functions should not exist anywhere
    // accessible). We can't read internal scope but we can check that the
    // current GLB has no proceduralWave / armBone fields after a wave.
    const checkProcGone = await page.evaluate(() => {
        const u = window._game.character.userData.glb;
        // Check the source of playOneShot to ensure it doesn't reference procedural wave
        return {
            hasGlb: !!u,
            hasProcWaveField: u && 'proceduralWave' in u,
            hasArmBoneField: u && 'armBone' in u,
        };
    });
    console.log('post-load state:', JSON.stringify(checkProcGone));

    // Trigger taunts (B) several times on the Robot (default character).
    // Robot's taunts: Wave, Dance, Yes, No, ThumbsUp, Sitting, Standing, Punch
    // (excluding movement: Idle, Walking, Running, Jump, WalkJump, Death)
    const taunts = [];
    for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })));
        await new Promise(r => setTimeout(r, 250));
        const cur = await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            return { oneShot: u.oneShot, currentAction: u.currentAction, tauntIdx: u.tauntIdx };
        });
        taunts.push(cur);
        console.log('B#' + (i+1) + ':', JSON.stringify(cur));
    }

    const uniqueTaunts = new Set(taunts.map(t => t.oneShot).filter(x => x));
    console.log('\nunique taunts seen:', Array.from(uniqueTaunts));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['No load errors',                          errs.length === 0],
        ['Game loaded with GLB',                    checkProcGone.hasGlb === true],
        ['No proceduralWave field on glb',          checkProcGone.hasProcWaveField === false],
        ['Taunt B fired at least 5 distinct',      uniqueTaunts.size >= 5],
        ['Taunts include real Robot clips',        uniqueTaunts.has('Wave') && uniqueTaunts.has('Dance')],
        ['No movement clip leaked into taunts',    !uniqueTaunts.has('Idle') && !uniqueTaunts.has('Walking') && !uniqueTaunts.has('Running')],
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
