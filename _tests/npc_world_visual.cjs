// Visual capture: load the game, wait for ritual to finish, walk near
// the closest NPC, and screenshot. Also cycle MC color and screenshot.
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/'), { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 8000));

    // Wait for ritual to finish
    let waited = 0;
    while (waited < 25000) {
        const done = await page.evaluate(() => window._game.player.ritualStartTime > 0 && !window._game.player.ritualActive);
        if (done) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }

    // Stay at the natural start position; switch to close-up camera
    await page.evaluate(() => window._game.setCamMode(2));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(__dirname,'screenshots','mc_default.png') });

    // Cycle MC color and screenshot each
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
        await new Promise(r => setTimeout(r, 700));
        await page.screenshot({ path: path.join(__dirname,'screenshots','mc_color_' + (i+1) + '.png') });
    }

    // Switch to orbit + zoom out to capture an overview with NPCs
    await page.evaluate(() => {
        window._game.setCamMode(3);
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(__dirname,'screenshots','world_overview.png') });

    await browser.close();
    console.log('Saved screenshots');
})().catch(e => { console.error(e); process.exit(1); });
