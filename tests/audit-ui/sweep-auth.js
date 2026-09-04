// Sapuan halaman ber-auth. Token bearer disuntik lewat interceptor karena cookie
// sesi backend tidak berlaku untuk localhost (beda site).
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const SHOTS = path.join(OUT, 'shots');
const TOKEN = fs.readFileSync(path.join(OUT, 'token.txt'), 'utf8').trim();

const VIEWPORTS = (process.env.VPS || 'desktop,laptop,tablet,mobile').split(',').map(n => ({
  desktop: { name: 'desktop', width: 1440, height: 900 },
  laptop:  { name: 'laptop',  width: 1280, height: 800 },
  tablet:  { name: 'tablet',  width: 768,  height: 1024 },
  mobile:  { name: 'mobile',  width: 375,  height: 812 },
}[n]));

const ROUTES = (process.env.ROUTES || '/mint,/redeem,/history,/kyc,/profile,/settings,/bridge,/send,/help,/support').split(',');

const PROBE = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;

  const rectOf = el => el.getBoundingClientRect();

  // 1. elemen yang keluar batas horizontal
  const overflowX = [];
  document.querySelectorAll('*').forEach(el => {
    const r = rectOf(el);
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      overflowX.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 100), left: Math.round(r.left), right: Math.round(r.right) });
    }
  });

  // 2. semua area yang bisa di-scroll + berapa "ekor kosong" di bawah kontennya
  const scrollers = [];
  document.querySelectorAll('*').forEach(el => {
    const st = getComputedStyle(el);
    const scrollableY = /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (!scrollableY) return;
    let maxBottom = 0;
    el.querySelectorAll('*').forEach(ch => {
      const cs = getComputedStyle(ch);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
      const r = rectOf(ch);
      if (r.height <= 0) return;
      maxBottom = Math.max(maxBottom, r.bottom - rectOf(el).top + el.scrollTop);
    });
    scrollers.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 110),
      scrollH: el.scrollHeight, clientH: el.clientHeight,
      contentBottom: Math.round(maxBottom),
      emptyTail: Math.round(el.scrollHeight - maxBottom),
    });
  });

  // 3. dokumen ikut scroll? (di shell h-screen seharusnya tidak)
  let docContentBottom = 0;
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = rectOf(el);
    if (r.height > 0) docContentBottom = Math.max(docContentBottom, r.bottom + window.scrollY);
  });

  const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');

  return {
    docScrollH: de.scrollHeight, docClientH: de.clientHeight,
    docScrollable: de.scrollHeight > de.clientHeight + 1,
    docContentBottom: Math.round(docContentBottom),
    docEmptyTail: Math.round(de.scrollHeight - docContentBottom),
    horizontalScrollable: de.scrollWidth > de.clientWidth + 1,
    overflowXCount: overflowX.length, overflowXSample: overflowX.slice(0, 5),
    scrollers,
    // sisa skeleton/spinner setelah jaringan diam
    stillLoading: [...document.querySelectorAll('.animate-pulse,.animate-spin,[data-loading]')].length,
    h1: [...document.querySelectorAll('h1')].map(txt).slice(0, 3),
    h2: [...document.querySelectorAll('h2')].map(txt).slice(0, 8),
    // kandidat teks kepotong
    truncated: [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && txt(el)).map(el => txt(el).slice(0, 60)).slice(0, 8),
    unlabeledInputs: [...document.querySelectorAll('input,select,textarea')].filter(i => {
      if (i.type === 'hidden') return false;
      const hasLabel = i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`);
      return !hasLabel && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !i.closest('label');
    }).map(i => `${i.tagName.toLowerCase()}[${i.type||'-'}][name=${i.name||'-'}]`),
    namelessButtons: [...document.querySelectorAll('button')].filter(b => !txt(b) && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    imagesNoAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1500),
    theme: document.documentElement.className,
    // teks yang warnanya nyaris sama dengan latarnya (indikasi kontras jeblok)
    lowContrast: (() => {
      const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number);
        const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = el => { let c = el; while (c) { const b = getComputedStyle(c).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; c = c.parentElement; } return 'rgb(255,255,255)'; };
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.children.length) return;
        const txt = (el.textContent || '').trim();
        if (!txt) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const l1 = lum(cs.color), l2 = lum(bgOf(el));
        if (l1 == null || l2 == null) return;
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        if (ratio < need) out.push({ txt: txt.slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, size, color: cs.color, bg: bgOf(el) });
      });
      return out.slice(0, 12);
    })(),
  };
};

(async () => {
  const browser = await chromium.launch();
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'id-ID',
      storageState: OUT + '/auth-state.json',
      colorScheme: process.env.DARK ? 'dark' : 'light',
    });
    if (process.env.DARK) await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
    if (process.env.LANG_EN) await ctx.addInitScript(() => { try { localStorage.setItem('usdx-lang', 'en'); } catch {} });
    // suntik bearer ke setiap panggilan API
    await ctx.route('**://api-dev.usdx.co.id/**', route => {
      const h = { ...route.request().headers(), authorization: 'Bearer ' + TOKEN };
      route.continue({ headers: h });
    });

    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const consoleErrors = [], pageErrors = [], apiErrors = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 250)); });
      page.on('pageerror', e => pageErrors.push(String(e).slice(0, 250)));
      page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) apiErrors.push(`${r.status()} ${r.request().method()} ${r.url().split('/api/')[1]}`); });

      let status = null, finalUrl = null;
      try {
        const resp = await page.goto('http://localhost:3000' + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        status = resp?.status();
        await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(2500);
        finalUrl = page.url();
      } catch (e) {
        report.push({ viewport: vp.name, route, error: String(e).slice(0, 200) });
        await page.close();
        continue;
      }

      const probe = await page.evaluate(PROBE);
      const shot = path.join(SHOTS, `${process.env.DARK ? 'dark-' : ''}${vp.name}${route.replace(/\//g, '_')}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      report.push({ viewport: vp.name, route, status, finalUrl, ...probe, consoleErrors, pageErrors, apiErrors, shot });
      console.log(`${vp.name} ${route} -> ${finalUrl} docScroll=${probe.docScrollable} scrollers=${probe.scrollers.length}`);
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, process.env.OUTNAME || 'sweep-auth.json'), JSON.stringify(report, null, 2));
  console.log('SELESAI ->', report.length, 'kombinasi');
})();
