// Inspect the SOURCE Rock1.glb geometry to understand its native vertex range
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

    const buf = fs.readFileSync(path.resolve(path.join(__dirname,'..','characters','nature','Rock1.glb')));
    const b64 = buf.toString('base64');
    const result = await page.evaluate(async (b64) => {
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return new Promise(resolve => {
            window.loadFromArrayBuffer(bytes.buffer, 'Rock1.glb');
            setTimeout(() => {
                const m = window.currentModel;
                if (!m) { resolve({ error: 'no model' }); return; }
                // Walk the model and report each transform + first mesh's vertex range
                const out = [];
                m.traverse(n => {
                    const entry = {
                        name: n.name || '(unnamed)',
                        type: n.type,
                        scale: [n.scale.x.toFixed(3), n.scale.y.toFixed(3), n.scale.z.toFixed(3)],
                        position: [n.position.x.toFixed(3), n.position.y.toFixed(3), n.position.z.toFixed(3)],
                    };
                    if (n.isMesh && n.geometry) {
                        const p = n.geometry.getAttribute('position');
                        if (p) {
                            let mn=Infinity, mx=-Infinity;
                            for (let i = 0; i < p.count; i++) {
                                const v = Math.abs(p.getX(i));
                                if (v > mx) mx = v;
                                if (v < mn) mn = v;
                            }
                            entry.vertexRange_X = [mn.toFixed(3), mx.toFixed(3)];
                            entry.vertexCount = p.count;
                        }
                    }
                    out.push(entry);
                });
                // Also report the model's world bbox
                m.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(m);
                const sz = new THREE.Vector3();
                box.getSize(sz);
                resolve({
                    nodes: out,
                    worldSize: [sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3)],
                });
            }, 1500);
        });
    }, b64);
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})().catch(e => { console.error('crash:', e); process.exit(1); });
