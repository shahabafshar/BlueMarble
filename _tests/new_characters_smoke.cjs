// Smoke-test the 3 newly-added characters:
//   - Cycle M to reach Soldier, Villager, Goblin
//   - Verify each loads cleanly with its expected animation count
//   - Verify Soldier's bbox looks sane (not Mixamo-shrink-giant)
//   - Cycle taunts on Soldier and verify we get a rich set of emote clips
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
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
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

    console.log('=== NEW CHARACTERS SMOKE TEST ===\n');

    // Expected animation counts per character index (from MC_CHARACTERS)
    // 0=Robot(14), 1=RoboTot(14), 2=Human(1), 3=TallOne(1),
    // 4=Girl(4), 5=GirlMini(4), 6=Soldier(32), 7=Villager(4), 8=Goblin(2)
    const EXPECTED_ANIMS = [14, 14, 1, 1, 4, 4, 32, 4, 2];

    async function cycleToIdx(targetIdx) {
        const total = 9;
        // Read start state
        let current = await page.evaluate(() => parseInt(localStorage.getItem('mcCharIdx') || '0', 10));
        let currentAnims = await page.evaluate(() => Object.keys(window._game.character.userData.glb.actions).length);

        while (current !== targetIdx) {
            const nextIdx = (current + 1) % total;
            const expectAnims = EXPECTED_ANIMS[nextIdx];
            await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));

            // Wait for BOTH the charIdx AND the actual anim count to match.
            // Async parse can take a while for first-time loads.
            let w = 0;
            while (w < 15000) {
                const s = await page.evaluate(() => ({
                    idx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
                    anims: Object.keys(window._game.character.userData.glb.actions).length,
                }));
                if (s.idx === nextIdx && s.anims === expectAnims) break;
                await new Promise(r => setTimeout(r, 200));
                w += 200;
            }
            // Belt and braces
            await new Promise(r => setTimeout(r, 400));
            current = nextIdx;
        }
    }

    async function readState() {
        return page.evaluate(() => {
            const u = window._game.character.userData.glb;
            if (!u) return null;
            // Compute world bbox
            window._game.character.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(window._game.character);
            const size = new THREE.Vector3();
            box.getSize(size);
            return {
                charIdx: parseInt(localStorage.getItem('mcCharIdx') || '0', 10),
                animCount: Object.keys(u.actions).length,
                animNames: Object.keys(u.actions).slice(0, 5),
                bboxY: size.y.toFixed(2),
                bboxX: size.x.toFixed(2),
                bboxZ: size.z.toFixed(2),
                charHeight: window._game.player.charHeight.toFixed(2),
            };
        });
    }

    // Soldier at idx 6
    await cycleToIdx(6);
    const soldier = await readState();
    console.log('Soldier:', JSON.stringify(soldier));

    // Cycle taunts on Soldier (B key)
    const soldierTaunts = [];
    for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })));
        await new Promise(r => setTimeout(r, 150));
        const cur = await page.evaluate(() => {
            const u = window._game.character.userData.glb;
            return u.oneShot;
        });
        if (cur) soldierTaunts.push(cur);
    }
    const uniqueSoldierTaunts = new Set(soldierTaunts.filter(x => x));
    console.log('Soldier taunts (' + uniqueSoldierTaunts.size + ' unique):', Array.from(uniqueSoldierTaunts).slice(0, 8), '...');

    // Villager at idx 7
    await cycleToIdx(7);
    const villager = await readState();
    console.log('Villager:', JSON.stringify(villager));

    // Goblin at idx 8 (Draco!)
    await cycleToIdx(8);
    const goblin = await readState();
    console.log('Goblin:', JSON.stringify(goblin));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['No load errors',                                errs.length === 0],
        ['Soldier loaded',                                soldier && soldier.charIdx === 6],
        ['Soldier has 32 animations',                     soldier && soldier.animCount === 32],
        ['Soldier bbox Y is reasonable (0.5-5m)',         soldier && parseFloat(soldier.bboxY) >= 0.5 && parseFloat(soldier.bboxY) <= 5.0],
        // Soldier has 32 clips total: 24 are movement/state/holding/wheelchair
        // (filtered by _MOVEMENT_CLIPS), leaving 9 real taunts (sit, emote-yes,
        // emote-no, 4 attack-*, 2 interact-*). So ≥9 is the correct ceiling.
        ['Soldier taunt cycle finds ≥9 unique clips',     uniqueSoldierTaunts.size >= 9],
        ['Soldier taunts include emote-yes',              uniqueSoldierTaunts.has('emote-yes')],
        ['Soldier taunts include attack-melee-right',     uniqueSoldierTaunts.has('attack-melee-right')],
        ['Villager loaded',                               villager && villager.charIdx === 7],
        ['Villager has 4 animations',                     villager && villager.animCount === 4],
        ['Goblin has 2 animations',                       goblin && goblin.animCount === 2],
        ['Villager bbox reasonable',                      villager && parseFloat(villager.bboxY) >= 0.5 && parseFloat(villager.bboxY) <= 5.0],
        ['Goblin loaded (Draco decompressed)',            goblin && goblin.charIdx === 8],
        ['Goblin has ≥1 animation',                       goblin && goblin.animCount >= 1],
        ['Goblin bbox reasonable',                        goblin && parseFloat(goblin.bboxY) >= 0.5 && parseFloat(goblin.bboxY) <= 5.0],
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
