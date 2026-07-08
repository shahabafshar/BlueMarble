// Check what colors Tree1.glb has natively
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage();
    const previewPath = 'file:///' + path.resolve(path.join(__dirname,'..','characters','preview.html')).replace(/\\/g,'/');
    await page.goto(previewPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));

    for (const file of ['Tree1.glb', 'Tree2.glb', 'Tree4.glb', 'Bush1.glb', 'Rock1.glb']) {
        const buf = fs.readFileSync(path.resolve(path.join(__dirname,'..','characters','nature', file)));
        const b64 = buf.toString('base64');
        const result = await page.evaluate(async (b64, label) => {
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            return new Promise(resolve => {
                window.loadFromArrayBuffer(bytes.buffer, label);
                setTimeout(() => {
                    const m = window.currentModel;
                    if (!m) { resolve({ error: 'no model' }); return; }
                    const out = { meshes: [] };
                    m.traverse(n => {
                        if (n.isMesh && n.material) {
                            const mat = Array.isArray(n.material) ? n.material[0] : n.material;
                            const colorAttr = n.geometry && n.geometry.getAttribute('color');
                            let vcRange = null;
                            if (colorAttr) {
                                let rmin=1, rmax=0, gmin=1, gmax=0, bmin=1, bmax=0;
                                for (let i = 0; i < Math.min(colorAttr.count, 50); i++) {
                                    const r = colorAttr.getX(i), g = colorAttr.getY(i), b = colorAttr.getZ(i);
                                    if (r<rmin)rmin=r; if (r>rmax)rmax=r;
                                    if (g<gmin)gmin=g; if (g>gmax)gmax=g;
                                    if (b<bmin)bmin=b; if (b>bmax)bmax=b;
                                }
                                vcRange = [
                                    'r:'+rmin.toFixed(2)+'-'+rmax.toFixed(2),
                                    'g:'+gmin.toFixed(2)+'-'+gmax.toFixed(2),
                                    'b:'+bmin.toFixed(2)+'-'+bmax.toFixed(2),
                                ].join(' ');
                            }
                            out.meshes.push({
                                name: n.name || '?',
                                materialColor: '#' + mat.color.getHexString(),
                                hasVertexColors: !!colorAttr,
                                materialVertexColorsFlag: mat.vertexColors,
                                vertexColorRange: vcRange,
                            });
                        }
                    });
                    resolve(out);
                }, 1000);
            });
        }, b64, file);
        console.log(file + ':');
        console.log(JSON.stringify(result, null, 2));
        console.log('');
    }

    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
