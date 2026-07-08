// Smoke test for characters/preview.html:
//   - Loads the page over file://
//   - Programmatically loads Goblin.glb (Draco compressed) and verifies it parses
//   - Loads BigVegas.glb and verifies it parses
//   - Loads HVGirl.glb and verifies its 4 animations are listed
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader',
               '--allow-file-access-from-files']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 720 });

    const pageErrs = [];
    const consoleErrs = [];
    page.on('pageerror', e => pageErrs.push('PAGEERR: ' + e.message));
    page.on('console', m => {
        const txt = m.text();
        if (m.type() === 'error' && !txt.includes('CORS') && !txt.includes('Failed to load resource')) {
            consoleErrs.push('[err] ' + txt);
        }
    });

    const htmlPath = 'file:///' + path.resolve(path.join(__dirname,'..','characters','preview.html')).replace(/\\/g,'/');
    await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));

    if (pageErrs.length || consoleErrs.length) {
        console.log('UNEXPECTED ERRORS:');
        pageErrs.forEach(e => console.log(e));
        consoleErrs.forEach(e => console.log(e));
        await browser.close();
        process.exit(1);
    }

    console.log('=== PREVIEW SMOKE TEST ===\n');
    console.log('preview.html loaded with no JS errors\n');

    // Helper: read a GLB from disk, base64-encode, push into the page,
    // and run loadFromArrayBuffer with it (simulating drag-drop)
    async function loadGLB(relPath, label) {
        const fullPath = path.resolve(path.join(__dirname,'..','characters', relPath));
        const buf = fs.readFileSync(fullPath);
        const b64 = buf.toString('base64');
        const result = await page.evaluate(async (b64, label) => {
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            return new Promise(resolve => {
                window.loadFromArrayBuffer(bytes.buffer, label);
                // Wait a tick for parse to complete (Draco is async)
                let waited = 0;
                const tick = () => {
                    if (window.currentModel) {
                        const animBtns = document.querySelectorAll('#anim-list button');
                        const animNames = Array.from(animBtns).map(b => b.dataset.name);
                        resolve({ ok: true, anims: animNames });
                    } else if (waited > 5000) {
                        resolve({ ok: false, error: 'timeout' });
                    } else {
                        waited += 100;
                        setTimeout(tick, 100);
                    }
                };
                setTimeout(tick, 100);
            });
        }, b64, label);
        return result;
    }

    // First need to expose loadFromArrayBuffer / currentModel on window
    await page.evaluate(() => {
        // The variables are in module-style scope; expose them
        window.loadFromArrayBuffer = loadFromArrayBuffer;
    });

    // Test 1: Goblin (Draco compressed) - this was the failing case
    const goblin = await loadGLB('fantasy/Goblin.glb', 'Goblin.glb');
    console.log('Goblin:    ', JSON.stringify(goblin));

    // Test 2: BigVegas (no draco)
    const vegas = await loadGLB('humans/BigVegas.glb', 'BigVegas.glb');
    console.log('BigVegas:  ', JSON.stringify(vegas));

    // Test 3: HVGirl (sanity check, no draco)
    const girl = await loadGLB('humans/HVGirl.glb', 'HVGirl.glb');
    console.log('HVGirl:    ', JSON.stringify(girl));

    // Test 4: file:// detection should have rewritten the hint
    const hintText = await page.evaluate(() => {
        const h = document.querySelector('#known-list h3');
        return h ? h.textContent : null;
    });
    console.log('\nfile:// hint text:', JSON.stringify(hintText));

    console.log('\n=== ASSERTIONS ===');
    const checks = [
        ['Goblin (Draco) loaded',                  goblin.ok === true],
        ['Goblin has at least 1 animation',        goblin.ok && goblin.anims.length >= 1],
        ['BigVegas loaded',                        vegas.ok === true],
        ['BigVegas has at least 1 animation',      vegas.ok && vegas.anims.length >= 1],
        ['HVGirl loaded',                          girl.ok === true],
        ['HVGirl has its 4 animations',            girl.ok && girl.anims.length === 4 && girl.anims.includes('Idle') && girl.anims.includes('Samba')],
        ['file:// hint text was rewritten',        hintText && hintText.includes('drag')],
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
