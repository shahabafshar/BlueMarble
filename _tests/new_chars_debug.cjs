const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    page.on('pageerror', e => console.log('PAGEERR:', e.message));
    page.on('console', m => console.log('[' + m.type() + ']', m.text()));

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await new Promise(r => setTimeout(r, 8000));

    // Wait for ritual
    let waited = 0;
    while (waited < 25000) {
        const done = await page.evaluate(() => window._game.player.ritualStartTime > 0 && !window._game.player.ritualActive);
        if (done) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }

    // Try cycling directly to Soldier (idx 6 = 6 M presses from 0)
    console.log('\n=== Pressing M 6 times ===');
    for (let i = 0; i < 6; i++) {
        const before = await page.evaluate(() => ({
            idx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
            anims: Object.keys(window._game.character.userData.glb.actions),
        }));
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
        // Long wait for async parse
        await new Promise(r => setTimeout(r, 2500));
        const after = await page.evaluate(() => ({
            idx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
            anims: Object.keys(window._game.character.userData.glb.actions),
        }));
        console.log('press ' + (i+1) + ': idx ' + before.idx + ' -> ' + after.idx + '  anims=[' + after.anims.slice(0,3).join(',') + '...(' + after.anims.length + ')]');
    }

    await browser.close();
})().catch(e => console.error(e));
