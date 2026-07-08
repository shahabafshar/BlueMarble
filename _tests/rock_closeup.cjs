// Move player right next to a specific rock and screenshot it close up
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    // Pick a rock that has a nice color (not desert beige) — find one in
    // the grasslands or forest
    const rockPos = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        // Pick rock #5 just to get variety
        const r = rocks[5];
        return { lat: r.lat, lon: r.lon, scale: r.scale };
    });
    console.log('targeting rock at', JSON.stringify(rockPos));

    // Move player right next to it
    await page.evaluate((rockPos) => {
        const G = window._game;
        const phi = (90 - rockPos.lat) * Math.PI / 180;
        const theta = (rockPos.lon + 180) * Math.PI / 180;
        const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        // Slight offset so player isn't inside the rock
        const off = new THREE.Vector3(0.02, 0, 0.02).add(dir).normalize();
        const r = G.groundHeight(off.x, off.y, off.z);
        G.player.groundPos.copy(off.multiplyScalar(r));
        G.setCamMode(2);  // close-up
        G.updateChar();
    }, rockPos);
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname,'screenshots','rock_closeup.png') });
    console.log('Saved rock_closeup.png');
    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
