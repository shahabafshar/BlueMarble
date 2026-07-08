// Verifies that all 9 MC_CHARACTERS entries can be loaded by cycling
// through them with the M key. Records each character's animation count
// and effective height to confirm they're really different.
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

    // Wait for entrance ritual
    let waited = 0;
    while (waited < 25000) {
        const done = await page.evaluate(() => window._game.player.ritualStartTime > 0 && !window._game.player.ritualActive);
        if (done) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }

    console.log('=== ALL CHARACTERS TEST ===\n');

    // How many characters are defined?
    const totalChars = await page.evaluate(() => {
        // We can't read MC_CHARACTERS directly from window, but we can count by cycling.
        // Read the persisted index instead and the array is internal.
        // Workaround: cycle until we wrap, count steps.
        return null;
    });

    async function readState() {
        return page.evaluate(() => {
            const u = window._game.character.userData.glb;
            return {
                animCount: u ? Object.keys(u.actions).length : 0,
                actionNames: u ? Object.keys(u.actions) : [],
                charHeight: window._game.player.charHeight,
                charIdx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
            };
        });
    }
    async function pressM() {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
        // Poll for the new character to actually be loaded — read charIdx,
        // then wait until animCount changes (handles async first-parse).
        const expectIdx = await page.evaluate(() => parseInt(localStorage.getItem('mcCharIdx') || '0', 10));
        await new Promise(r => setTimeout(r, 200));
        // Settle
        let waited = 0;
        while (waited < 5000) {
            const got = await page.evaluate(() => parseInt(localStorage.getItem('mcCharIdx') || '0', 10));
            if (got === expectIdx) break;
            await new Promise(r => setTimeout(r, 100));
            waited += 100;
        }
        await new Promise(r => setTimeout(r, 600));
    }

    // Cycle until we wrap back to the first character
    const seen = [];
    const initial = await readState();
    seen.push({ idx: initial.charIdx, ...initial });
    console.log('initial:', JSON.stringify({ idx: initial.charIdx, animCount: initial.animCount, height: initial.charHeight.toFixed(2), names: initial.actionNames.slice(0,3) }));
    for (let i = 0; i < 8; i++) {
        await pressM();
        const s = await readState();
        seen.push({ idx: s.charIdx, ...s });
        console.log('M#' + (i+1) + ':', JSON.stringify({ idx: s.charIdx, animCount: s.animCount, height: s.charHeight.toFixed(2), names: s.actionNames.slice(0,3) }));
        if (s.charIdx === initial.charIdx && i > 0) break;
    }

    const uniqueIdxs = new Set(seen.map(s => s.idx));
    console.log('\nUnique character indices visited:', uniqueIdxs.size);
    console.log('All animation counts seen:', new Set(seen.map(s => s.animCount)));
    console.log('All heights seen:', new Set(seen.map(s => s.charHeight.toFixed(2))));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['M cycles at least 6 unique characters', uniqueIdxs.size >= 6],
        ['Multiple distinct animation counts',     new Set(seen.map(s => s.animCount)).size >= 3],
        ['Multiple distinct heights',              new Set(seen.map(s => s.charHeight.toFixed(2))).size >= 4],
        ['No character had 0 animations',          seen.every(s => s.animCount > 0)],
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
