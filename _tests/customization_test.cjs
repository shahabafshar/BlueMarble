// Verifies the M / C customization split:
//   - M cycles characters (4 entries: Robot, Robo Tot, Human, Tall One)
//   - C cycles color tints (6 entries) — independent of character
//   - Both persist as separate localStorage keys
//   - Player.charHeight tracks the active character's scale variant
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

    // Wait for entrance ritual to complete
    let ritualWait = 0;
    while (ritualWait < 25000) {
        const state = await page.evaluate(() => {
            const G = window._game;
            return G && G.player ? { active: G.player.ritualActive, started: G.player.ritualStartTime > 0 } : null;
        });
        if (state && state.started && !state.active) break;
        await new Promise(r => setTimeout(r, 200));
        ritualWait += 200;
    }

    console.log('=== MC CUSTOMIZATION TEST (M=character, C=color) ===\n');

    async function readLook() {
        return page.evaluate(() => {
            const u = window._game.character.userData.glb;
            if (!u || !u.model) return null;
            let firstColor = null;
            u.model.traverse((node) => {
                if (firstColor) return;
                if (node.isMesh && node.material && node.material.color) {
                    firstColor = '#' + node.material.color.getHexString();
                }
            });
            return {
                color: firstColor,
                animCount: Object.keys(u.actions).length,
                charHeight: window._game.player.charHeight,
                charIdx: localStorage.getItem('mcCharIdx'),
                tintIdx: localStorage.getItem('mcTintIdx'),
            };
        });
    }
    async function press(code) {
        await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
        // Poll for the swap to actually take effect (model parses async on
        // first load). Read the expected charIdx and wait until the loaded
        // model's anim count matches what that idx should have.
        const expectIdx = await page.evaluate(() => parseInt(localStorage.getItem('mcCharIdx') || '0', 10));
        const expectAnims = expectIdx === 0 || expectIdx === 1 ? 14 : 1;
        let waited = 0;
        while (waited < 8000) {
            const got = await page.evaluate(() => Object.keys(window._game.character.userData.glb.actions).length);
            if (got === expectAnims) break;
            await new Promise(r => setTimeout(r, 200));
            waited += 200;
        }
        // Final settle for the tint application
        await new Promise(r => setTimeout(r, 200));
    }

    const initial = await readLook();
    console.log('initial:', JSON.stringify(initial));

    // ---- C cycle: should change color but NOT animCount/charHeight
    console.log('\n-- C cycle (color only) --');
    const colorTrace = [{ phase: 'init', ...initial }];
    for (let i = 0; i < 6; i++) {
        await press('KeyC');
        const r = await readLook();
        colorTrace.push({ phase: 'C#' + (i+1), ...r });
        console.log('C#' + (i+1) + ':', JSON.stringify(r));
    }

    // ---- M cycle: should change animCount or charHeight (different character)
    // The MC_CHARACTERS list has 6 humanoid entries; cycle 6 times to wrap.
    console.log('\n-- M cycle (character only) --');
    const charTrace = [];
    for (let i = 0; i < 6; i++) {
        await press('KeyM');
        const r = await readLook();
        charTrace.push({ phase: 'M#' + (i+1), ...r });
        console.log('M#' + (i+1) + ':', JSON.stringify(r));
    }

    console.log('\n=== ASSERTIONS ===');
    const colorSet = new Set(colorTrace.slice(1).map(r => r.color));
    const heightSet = new Set(charTrace.map(r => r.charHeight));
    const animSet = new Set(charTrace.map(r => r.animCount));

    const checks = [
        ['Initial state readable',                  initial.color !== null],
        ['C cycles colors (6 distinct)',            colorSet.size === 6],
        ['C does NOT change animCount',             new Set(colorTrace.map(r => r.animCount)).size === 1],
        ['C does NOT change charHeight',            new Set(colorTrace.map(r => r.charHeight)).size === 1],
        ['C wraps back to initial after 6 presses', colorTrace[6].color === colorTrace[0].color],
        ['M cycles at least 5 distinct humanoids',   new Set(charTrace.map(r => r.charHeight + '|' + r.animCount)).size >= 5],
        ['M wraps after full cycle (6 presses)',     charTrace[5].charHeight === initial.charHeight && charTrace[5].animCount === initial.animCount],
        ['M visits Robot+Human animation counts',    animSet.has(14) && animSet.has(1)],
        ['M produces 4+ distinct heights',           heightSet.size >= 4],
        ['mcCharIdx persisted in localStorage',     charTrace[3].charIdx !== null],
        ['mcTintIdx persisted in localStorage',     colorTrace[6].tintIdx !== null],
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
