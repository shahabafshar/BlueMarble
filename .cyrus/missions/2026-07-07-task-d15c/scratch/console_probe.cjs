// Scratch probe: open index.html over file:// and assert no console errors.
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const errors = [];
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
               '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    const file = 'file://' + path.join(__dirname, '..', '..', '..', '..', 'index.html').replace(/\\/g, '/');
    console.log('Opening ' + file);
    await page.goto(file, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 6000));

    const state = await page.evaluate(() => {
        return { hasGame: !!window._game, glb: !!(window._game && window._game.character && window._game.character.userData.glb) };
    });
    console.log('window._game present:', state.hasGame, '| GLB loaded:', state.glb);

    await browser.close();
    if (errors.length) { console.log('CONSOLE ERRORS FOUND:'); errors.forEach(e => console.log('  ' + e)); process.exit(1); }
    console.log('NO CONSOLE ERRORS');
})();
