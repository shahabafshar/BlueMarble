// Visual capture: cycle to the Girl character (index 4) and screenshot.
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });
    await page.goto('file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/'), { waitUntil: 'domcontentloaded' });
    // Clear localStorage so we always start at character index 0 (Robot)
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

    await page.evaluate(() => window._game.setCamMode(2));
    await new Promise(r => setTimeout(r, 300));

    // Press M 4 times to reach index 4 (Girl). Poll for the new character's
    // animCount (Girl has 4 clips) to ensure async parse completes.
    const expectedAnims = [14, 14, 1, 1, 4]; // initial=Robot(14), then Robo Tot, Human, Tall One, Girl
    for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
        const target = expectedAnims[i + 1];
        let waited = 0;
        while (waited < 15000) {
            const got = await page.evaluate(() => Object.keys(window._game.character.userData.glb.actions).length);
            if (got === target) break;
            await new Promise(r => setTimeout(r, 200));
            waited += 200;
        }
        await new Promise(r => setTimeout(r, 300));
    }

    const state = await page.evaluate(() => {
        const u = window._game.character.userData.glb;
        return {
            charIdx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
            animCount: u ? Object.keys(u.actions).length : 0,
            animNames: u ? Object.keys(u.actions) : [],
            currentAction: u ? u.currentAction : null,
            charHeight: window._game.player.charHeight,
        };
    });
    console.log('after 4 M presses (should be Girl):', JSON.stringify(state));
    await page.screenshot({ path: path.join(__dirname,'screenshots','char_girl.png') });

    // Also try pressing T (dance) to confirm Samba alias works
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' })));
    await new Promise(r => setTimeout(r, 500));
    const danceState = await page.evaluate(() => {
        const u = window._game.character.userData.glb;
        return { currentAction: u && u.currentAction, oneShot: u && u.oneShot };
    });
    console.log('after T (dance):', JSON.stringify(danceState));
    await page.screenshot({ path: path.join(__dirname,'screenshots','char_girl_dance.png') });

    await browser.close();
    console.log('Saved char_girl.png and char_girl_dance.png');
})().catch(e => { console.error(e); process.exit(1); });
