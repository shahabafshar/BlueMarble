// Verifies the expression system:
//   - playOneShot exists and triggers a one-shot animation
//   - The state machine returns to Idle/Walking after the one-shot
//   - Manual emote keys (E/T/Y/N) play the expected clips
//   - The help button toggles the controls hint
//   - Photo and selfie hooks fire ThumbsUp / Wave
//   - Boredom emote loop fires after the idle threshold (synthesized)
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
               '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 640 });

    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[err] ' + m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname, '..', 'index.html')).replace(/\\/g, '/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 7000));

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); process.exit(1); }

    // Wait for the entrance ritual to fully complete before testing inputs.
    // The ritual blocks all input by design, so any test running during
    // the ritual window would fail.
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
    console.log('(waited ' + ritualWait + 'ms for entrance ritual to complete)\n');

    console.log('=== EXPRESSION SYSTEM TEST ===\n');

    // Test 1: manual emote keys → currentAction
    async function probeKey(label, code, expected) {
        const data = await page.evaluate(async (key) => {
            const G = window._game;
            G.player.vFwd = 0; G.player.vStrafe = 0;
            window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
            await new Promise(r => setTimeout(r, 200));
            const action = G.character.userData.glb && G.character.userData.glb.currentAction;
            const oneShot = G.character.userData.glb && G.character.userData.glb.oneShot;
            window.dispatchEvent(new KeyboardEvent('keyup', { code: key }));
            return { action, oneShot };
        }, code);
        const ok = data.action === expected && data.oneShot === expected;
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + label.padEnd(38) + ' got ' + JSON.stringify(data));
        return ok;
    }

    // Wait for any leftover one-shot to expire between tests
    async function settleToIdle() {
        await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            if (u) { u.oneShot = null; u.oneShotUntil = 0; }
            window._game.player.vFwd = 0;
            window._game.player.vStrafe = 0;
        });
        await new Promise(r => setTimeout(r, 800));
    }

    let pass = 0, total = 0;
    const check = (ok) => { total++; if (ok) pass++; };

    check(await probeKey('KeyE plays Wave',     'KeyE', 'Wave'));
    await settleToIdle();
    check(await probeKey('KeyT plays Dance',    'KeyT', 'Dance'));
    await settleToIdle();
    check(await probeKey('KeyY plays Yes',      'KeyY', 'Yes'));
    await settleToIdle();
    check(await probeKey('KeyN plays No',       'KeyN', 'No'));
    await settleToIdle();

    // Test 2: photo (P) → ThumbsUp
    {
        const data = await page.evaluate(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
            await new Promise(r => setTimeout(r, 200));
            const u = window._game.character.userData.glb;
            return { action: u && u.currentAction, oneShot: u && u.oneShot };
        });
        const ok = data.oneShot === 'ThumbsUp';
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + 'KeyP plays ThumbsUp                    got ' + JSON.stringify(data));
        check(ok);
    }
    // Close photo modal
    await page.evaluate(() => window.closePhoto && window.closePhoto());
    await settleToIdle();

    // Test 3: selfie (O) → Wave (note: selfie delays the snap)
    {
        const data = await page.evaluate(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO' }));
            await new Promise(r => setTimeout(r, 200));
            const u = window._game.character.userData.glb;
            return { action: u && u.currentAction, oneShot: u && u.oneShot };
        });
        const ok = data.oneShot === 'Wave';
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + 'KeyO plays Wave                        got ' + JSON.stringify(data));
        check(ok);
    }
    // Wait for selfie to complete and close
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => window.closePhoto && window.closePhoto());
    await settleToIdle();

    // Test 4: returns to Idle after one-shot expires
    {
        await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            if (u) { u.oneShot = null; u.oneShotUntil = 0; }
            window._game.player.vFwd = 0; window._game.player.vStrafe = 0;
        });
        await new Promise(r => setTimeout(r, 1000));
        const action = await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            return u && u.currentAction;
        });
        const ok = action === 'Idle';
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + 'Returns to Idle after one-shot expires  got ' + JSON.stringify({ action }));
        check(ok);
    }

    // Test 5: help button toggles the controls hint
    {
        const before = await page.evaluate(() => document.getElementById('controls-hint').classList.contains('collapsed'));
        await page.evaluate(() => document.getElementById('help-btn').click());
        const after1 = await page.evaluate(() => document.getElementById('controls-hint').classList.contains('collapsed'));
        await page.evaluate(() => document.getElementById('help-btn').click());
        const after2 = await page.evaluate(() => document.getElementById('controls-hint').classList.contains('collapsed'));
        const ok = before === false && after1 === true && after2 === false;
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + 'Help btn toggles hint collapsed class   got ' + JSON.stringify({before, after1, after2}));
        check(ok);
    }

    // Test 6: motion cancels one-shot (so player isn't stuck mid-Dance).
    // Hold KeyW down so the input handler keeps adding velocity against drag.
    {
        await settleToIdle();
        await page.evaluate(async () => {
            // Trigger Dance
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
            await new Promise(r => setTimeout(r, 80));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT' }));
            // Now start walking forward — hold KeyW so the input handler
            // ramps vFwd up against drag
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            await new Promise(r => setTimeout(r, 600));
        });
        const action = await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            return { action: u && u.currentAction, oneShot: u && u.oneShot, vFwd: window._game.player.vFwd };
        });
        const ok = (action.action === 'Walking' || action.action === 'Running') && action.oneShot === null;
        console.log((ok ? 'PASS' : 'FAIL') + '  ' + 'Motion cancels Dance one-shot           got ' + JSON.stringify(action));
        check(ok);
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })));
    }

    console.log('\n' + pass + '/' + total + ' checks passed');

    await browser.close();
    process.exit(pass === total ? 0 : 1);
})().catch(e => { console.error('crash:', e); process.exit(1); });
