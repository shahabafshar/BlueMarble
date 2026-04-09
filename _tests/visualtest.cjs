const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

(async () => {
    console.log('=== VISUAL GROUND ADHERENCE TEST ===\n');

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
               '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname, '..', 'index.html')).replace(/\\/g, '/');
    console.log('Loading game...');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 6000));

    if (errs.length > 0) {
        console.log('ERRORS DURING LOAD:');
        errs.forEach(e => console.log('  ' + e));
        await browser.close();
        return;
    }

    // Check game loaded
    const hasGame = await page.evaluate(() => typeof window._game !== 'undefined');
    if (!hasGame) {
        console.log('FATAL: window._game not found — game did not initialize');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FAIL_no_game.png') });
        await browser.close();
        return;
    }
    console.log('Game loaded OK\n');

    // === TEST SCENARIOS ===
    const scenarios = [
        { name: '01_start',       desc: 'Initial position',           steps: 0,   turn: 0,    camMode: 3 },
        { name: '02_flat_walk',    desc: 'Walk on flat terrain',       steps: 80,  turn: 0,    camMode: 3 },
        { name: '03_uphill',       desc: 'Walk uphill',                steps: 120, turn: 0,    camMode: 3 },
        { name: '04_slope_side',   desc: 'Walk across slope sideways', steps: 80,  turn: 0.03, camMode: 3 },
        { name: '05_closeup',      desc: 'Close-up view (mode 2)',     steps: 40,  turn: 0,    camMode: 2 },
        { name: '06_firstperson',  desc: 'First person (mode 1)',      steps: 40,  turn: 0,    camMode: 1 },
        { name: '07_steep',        desc: 'Walk on steep terrain',      steps: 100, turn: 0.01, camMode: 3 },
        { name: '08_ocean_edge',   desc: 'Walk into ocean boundary',   steps: 100, turn: 0.02, camMode: 3 },
    ];

    const allResults = [];

    for (const sc of scenarios) {
        console.log(`${sc.name}: ${sc.desc}...`);

        const data = await page.evaluate((steps, turnRate, mode) => {
            const G = window._game;
            G.setCamMode(mode);

            const frames = [];
            for (let i = 0; i < Math.max(1, steps); i++) {
                // Simulate walking
                if (steps > 0) {
                    G.player.vFwd += (G.MAX_WALK - G.player.vFwd) * G.WALK_ACCEL * (1/60) * 60;
                    G.player.vFwd *= G.GROUND_DRAG;
                    G.moveOnSurface(G.player.vFwd, turnRate);
                }
                const cs = G.updateChar();
                G.updateCam(cs);

                const dir = G.player.groundPos.clone().normalize();
                const expectedR = G.groundHeight(dir.x, dir.y, dir.z);
                const actualR = G.player.groundPos.length();
                const biome = G.getBiome(dir.x, dir.y, dir.z);

                // Get screen-space Y of character feet
                const feetWorld = G.character.position.clone();
                const feetScreen = feetWorld.clone().project(G.camera);

                // Get screen-space Y of ground directly below camera target
                const groundPoint = G.player.groundPos.clone();
                const groundScreen = groundPoint.clone().project(G.camera);

                frames.push({
                    gap: actualR - expectedR,
                    charScreenY: feetScreen.y,
                    groundScreenY: groundScreen.y,
                    screenGap: feetScreen.y - groundScreen.y,
                    lat: Math.asin(dir.y) * 180 / Math.PI,
                    lon: Math.atan2(dir.z, dir.x) * 180 / Math.PI,
                    biome: biome.name,
                    charR: actualR,
                    groundR: expectedR,
                    camDist: G.camera.position.distanceTo(feetWorld),
                });
            }
            // Render
            G.renderer.render(G.scene, G.camera);

            return frames;
        }, sc.steps, sc.turn, sc.camMode);

        // Screenshot
        const ssPath = path.join(SCREENSHOT_DIR, sc.name + '.png');
        await page.screenshot({ path: ssPath });

        // Analyze
        const gaps = data.map(f => f.gap);
        const screenGaps = data.map(f => f.screenGap);
        const maxGap = Math.max(...gaps.map(Math.abs));
        const maxScreenGap = Math.max(...screenGaps.map(Math.abs));
        const lastFrame = data[data.length - 1];

        const issues = [];
        if (maxGap > 0.05) issues.push('WORLD_GAP:' + maxGap.toFixed(3));
        if (maxScreenGap > 0.05) issues.push('SCREEN_GAP:' + maxScreenGap.toFixed(3));

        const pass = issues.length === 0;
        allResults.push({ name: sc.name, pass, maxGap, maxScreenGap, issues, lastFrame });

        console.log(`  ${pass ? 'PASS' : 'FAIL'} | worldGap=${maxGap.toFixed(4)} screenGap=${maxScreenGap.toFixed(4)} | ${lastFrame.biome} ${lastFrame.lat.toFixed(1)}°`);
        if (issues.length > 0) console.log('  Issues: ' + issues.join(', '));
    }

    // === SUMMARY ===
    console.log('\n=== SUMMARY ===');
    const passed = allResults.filter(r => r.pass).length;
    console.log(`${passed}/${allResults.length} scenarios passed`);
    for (const r of allResults.filter(r => !r.pass)) {
        console.log(`  FAIL: ${r.name} — ${r.issues.join(', ')}`);
    }
    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);

    await browser.close();
    console.log('\n=== TEST COMPLETE ===');
})().catch(e => {
    console.error('Test crashed:', e.message);
    process.exit(1);
});
