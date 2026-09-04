// Sapuan audit UI: kunjungi tiap route di beberapa viewport, ukur gejala layout,
// tangkap console error, simpan screenshot full-page.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const SHOTS = path.join(OUT, 'shots');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop',  width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

const ROUTES = (process.env.ROUTES || '/login,/register,/register/check-email,/forgot-password,/reset-password,/verify-email,/suspended').split(',');
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'id-ID' });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedReq = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
      page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
      page.on('requestfailed', r => failedReq.push(`${r.method()} ${r.url().slice(0,120)} — ${r.failure()?.errorText}`));

      let status = null;
      try {
        const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
        status = resp?.status();
      } catch (e) {
        report.push({ viewport: vp.name, route, error: String(e).slice(0, 200) });
        await page.close();
        continue;
      }
      await page.waitForTimeout(1200);

      const metrics = await page.evaluate(() => {
        const de = document.documentElement;
        const body = document.body;
        // elemen yang melampaui lebar viewport (penyebab scroll horizontal)
        const overflowX = [];
        const vw = de.clientWidth;
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
            overflowX.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 120),
              left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
            });
          }
        });
        // area kosong di bawah: konten terjauh vs tinggi dokumen
        let maxBottom = 0;
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          if (r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none') {
            maxBottom = Math.max(maxBottom, r.bottom + window.scrollY);
          }
        });
        return {
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).slice(0, 3),
          docScrollH: de.scrollHeight,
          docClientH: de.clientHeight,
          docScrollW: de.scrollWidth,
          docClientW: de.clientWidth,
          bodyScrollH: body.scrollHeight,
          innerH: window.innerHeight,
          maxContentBottom: Math.round(maxBottom),
          verticalScrollable: de.scrollHeight > de.clientHeight + 1,
          horizontalScrollable: de.scrollWidth > de.clientWidth + 1,
          overflowXCount: overflowX.length,
          overflowXSample: overflowX.slice(0, 6),
          htmlOverflow: getComputedStyle(de).overflow,
          bodyOverflow: getComputedStyle(body).overflow,
          // input tanpa label / aria-label
          unlabeledInputs: [...document.querySelectorAll('input,select,textarea')].filter(i => {
            if (i.type === 'hidden') return false;
            const id = i.id;
            const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
            return !hasLabel && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !i.closest('label');
          }).map(i => `${i.tagName.toLowerCase()}[type=${i.type||'-'}][name=${i.name||'-'}][ph=${(i.placeholder||'').slice(0,30)}]`),
          // tombol tanpa nama aksesibel
          namelessButtons: [...document.querySelectorAll('button')].filter(b =>
            !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')
          ).length,
          imagesNoAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length,
          langAttr: de.getAttribute('lang'),
        };
      });

      const shot = path.join(SHOTS, `${vp.name}${route.replace(/\//g, '_') || '_root'}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      report.push({ viewport: vp.name, route, status, ...metrics, consoleErrors, pageErrors, failedReq: failedReq.slice(0, 5), shot });
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, process.env.OUTNAME || 'sweep-public.json'), JSON.stringify(report, null, 2));
  console.log('OK ->', report.length, 'kombinasi');
})();
