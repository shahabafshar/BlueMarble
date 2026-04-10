// Quick visual check of the help button + hint collapse animation.
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
    await new Promise(r => setTimeout(r, 7000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','help_btn_open.png') });
    // Click help to collapse
    await page.evaluate(() => document.getElementById('help-btn').click());
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(__dirname,'screenshots','help_btn_collapsed.png') });
    // Click again to expand
    await page.evaluate(() => document.getElementById('help-btn').click());
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(__dirname,'screenshots','help_btn_reopened.png') });
    await browser.close();
    console.log('Saved 3 screenshots to _tests/screenshots/');
})().catch(e => { console.error(e); process.exit(1); });
