// Verify all converted nature GLBs parse via the preview's loader.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--allow-file-access-from-files']
    });
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERR:', e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('CORS')) console.log('[err]', m.text()); });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','characters','preview.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));

    const files = ['Bush1','Bush2','Bush3','Grass1','Grass2','Grass3','Rock1','Rock2','Rock3','Tree1','Tree2','Tree3','Tree4'];
    let ok = 0;
    for (const f of files) {
        const buf = fs.readFileSync(path.resolve(path.join(__dirname,'..','characters','nature',f+'.glb')));
        const b64 = buf.toString('base64');
        const r = await page.evaluate(async (b64, label) => {
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            return new Promise(resolve => {
                window.loadFromArrayBuffer(bytes.buffer, label);
                let waited = 0;
                const tick = () => {
                    if (window.currentModel) resolve({ ok: true });
                    else if (waited > 3000) resolve({ ok: false });
                    else { waited += 100; setTimeout(tick, 100); }
                };
                setTimeout(tick, 100);
            });
        }, b64, f+'.glb');
        if (r.ok) ok++;
        console.log((r.ok?'PASS':'FAIL') + '  ' + f + '.glb');
    }
    console.log('\n' + ok + '/' + files.length + ' parsed cleanly');
    await browser.close();
    process.exit(ok === files.length ? 0 : 1);
})().catch(e => { console.error('crash:', e); process.exit(1); });
