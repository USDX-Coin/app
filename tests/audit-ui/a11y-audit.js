// Aksesibilitas: indikator fokus keyboard + ukuran target sentuh + urutan tab.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const TOKEN = fs.readFileSync(OUT + '/token.txt', 'utf8').trim();
const log = (...a) => console.log(...a);
const ROUTES = (process.env.ROUTES || '/login,/register,/mint,/redeem,/history,/profile').split(',');

(async () => {
  const browser = await chromium.launch();
  const hasil = {};
  for (const route of ROUTES) {
    const auth = !['/login', '/register'].includes(route);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'id-ID', ...(auth ? { storageState: OUT + '/auth-state.json' } : {}) });
    await ctx.route('**://api-dev.usdx.co.id/**', r => r.continue({ headers: { ...r.request().headers(), authorization: 'Bearer ' + TOKEN } }));
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);

    // target sentuh < 44px
    const kecil = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button,a,input[type=checkbox],[role=button]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.width < 44 || r.height < 44) out.push({ nama: ((el.textContent || '').trim() || el.getAttribute('aria-label') || el.tagName).slice(0, 32), w: Math.round(r.width), h: Math.round(r.height) });
      });
      return out;
    });

    // telusuri fokus keyboard
    const fokus = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const terlihat = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /ring/.test(el.className || '') || cs.boxShadow !== 'none';
        return { tag: el.tagName.toLowerCase(), nama: ((el.textContent || '').trim() || el.getAttribute('aria-label') || '').slice(0, 30), outline: cs.outline, boxShadow: cs.boxShadow.slice(0, 30), terlihat };
      });
      if (f) fokus.push(f);
    }
    const tanpaIndikator = fokus.filter(f => !f.terlihat);
    hasil[route] = { targetKecil: kecil, fokus, tanpaIndikator };
    log(`\n=== ${route} (mobile 375) ===`);
    log(`  target sentuh <44px: ${kecil.length}`, kecil.length ? JSON.stringify(kecil.slice(0, 8)) : '');
    log(`  elemen fokus tanpa indikator terlihat: ${tanpaIndikator.length}/${fokus.length}`, tanpaIndikator.length ? JSON.stringify(tanpaIndikator.map(f => f.tag + ':' + f.nama).slice(0, 8)) : '');
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/a11y-audit.json', JSON.stringify(hasil, null, 2));
  await browser.close();
})();
