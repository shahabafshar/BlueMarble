// Direct measurement: build a procedural rock fresh, measure it, see what's happening
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    // Build a fresh procedural rock at s=0.4 and measure it
    const data = await page.evaluate(() => {
        // Procedural lpRock(s) is in module scope but we can recreate inline
        function makeRock(s) {
            const g = new THREE.Group();
            const geo = new THREE.DodecahedronGeometry(s, 0);
            const main = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
            g.add(main);
            return g;
        }
        const r = makeRock(0.4);
        r.scale.set(1, 1, 1);
        r.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(r);
        const sz = new THREE.Vector3();
        box.getSize(sz);
        return { localSize_s04: { x: sz.x.toFixed(3), y: sz.y.toFixed(3), z: sz.z.toFixed(3) } };
    });
    console.log(JSON.stringify(data, null, 2));

    // Now compare to what an actual upgraded rock has as its child clone
    const upgraded = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        if (!rocks.length) return null;
        const o = rocks[0];
        // Walk children. After upgrade, obj.mesh has 1 child = the replacement Group
        // The replacement Group contains the cloned model
        const child = o.mesh.children[0];
        if (!child) return { error: 'no child' };
        // Measure JUST the child, not o.mesh, to skip parent scale
        child.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(child);
        const sz = new THREE.Vector3();
        box.getSize(sz);
        // Also report the inner model's local scale
        const innerModel = child.children[0];
        const innerScale = innerModel ? innerModel.scale.x : null;
        return {
            childLocalSize: { x: sz.x.toFixed(3), y: sz.y.toFixed(3), z: sz.z.toFixed(3) },
            innerModelScale: innerScale ? innerScale.toFixed(4) : null,
            parentScale: o.scale.toFixed(3),
        };
    });
    console.log('upgraded child:', JSON.stringify(upgraded, null, 2));

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
