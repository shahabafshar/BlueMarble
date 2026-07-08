// Visual capture: cycle through all 9 MC_CHARACTERS and screenshot each.
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
    await new Promise(r => setTimeout(r, 8000));

    // Wait for ritual
    let waited = 0;
    while (waited < 25000) {
        const done = await page.evaluate(() => window._game.player.ritualStartTime > 0 && !window._game.player.ritualActive);
        if (done) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }

    // Switch to close-up cam (mode 2) to actually see the character
    await page.evaluate(() => window._game.setCamMode(2));
    await new Promise(r => setTimeout(r, 300));

    const names = ['Robot','Robo Tot','Human','Tall One','Fox','Flamingo','Parrot','Stork','Horse'];
    for (let i = 0; i < names.length; i++) {
        const fname = String(i).padStart(2,'0') + '_' + names[i].replace(/\s+/g,'_');
        await page.screenshot({ path: path.join(__dirname,'screenshots','char_' + fname + '.png') });
        console.log('captured', fname);
        // Cycle to next via M
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
        // Settle for the model swap (first cycle through is async on first parse)
        await new Promise(r => setTimeout(r, 1500));
    }

    await browser.close();
    console.log('Saved 9 character screenshots');
})().catch(e => { console.error(e); process.exit(1); });
