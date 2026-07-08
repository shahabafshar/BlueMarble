// Visual capture of an NPC after the wander/grounding/sink fixes.
// Teleports the player near the closest NPC and screenshots it from
// camera mode 2 (close-up follow cam).
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
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

    // Walk player to within view of an NPC and orbit camera around them
    await page.evaluate(async () => {
        const G = window._game;
        // Pick an NPC, sit ~5 units behind it relative to planet "up"
        const npcs = G.world.all.filter(o => o.constructor.name === 'NPC');
        if (!npcs.length) return;
        const target = npcs[0];
        // Project player position onto a position 4 units back-along the
        // surface from the NPC. We'll just place player at NPC position
        // and orbit cam will frame both
        const dir = target.mesh.position.clone().normalize();
        const r = G.groundHeight(dir.x, dir.y, dir.z);
        // Slight offset so player isn't inside the NPC
        const off = new THREE.Vector3(0.02, 0, 0.02).add(dir).normalize();
        const offR = G.groundHeight(off.x, off.y, off.z);
        G.player.groundPos.copy(off.multiplyScalar(offR));
        G.setCamMode(3);
        G.updateChar();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(__dirname,'screenshots','npc_after_fix.png') });
    await browser.close();
    console.log('Saved npc_after_fix.png');
})().catch(e => { console.error(e); process.exit(1); });
