// Deep debug: read ALL materials of one rock and one tree, plus the
// stashed _dominantColor on each
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERR:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });
    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','index.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 12000));

    const data = await page.evaluate(() => {
        const G = window._game;
        const rocks = G.world.all.filter(o => o.type === 'rock' && o.category === 'vegetation');
        const trees = G.world.all.filter(o => o.type === 'tree' && o.category === 'vegetation');

        // Pick one rock + one tree, list ALL materials and their colors
        function inspect(o) {
            const allColors = [];
            const allVertexColors = [];
            o.mesh.traverse(n => {
                if (n.isMesh && n.material) {
                    const mats = Array.isArray(n.material) ? n.material : [n.material];
                    for (const m of mats) {
                        if (m.color) allColors.push('#' + m.color.getHexString());
                        allVertexColors.push(m.vertexColors === true || m.vertexColors === 2);
                    }
                }
            });
            return {
                dominant: o._dominantColor ? '#' + o._dominantColor.getHexString() : null,
                allColors,
                allVertexColors,
                childCount: o.mesh.children.length,
                childRotation: o.mesh.children[0] ? o.mesh.children[0].rotation.y : null,
                childScale: o.mesh.children[0] ? [o.mesh.children[0].scale.x, o.mesh.children[0].scale.y, o.mesh.children[0].scale.z] : null,
            };
        }

        return {
            rock0: inspect(rocks[0]),
            rock1: inspect(rocks[1]),
            tree0: inspect(trees[0]),
            tree1: inspect(trees[1]),
        };
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
