// Audit halaman KYC di tiap status. Hanya respons status KYC yang di-override;
// halaman, komponen, dan sisa API tetap yang asli.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const TOKEN = fs.readFileSync(OUT + '/token.txt', 'utf8').trim();
const log = (...a) => console.log(...a);

const STATES = {
  UNVERIFIED: { status: 'UNVERIFIED', submissionCount: 0, submittedAt: null, reviewedAt: null, rejectionReason: null, cddComplete: false },
  PENDING:    { status: 'PENDING', submissionCount: 1, submittedAt: '2026-09-01T02:00:00.000Z', reviewedAt: null, rejectionReason: null, cddComplete: false },
  REJECTED:   { status: 'REJECTED', submissionCount: 1, submittedAt: '2026-09-01T02:00:00.000Z', reviewedAt: '2026-09-02T02:00:00.000Z', rejectionReason: 'Foto KTP buram, nama tidak terbaca.', cddComplete: false },
  VERIFIED_CDD: { status: 'VERIFIED', submissionCount: 1, submittedAt: '2026-08-04T04:26:22.578Z', reviewedAt: '2026-08-05T04:28:38.810Z', rejectionReason: null, cddComplete: false },
};

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const PROBE = () => {
  const de = document.documentElement;
  let contentBottom = 0;
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.height > 0) contentBottom = Math.max(contentBottom, r.bottom + window.scrollY);
  });
  const scrollers = [];
  document.querySelectorAll('*').forEach(el => {
    const st = getComputedStyle(el);
    if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 1) return;
    let mb = 0;
    const top = el.getBoundingClientRect().top;
    el.querySelectorAll('*').forEach(ch => {
      const cs = getComputedStyle(ch);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
      const r = ch.getBoundingClientRect();
      if (r.height > 0) mb = Math.max(mb, r.bottom - top + el.scrollTop);
    });
    scrollers.push({ cls: String(el.className || '').slice(0, 70), scrollH: el.scrollHeight, clientH: el.clientHeight, emptyTail: Math.round(el.scrollHeight - mb) });
  });
  return {
    docScrollable: de.scrollHeight > de.clientHeight + 1,
    docScrollH: de.scrollHeight, docClientH: de.clientHeight,
    docEmptyTail: Math.round(de.scrollHeight - contentBottom),
    horizontalScrollable: de.scrollWidth > de.clientWidth + 1,
    scrollers,
    inputs: document.querySelectorAll('input,select,textarea').length,
    unlabeled: [...document.querySelectorAll('input,select,textarea')].filter(i => {
      if (i.type === 'hidden') return false;
      const l = i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`);
      return !l && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !i.closest('label');
    }).map(i => `${i.tagName.toLowerCase()}[${i.type || '-'}][name=${i.name || '-'}][ph=${(i.placeholder || '').slice(0, 24)}]`),
    disabledInputs: [...document.querySelectorAll('input,select,textarea')].filter(i => i.disabled).length,
    buttons: [...document.querySelectorAll('button')].map(b => ((b.textContent || '').trim() || b.getAttribute('aria-label') || '(tanpa nama)') + (b.disabled ? ' [off]' : '')),
    text: document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 1400),
  };
};

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [name, kyc] of Object.entries(STATES)) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'id-ID', storageState: OUT + '/auth-state.json' });
      await ctx.route('**://api-dev.usdx.co.id/**', async route => {
        const url = route.request().url();
        const headers = { ...route.request().headers(), authorization: 'Bearer ' + TOKEN };
        if (/\/api\/v2\/kyc\/me$/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data: kyc }) });
        }
        if (/\/api\/v2\/auth\/me$/.test(url)) {
          const resp = await route.fetch({ headers });
          const j = await resp.json();
          if (j?.data) j.data.kycStatus = kyc.status;
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
        }
        return route.continue({ headers });
      });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
      page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
      await page.goto('http://localhost:3000/kyc', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const probe = await page.evaluate(PROBE);
      await page.screenshot({ path: `${OUT}/shots/kyc-${name}-${vp.name}.png`, fullPage: true });
      out[`${name}/${vp.name}`] = { ...probe, errs };
      log(`\n=== KYC ${name} / ${vp.name} ===`);
      log('  docScrollable=' + probe.docScrollable, 'docH=' + probe.docScrollH + '/' + probe.docClientH, 'ekorKosongDoc=' + probe.docEmptyTail, 'scrollX=' + probe.horizontalScrollable);
      probe.scrollers.forEach(s => log('  scroller:', s.scrollH + '/' + s.clientH, 'ekorKosong=' + s.emptyTail, s.cls));
      log('  input=' + probe.inputs, 'disabled=' + probe.disabledInputs, 'tanpaLabel=' + probe.unlabeled.length);
      if (probe.unlabeled.length) log('   →', JSON.stringify(probe.unlabeled).slice(0, 400));
      log('  tombol:', JSON.stringify(probe.buttons).slice(0, 300));
      if (errs.length) log('  ⚠ error:', JSON.stringify(errs).slice(0, 300));
      if (vp.name === 'desktop') log('  teks:\n' + probe.text.split('\n').slice(0, 25).map(l => '    ' + l).join('\n'));
      await ctx.close();
    }
  }
  fs.writeFileSync(OUT + '/kyc-states.json', JSON.stringify(out, null, 2));
  await browser.close();
})();
