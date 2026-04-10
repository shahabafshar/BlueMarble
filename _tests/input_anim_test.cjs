// Verifies the new input bindings:
//   ArrowLeft/Right turn (don't strafe), KeyA/D strafe.
// And that the GLB animation switches to Walking when strafing OR turning.
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

    if (errs.length) { console.log('LOAD ERRORS:'); errs.forEach(e => console.log(e)); await browser.close(); return; }

    // Wait for the entrance ritual to complete (it blocks input by design).
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
    console.log('(waited ' + ritualWait + 'ms for entrance ritual)\n');

    // Helper: hold a key for ms, capture the active action WHILE held
    // (so we measure the steady-state behavior, not the post-release decay),
    // then release and let things settle. Returns heading delta + posMoved
    // so we can confirm strafe-vs-turn semantics.
    async function probe(label, keyCode, holdMs) {
        const data = await page.evaluate(async (key, ms) => {
            const G = window._game;
            // Reset velocities so previous test doesn't bleed
            G.player.vFwd = 0; G.player.vStrafe = 0;
            const startHeading = G.player.heading;
            const startPos = G.player.groundPos.clone();
            window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
            // Hold most of the duration to let animations stabilize
            await new Promise(r => setTimeout(r, Math.max(ms - 100, 50)));
            // Capture WHILE the key is still held
            const action = G.character.userData.glb ? G.character.userData.glb.currentAction : null;
            const headingDelta = G.player.heading - startHeading;
            const posMoved = G.player.groundPos.distanceTo(startPos);
            window.dispatchEvent(new KeyboardEvent('keyup', { code: key }));
            // Settle a bit so the next probe starts clean
            await new Promise(r => setTimeout(r, 100));
            return { action, headingDelta, posMoved };
        }, keyCode, holdMs);
        console.log(label.padEnd(28), JSON.stringify({
            action: data.action,
            headingDeltaDeg: (data.headingDelta * 180 / Math.PI).toFixed(2),
            posMoved: data.posMoved.toFixed(3),
        }));
        return data;
    }

    console.log('=== INPUT BINDING + ANIMATION TEST ===\n');

    const left  = await probe('ArrowLeft (should turn)',  'ArrowLeft',  600);
    const right = await probe('ArrowRight (should turn)', 'ArrowRight', 600);
    const a     = await probe('KeyA (should strafe)',     'KeyA',       600);
    const d     = await probe('KeyD (should strafe)',     'KeyD',       600);
    const w     = await probe('KeyW (forward)',           'KeyW',       600);

    // Idle baseline — give it a long time at the slow swiftshader framerate
    // so vFwd has fully decayed below the 0.01 threshold.
    await page.evaluate(() => {
        const G = window._game;
        G.player.vFwd = 0; G.player.vStrafe = 0;
    });
    await new Promise(r => setTimeout(r, 2000));
    const idle = await page.evaluate(() => {
        const G = window._game;
        return G.character.userData.glb ? G.character.userData.glb.currentAction : null;
    });
    console.log('Idle baseline           ', JSON.stringify({ action: idle }));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['ArrowLeft turns (heading delta > 5°)',          Math.abs(left.headingDelta * 180 / Math.PI)  > 5],
        ['ArrowLeft does not strafe (posMoved < 0.1)',    left.posMoved  < 0.1],
        ['ArrowLeft plays Walking',                       left.action === 'Walking'],
        ['ArrowRight turns (negative heading delta)',     right.headingDelta * 180 / Math.PI < -5],
        ['ArrowRight does not strafe',                    right.posMoved < 0.1],
        ['ArrowRight plays Walking',                      right.action === 'Walking'],
        ['KeyA strafes (posMoved > 0.05)',                a.posMoved > 0.05],
        ['KeyA does not turn (heading delta ≈ 0)',        Math.abs(a.headingDelta) < 0.01],
        ['KeyA plays Walking',                            a.action === 'Walking'],
        ['KeyD strafes',                                  d.posMoved > 0.05],
        ['KeyD does not turn',                            Math.abs(d.headingDelta) < 0.01],
        ['KeyD plays Walking',                            d.action === 'Walking'],
        ['KeyW moves forward',                            w.posMoved > 0.05],
        ['KeyW plays Walking or Running',                 w.action === 'Walking' || w.action === 'Running'],
        ['Idle after release',                            idle === 'Idle'],
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
