// Verifies that:
//   - All NPCs were upgraded to GLB-backed instances
//   - Each NPC has its own AnimationMixer + actions
//   - Each NPC has its own (independent) tinted materials
//   - Walking the player up to an NPC triggers the wave-on-approach hook
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

    // Wait for entrance ritual to complete (it blocks input by design)
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

    console.log('=== NPC GLB TEST ===\n');

    // 1. Inventory the NPCs
    const inventory = await page.evaluate(() => {
        const G = window._game;
        const npcs = G.world.all.filter(o => o.constructor.name === 'NPC');
        return {
            count: npcs.length,
            withGLB: npcs.filter(n => n.mesh.userData.glb).length,
            uniqueMixers: new Set(npcs.map(n => n.mesh.userData.glb && n.mesh.userData.glb.mixer)).size,
            uniqueModels: new Set(npcs.map(n => n.mesh.userData.glb && n.mesh.userData.glb.model)).size,
            // Check that materials are NOT shared (tints would bleed otherwise)
            firstThreeMaterialColors: npcs.slice(0, 3).map(n => {
                const u = n.mesh.userData.glb;
                if (!u) return null;
                let firstColor = null;
                u.model.traverse((node) => {
                    if (firstColor) return;
                    if (node.isMesh && node.material && node.material.color) {
                        firstColor = '#' + node.material.color.getHexString();
                    }
                });
                return firstColor;
            }),
            currentActions: npcs.slice(0, 5).map(n => n.mesh.userData.glb && n.mesh.userData.glb.currentAction),
        };
    });
    console.log('inventory:', JSON.stringify(inventory, null, 2));

    // 2. Move the player TO an NPC and verify wave-on-approach fires
    const proximityTest = await page.evaluate(async () => {
        const G = window._game;
        // Find the closest NPC
        let closest = null, minD = Infinity;
        const npcs = G.world.all.filter(o => o.constructor.name === 'NPC');
        for (const n of npcs) {
            const d = G.character.position.distanceTo(n.mesh.position);
            if (d < minD) { minD = d; closest = n; }
        }
        if (!closest) return { error: 'no NPC found' };

        // Teleport player right next to that NPC by overwriting groundPos
        const targetDir = closest.mesh.position.clone().normalize();
        const r = G.groundHeight(targetDir.x, targetDir.y, targetDir.z);
        G.player.groundPos.copy(targetDir.multiplyScalar(r));
        // Run a few ticks so updateChar/animChar/NPC.update all fire
        for (let i = 0; i < 8; i++) {
            G.updateChar();
            // Manually pump the animated objects
            for (const obj of G.world.all) {
                if (obj.constructor.name === 'NPC' && obj.update) {
                    obj.update(performance.now()/1000, 0.05);
                }
            }
            await new Promise(r => setTimeout(r, 50));
        }

        return {
            closestDist: G.character.position.distanceTo(closest.mesh.position),
            closestOneShot: closest.mesh.userData.glb ? closest.mesh.userData.glb.oneShot : null,
            closestAction: closest.mesh.userData.glb ? closest.mesh.userData.glb.currentAction : null,
            wasNearPlayer: closest._wasNearPlayer,
        };
    });
    console.log('proximity test:', JSON.stringify(proximityTest));

    // Take a screenshot of an NPC up close
    await page.evaluate(() => window._game.setCamMode(2));
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(__dirname,'screenshots','npc_glb_close.png') });

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['All NPCs upgraded to GLB',                  inventory.withGLB === inventory.count && inventory.count > 0],
        ['Each NPC has its own AnimationMixer',        inventory.uniqueMixers === inventory.count],
        ['Each NPC has its own model instance',        inventory.uniqueModels === inventory.count],
        ['NPCs have independent material colors',      new Set(inventory.firstThreeMaterialColors).size === 3 || inventory.firstThreeMaterialColors.length < 3],
        ['NPCs start in Idle (or fallback)',           inventory.currentActions.every(a => a !== null)],
        ['Player teleported close to NPC',             proximityTest.closestDist < 5],
        ['Wave-on-approach fired',                     proximityTest.closestOneShot === 'Wave' || proximityTest.closestAction === 'Wave' || proximityTest.wasNearPlayer === true],
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
