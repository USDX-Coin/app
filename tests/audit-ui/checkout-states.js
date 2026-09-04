// Audit halaman checkout di setiap kondisi order. Hanya respons order yang diubah.
const { chromium, request } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const TOKEN = fs.readFileSync(OUT + '/token.txt', 'utf8').trim();
const ORDER = process.env.ORDER;
const API = 'https://api-dev.usdx.co.id';
const log = (...a) => console.log(...a);
const VP = process.env.VP === 'mobile' ? { name: 'mobile', width: 375, height: 812 } : { name: 'desktop', width: 1440, height: 900 };
const DARK = !!process.env.DARK;

async function baseOrder() {
  const rc = await request.newContext();
  const r = await rc.get(`${API}/api/v2/mint/${ORDER}`, { headers: { authorization: 'Bearer ' + TOKEN } });
  const j = await r.json(); await rc.dispose();
  return j.data;
}
async function newCode() {
  const rc = await request.newContext();
  const r = await rc.post(`${API}/api/v2/auth/checkout-token`, { headers: { authorization: 'Bearer ' + TOKEN } });
  const j = await r.json(); await rc.dispose();
  return j?.data?.code;
}

const PROBE = () => {
  const de = document.documentElement;
  const t = document.body.innerText.replace(/\n{2,}/g, '\n');
  let contentBottom = 0;
  document.querySelectorAll('body *').forEach(el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return; const r = el.getBoundingClientRect(); if (r.height > 0) contentBottom = Math.max(contentBottom, r.bottom + window.scrollY); });
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { let c = el; while (c) { const b = getComputedStyle(c).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; c = c.parentElement; } return 'rgb(255,255,255)'; };
  const low = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length) return; const txt = (el.textContent || '').trim(); if (!txt) return;
    const cs = getComputedStyle(el); if (cs.display === 'none') return;
    const l1 = lum(cs.color), l2 = lum(bgOf(el)); if (l1 == null || l2 == null) return;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) low.push({ txt: txt.slice(0, 45), ratio: Math.round(ratio * 100) / 100, need, color: cs.color, bg: bgOf(el) });
  });
  return {
    teks: t.slice(0, 1400),
    docScrollable: de.scrollHeight > de.clientHeight + 1,
    docEmptyTail: Math.round(de.scrollHeight - contentBottom),
    scrollX: de.scrollWidth > de.clientWidth + 1,
    tombol: [...document.querySelectorAll('button,a')].map(b => ((b.textContent || '').trim() || b.getAttribute('aria-label') || '(ikon)') + (b.disabled ? '[off]' : '')).filter(Boolean),
    adaJalanPulang: [...document.querySelectorAll('button,a')].some(b => /kembali|balik|app|tutup/i.test(b.textContent || '')),
    kontrasRendah: low.slice(0, 8),
    theme: de.className,
  };
};

(async () => {
  const base = await baseOrder();
  const now = Date.now();
  const CASES = {
    'menunggu bayar (belum pilih metode)': { ...base, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'REQUESTED', paymentChannel: null, paymentBank: null, virtualAccountNo: null, totalPayIdr: null, expiresAt: new Date(now + 14 * 60000).toISOString() },
    'menunggu bayar (VA terbit)': { ...base, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'WAITING_FOR_PAYMENT', expiresAt: new Date(now + 45 * 60000).toISOString() },
    'sudah dibayar (menunggu on-chain)': { ...base, status: 'WAITING_FOR_APPROVAL', paymentStatus: 'PAID' },
    'DITAHAN (nominal tak cocok)': { ...base, status: 'WAITING_FOR_APPROVAL', paymentStatus: 'HELD' },
    'KEDALUWARSA': { ...base, status: 'FAILED', paymentStatus: 'EXPIRED', expiresAt: new Date(now - 60000).toISOString() },
    'GAGAL (bukan kedaluwarsa)': { ...base, status: 'FAILED', paymentStatus: 'PAID' },
    'SELESAI (mint berhasil)': { ...base, status: 'COMPLETED', paymentStatus: 'PAID', onChainTxHash: '0xc31775e3ca9467c427ea0f0112ed1aac30ab56320558771dcc1fe897f1f45e03', txHash: '0xc31775e3ca9467c427ea0f0112ed1aac30ab56320558771dcc1fe897f1f45e03' },
    'SELESAI tapi tx belum ada': { ...base, status: 'COMPLETED', paymentStatus: 'PAID', onChainTxHash: null, txHash: null },
  };
  const ERRORS = { 'pesanan tidak ditemukan (404)': 404, 'sesi tidak valid (401)': 401, 'server error (500)': 500 };

  const browser = await chromium.launch();
  const hasil = {};
  for (const [nama, order] of [...Object.entries(CASES), ...Object.entries(ERRORS).map(([n, s]) => [n, s])]) {
    const isErr = typeof order === 'number';
    const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, locale: 'id-ID', colorScheme: DARK ? 'dark' : 'light' });
    if (DARK) await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
    await ctx.route('**://api-dev.usdx.co.id/**', async route => {
      const url = route.request().url();
      const cors = { 'access-control-allow-origin': 'http://localhost:3001', 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (/\/api\/v2\/mint\/[^/]+$/.test(url)) {
        if (isErr) return route.fulfill({ status: order, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'E', message: 'x' } }) });
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'success', metadata: null, data: order }) });
      }
      try { const resp = await route.fetch(); return route.fulfill({ response: resp, headers: { ...resp.headers(), ...cors } }); } catch { return route.abort(); }
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    const code = await newCode();
    await page.goto(`http://localhost:3001/checkout/${ORDER}#code=${encodeURIComponent(code)}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const m = await page.evaluate(PROBE);
    const slug = nama.replace(/[^a-zA-Z0-9]+/g, '-');
    await page.screenshot({ path: `${OUT}/shots/co-${DARK ? 'dark-' : ''}${VP.name}-${slug}.png`, fullPage: true });
    hasil[nama] = { ...m, errs };
    log(`\n=== CHECKOUT: ${nama} (${VP.name}${DARK ? '/dark' : ''}) ===`);
    log('  tombol:', JSON.stringify(m.tombol));
    log('  jalanPulang=' + m.adaJalanPulang, 'docScroll=' + m.docScrollable, 'scrollX=' + m.scrollX);
    if (m.kontrasRendah.length) log('  ⚠ kontras rendah:', JSON.stringify(m.kontrasRendah.slice(0, 4)));
    if (errs.length) log('  ⚠ pageError:', JSON.stringify(errs).slice(0, 160));
    log('  isi:', JSON.stringify(m.teks.split('\n').filter(x => x.trim()).slice(0, 14)));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/checkout-states-${DARK ? 'dark-' : ''}${VP.name}.json`, JSON.stringify(hasil, null, 2));
  await browser.close();
})();
