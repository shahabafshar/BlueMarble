// Verifies the entrance ritual:
//   - It triggers on game load (after the loading-screen fade)
//   - During the ritual: pivot rotates toward camera, Wave plays,
//     keyboard input is blocked
//   - After the ritual: pivot is back to 0, ritualActive=false,
//     keyboard input works again
// Also takes screenshots of each phase for visual confirmation.
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
    const t0 = Date.now();
    const tlog = (s) => console.log('t=' + (Date.now() - t0) + 'ms ' + s);
    page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
    page.on('console', m => {
        if (m.type() === 'error') errs.push('[err] ' + m.text());
        if (m.text().includes('[ritual]')) tlog('PAGE> ' + m.text());
    });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });

    // Wait for the page to be ready enough that startEntranceRitual fires.
    // In swiftshader headless this can take much longer than in a real browser
    // because shader compile + scene setup blocks the event loop.
    console.log('=== ENTRANCE RITUAL TEST ===\n');

    // Poll for the ritual to become active. Wait up to 20s (real browser ~2s).
    let waited = 0;
    while (waited < 20000) {
        const active = await page.evaluate(() => window._game && window._game.player && window._game.player.ritualActive);
        if (active) break;
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    tlog('ritual became active after ' + waited + 'ms of polling');

    // Now we're at ~phase 1 of the ritual. Wait until we're definitely
    // mid-Wave (ritual elapsed ~1s). We'll measure phases relative to
    // ritualStartTime so we don't depend on wall-clock timing.
    await page.evaluate(() => new Promise(r => {
        const tStart = window._game.player.ritualStartTime;
        const tick = () => {
            if (performance.now() - tStart > 1000) r();
            else requestAnimationFrame(tick);
        };
        tick();
    }));

    const phase1 = await page.evaluate(() => ({
        ritualActive: window._game.player.ritualActive,
        ritualElapsed: performance.now() - window._game.player.ritualStartTime,
        pivotRotY: window._game.character.userData.glb.pivot.rotation.y,
        currentAction: window._game.character.userData.glb.currentAction,
        oneShot: window._game.character.userData.glb.oneShot,
    }));
    tlog('phase1 (mid-ritual): ' + JSON.stringify(phase1));
    await page.screenshot({ path: path.join(__dirname,'screenshots','ritual_mid.png') });

    // 2 & 3. Block tests run on a re-triggered ritual so both have a
    // guaranteed fresh window — the natural ritual is short (~2.6s) and
    // a slow swiftshader frame can otherwise let it expire mid-test.
    await page.evaluate(() => window._game.startEntranceRitual && window._game.startEntranceRitual());
    await new Promise(r => setTimeout(r, 150));

    // W block test — read state SYNCHRONOUSLY inside the evaluate, no
    // long waits, so the ritual can't end mid-test.
    const blockTest = await page.evaluate(() => {
        const G = window._game;
        const startPos = G.player.groundPos.clone();
        const ritualBefore = G.player.ritualActive;
        // Hold KeyW for ~5 frames worth (the keydown listener sets keys.KeyW)
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        // Drive a few animate-like ticks ourselves (synchronous, deterministic)
        for (let i = 0; i < 5; i++) {
            G.moveOnSurface(G.player.vFwd || 0, G.player.vStrafe || 0, 0);
            G.updateChar();
        }
        const ritualAfter = G.player.ritualActive;
        const result = {
            ritualBefore, ritualAfter,
            vFwd: G.player.vFwd,
            posMoved: G.player.groundPos.distanceTo(startPos),
        };
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return result;
    });
    console.log('W during ritual:', JSON.stringify(blockTest));

    // KeyT (Dance) block test — same fresh window
    const emoteBlock = await page.evaluate(() => {
        const G = window._game;
        const ritualActive = G.player.ritualActive;
        const beforeAction = G.character.userData.glb.currentAction;
        const beforeOneShot = G.character.userData.glb.oneShot;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
        const afterAction = G.character.userData.glb.currentAction;
        const afterOneShot = G.character.userData.glb.oneShot;
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT' }));
        return { beforeAction, beforeOneShot, afterAction, afterOneShot, ritualActive };
    });
    console.log('KeyT during ritual:', JSON.stringify(emoteBlock));

    // 4. Wait for ritual to fully complete (poll until ritualActive=false)
    let endWait = 0;
    while (endWait < 10000) {
        const active = await page.evaluate(() => window._game.player.ritualActive);
        if (!active) break;
        await new Promise(r => setTimeout(r, 200));
        endWait += 200;
    }
    tlog('ritual ended after ' + endWait + 'ms more polling');

    const phase2 = await page.evaluate(() => ({
        ritualActive: window._game.player.ritualActive,
        pivotRotY: window._game.character.userData.glb.pivot.rotation.y,
        currentAction: window._game.character.userData.glb.currentAction,
        oneShot: window._game.character.userData.glb.oneShot,
    }));
    tlog('phase2 (post-ritual): ' + JSON.stringify(phase2));

    // Stand still for a beat AFTER the ritual and verify no spurious Wave
    // fires (the landmark first-visit hook should be suppressed for the
    // landmark the player is standing next to at start).
    await new Promise(r => setTimeout(r, 800));
    const noDupeWave = await page.evaluate(() => {
        const G = window._game;
        return {
            currentAction: G.character.userData.glb.currentAction,
            oneShot: G.character.userData.glb.oneShot,
        };
    });
    tlog('800ms after ritual: ' + JSON.stringify(noDupeWave));
    await page.screenshot({ path: path.join(__dirname,'screenshots','ritual_done.png') });

    // 5. Confirm input works after ritual
    const moveTest = await page.evaluate(async () => {
        const G = window._game;
        const startPos = G.player.groundPos.clone();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        await new Promise(r => setTimeout(r, 500));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return {
            ritualActive: G.player.ritualActive,
            posMoved: G.player.groundPos.distanceTo(startPos),
            vFwd: G.player.vFwd,
        };
    });
    console.log('Holding W post-ritual:', JSON.stringify(moveTest));
    await page.screenshot({ path: path.join(__dirname,'screenshots','ritual_after_move.png') });

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['Ritual active mid-test',                 phase1.ritualActive === true],
        ['Pivot rotated during ritual (≠0)',       Math.abs(phase1.pivotRotY) > 0.1],
        ['Wave action is current during ritual',   phase1.currentAction === 'Wave'],
        ['W input blocked: vFwd stays 0',          blockTest.ritualAfter && blockTest.vFwd === 0],
        ['W input blocked: position unchanged',    blockTest.ritualAfter && blockTest.posMoved < 0.05],
        ['T (Dance) blocked during ritual',        emoteBlock.afterOneShot !== 'Dance' && emoteBlock.afterAction !== 'Dance'],
        ['Ritual ended after wait',                phase2.ritualActive === false],
        ['Pivot returned to 0 after ritual',       Math.abs(phase2.pivotRotY) < 0.01],
        ['No duplicate Wave from landmark hook',   noDupeWave.currentAction === 'Idle' && noDupeWave.oneShot === null],
        ['Post-ritual W moves the player',         moveTest.posMoved > 0.05],
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
