// Bukti B1: empat keadaan Riwayat harus terlihat berbeda satu sama lain.
// Sesi dipalsukan lewat localStorage (zustand persist) + interceptor, jadi tidak
// perlu akun dev sungguhan — semua panggilan /api/v2/* dijawab di sini.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.OUT || '/Users/wisnu/Documents/projects/USDX/catatan/audit-ui-2026-09-03/bukti-b1';

const USER = {
  id: 'u_audit', name: 'Audit Wisnu', email: 'audit@usdx.co.id', phone: null,
  entityType: 'INDIVIDUAL', kycStatus: 'VERIFIED', suspended: false,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

const tx = (i, type) => ({
  id: 'tx_' + type + i, type,
  amount: String(100 + i),
  subtotalIdr: type === 'MINT' ? '1600000' : null,
  grossIdr: type === 'REDEEM' ? '1600000' : null,
  totalPayIdr: type === 'MINT' ? '1611200' : null,
  netPayoutIdr: type === 'REDEEM' ? '1588800' : null,
  effectiveRate: '16000', chain: 'polygon',
  paymentStatus: type === 'MINT' ? 'PAID' : null,
  status: type === 'MINT' ? 'COMPLETED' : 'AWAITING_BURN',
  txHash: '0xabc1234567890def1234567890abcdef12345678',
  createdAt: '2026-09-0' + ((i % 9) + 1) + 'T04:05:00.000Z',
  updatedAt: '2026-09-0' + ((i % 9) + 1) + 'T04:05:00.000Z',
});

const ok = (rows, total) => ({ status: 'success', metadata: { page: 1, limit: 10, total }, data: rows });
const err = (code, message) => ({ status: 'error', metadata: null, data: null, error: { code, message } });

const CASES = [
  { id: '1-kosong-sungguhan', tx: () => ({ s: 200, b: ok([], 0) }) },
  { id: '2-kosong-karena-filter',
    tx: (url) => url.includes('type=MINT') ? { s: 200, b: ok([], 0) } : { s: 200, b: ok([tx(1, 'REDEEM')], 1) },
    klik: 'tab-mint' },
  { id: '3-server-500', tx: () => ({ s: 500, b: err('INTERNAL_ERROR', 'boom') }) },
  { id: '4-jaringan-mati', abortTx: true },
  { id: '5-ada-data', tx: () => ({ s: 200, b: ok([tx(1, 'MINT'), tx(2, 'REDEEM')], 2) }) },
];

const PROBE = () => {
  const q = (s) => [...document.querySelectorAll(s)];
  const teks = document.body.innerText.replace(/\n{2,}/g, '\n').trim();
  return {
    teksLayar: teks.split('\n').filter(Boolean).slice(0, 14),
    alert: q('[data-slot=alert]').map(a => ({ tone: a.dataset.tone, shape: a.dataset.shape, role: a.getAttribute('role'), teks: a.innerText.replace(/\n/g, ' | ') })),
    empty: q('[data-slot=empty]').map(e => ({ media: (e.querySelector('[data-slot=empty-media]') || {}).dataset?.kind ?? null, teks: e.innerText.replace(/\n/g, ' | ') })),
    barisTabel: q('[data-slot=table] tbody tr').length,
    kartuMobile: q('main .lg\\:hidden > div').length,
    tombol: q('button').map(b => b.innerText.trim()).filter(Boolean),
    skeleton: q('[data-slot=skeleton]').length,
    tablist: q('[role=tablist]').length,
    tabTerpilih: q('[role=tab][data-state=active]').map(t => t.innerText.trim()),
  };
};

(async () => {
  const browser = await chromium.launch();
  const hasil = {};
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID' });
    await ctx.addInitScript((u) => {
      localStorage.setItem('usdx-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 }));
      localStorage.setItem('usdx-lang', 'id');
    }, USER);
    await ctx.route('**://api-dev.usdx.co.id/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/v2/transactions')) {
        if (c.abortTx) return route.abort('internetdisconnected');
        const { s, b } = c.tx(url);
        return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      }
      if (url.includes('/api/v2/auth/me')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data: USER }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data: null }) });
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.goto('http://localhost:3000/history', { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Tunggu shell selesai hidrasi + query selesai, bukan tunggu waktu buta:
    // spinner shell dan skeleton dua-duanya harus sudah hilang.
    await page.waitForSelector('[role=tablist]', { timeout: 90000 }).catch(() => {});
    await page.waitForSelector('[data-slot=alert], [data-slot=empty], [data-slot=table]', { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (c.klik === 'tab-mint') {
      await page.locator('[role=tab]').nth(1).click();
      await page.waitForTimeout(3000);
    }
    const m = await page.evaluate(PROBE);
    await page.screenshot({ path: `${OUT}/b1-${c.id}.png`, fullPage: true });
    hasil[c.id] = { ...m, pageErrors: errs };
    console.log(`\n=== ${c.id}`);
    console.log('  alert :', JSON.stringify(m.alert));
    console.log('  empty :', JSON.stringify(m.empty));
    console.log('  baris tabel:', m.barisTabel, '| tombol:', JSON.stringify(m.tombol));
    console.log('  layar :', JSON.stringify(m.teksLayar));
    if (errs.length) console.log('  ⚠ pageError:', JSON.stringify(errs));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/b1-hasil.json`, JSON.stringify(hasil, null, 2));
  await browser.close();
})();
