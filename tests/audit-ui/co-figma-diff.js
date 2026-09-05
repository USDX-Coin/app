// Tangkap layar checkout untuk pembandingan dengan Figma `50 · Checkout`.
// Sepenuhnya berdiri sendiri: exchange handoff, GET mint, dan POST /pay semuanya dipalsukan,
// jadi tidak butuh token / order sungguhan dan tidak terganggu 500 dari /pay di dev.
const { chromium } = require('@playwright/test');
const fs = require('fs');

const OUT = process.env.AUDIT_OUT || '/private/tmp/claude-502/-Users-wisnu-Documents-projects/15b7ffdf-1d71-4bbc-b263-4178e37b7882/scratchpad/impl';
fs.mkdirSync(OUT, { recursive: true });
const ORDER = '3f8a1c22-9b41-4e7d-8c55-1d2e3f4a5b6c';
const BASE = 'http://localhost:3001';
const DARK = !!process.env.DARK;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const VIEWPORTS = (process.env.VPS || 'desktop').split(',').map((v) => {
  if (v === 'mobile') return { name: 'mobile', width: 375, height: 900 };
  if (v === 'w320') return { name: 'w320', width: 320, height: 900 };
  return { name: 'desktop', width: 1440, height: 1000 };
});

const now = Date.now();
const BASE_ORDER = {
  id: ORDER,
  orderNumber: 'MNT-20260905-0042',
  customerName: 'Aditya Wisnu Wardana',
  type: 'MINT',
  userAddress: '0x7A3fB1c9De24aE5b8F0c1D2e3F4a5B6c7D8e9F01',
  chain: 'polygon',
  inputCurrency: 'IDR',
  amount: '250',
  baseRate: '16250',
  spreadBuyPct: '0.5',
  effectiveRate: '16331.25',
  subtotalIdr: '4082812',
  mintFeePct: '0.5',
  mintFeeIdr: '20414',
  totalBeforePgFeeIdr: '4103226',
  paymentChannel: null,
  pgFeeIdr: null,
  totalFeeIdr: null,
  totalPayIdr: null,
  paymentBank: null,
  paymentStatus: 'REQUESTED',
  safeStatus: 'NONE',
  status: 'WAITING_FOR_PAYMENT',
  paymentProvider: 'DURIANPAY',
  paymentMode: 'LIVE',
  virtualAccountNo: null,
  paymentUrl: null,
  paymentRef: null,
  paidAt: null,
  expiresAt: new Date(now + 13 * 60000).toISOString(),
  safeTxHash: null,
  onChainTxHash: null,
  createdAt: new Date(now - 90000).toISOString(),
  updatedAt: new Date(now - 5000).toISOString(),
  channels: [
    { channel: 'VA', pgFeeIdr: '4500', banks: ['BNI', 'MANDIRI', 'BRI'] },
    { channel: 'QRIS', pgFeeIdr: '30774', banks: null },
  ],
};

const VA_ISSUED = {
  ...BASE_ORDER,
  paymentChannel: 'VA',
  paymentBank: 'BNI',
  pgFeeIdr: '4500',
  totalFeeIdr: '24914',
  totalPayIdr: '4108019',
  paymentStatus: 'WAITING_FOR_PAYMENT',
  virtualAccountNo: '8878471690378849',
  paymentRef: 'DP-VA-99172',
  expiresAt: new Date(now + 58 * 60000).toISOString(),
  channels: undefined,
};

const QRIS_ISSUED = {
  ...BASE_ORDER,
  paymentChannel: 'QRIS',
  paymentBank: null,
  pgFeeIdr: '30774',
  totalFeeIdr: '51188',
  totalPayIdr: '4134000',
  paymentStatus: 'WAITING_FOR_PAYMENT',
  paymentUrl: '00020101021226670016COM.NOBUBANK.WWW01189360050300000898740214149391352737430303UMI51440014ID.CO.QRIS.WWW0215ID20232882792630303UMI5204541153033605802ID5910USDX%20MINT6013JAKARTA%20PUSAT61051034062070703A0163045E4A',
  expiresAt: new Date(now + 25 * 60000).toISOString(),
  channels: undefined,
};

const PAID = { ...VA_ISSUED, status: 'WAITING_FOR_APPROVAL', paymentStatus: 'PAID', safeStatus: 'PENDING_APPROVAL', paidAt: new Date(now - 240000).toISOString() };

const CASES = {
  'a1-ringkasan-pilih-metode': { order: BASE_ORDER },
  'a1b-metode-va-bank': { order: BASE_ORDER, act: 'pickVaBank' },
  'a1c-metode-qris': { order: BASE_ORDER, act: 'pickQris' },
  'a2-instruksi-va': { order: VA_ISSUED },
  'a2b-instruksi-va-accordion': { order: VA_ISSUED, act: 'openAccordions' },
  'a3-instruksi-qris': { order: QRIS_ISSUED },
  'b1-sudah-dibayar': { order: PAID },
  'b2-ditahan': { ...{}, order: { ...VA_ISSUED, status: 'WAITING_FOR_APPROVAL', paymentStatus: 'HELD', paidAt: new Date(now - 900000).toISOString() } },
  'b3-kedaluwarsa': { order: { ...VA_ISSUED, status: 'FAILED', paymentStatus: 'EXPIRED', expiresAt: new Date(now - 60000).toISOString() } },
  'c1-failed-paid': { order: { ...PAID, status: 'FAILED', safeStatus: 'REJECTED' } },
  'c2-held-rejected': { order: { ...VA_ISSUED, status: 'FAILED', paymentStatus: 'HELD', paidAt: new Date(now - 900000).toISOString() } },
  'd1-sukses': { order: { ...PAID, status: 'COMPLETED', safeStatus: 'EXECUTED', onChainTxHash: '0xc31775e3ca9467c427ea0f0112ed1aac30ab56320558771dcc1fe897f1f45e03' } },
  'e1-gagal-muat-500': { httpStatus: 500 },
  'e2-tidak-ditemukan-404': { httpStatus: 404 },
};

const cors = {
  'access-control-allow-origin': BASE,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
};
const ok = (data) => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'success', metadata: null, data }) });

const PROBE = () => {
  const de = document.documentElement;
  return {
    scrollX: de.scrollWidth > de.clientWidth + 1,
    scrollW: de.scrollWidth,
    clientW: de.clientWidth,
    teks: document.body.innerText.replace(/\n{2,}/g, '\n').split('\n').filter((x) => x.trim()).slice(0, 30),
  };
};

(async () => {
  const browser = await chromium.launch();
  const hasil = {};
  for (const VP of VIEWPORTS) {
    for (const [nama, cfg] of Object.entries(CASES)) {
      if (ONLY && !ONLY.includes(nama)) continue;
      const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, locale: 'id-ID', colorScheme: DARK ? 'dark' : 'light', deviceScaleFactor: 2 });
      if (DARK) await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
      let current = cfg.order;
      await ctx.route('**://api-dev.usdx.co.id/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (/checkout-token\/exchange/.test(url)) return route.fulfill(ok({ token: 'palsu-sesi-token' }));
        if (/\/api\/v2\/mint\/[^/]+\/pay$/.test(url)) {
          const body = JSON.parse(route.request().postData() || '{}');
          current = body.channel === 'QRIS' ? QRIS_ISSUED : { ...VA_ISSUED, paymentBank: body.bank || 'BNI' };
          return route.fulfill(ok(current));
        }
        if (/\/api\/v2\/mint\/[^/]+$/.test(url)) {
          if (cfg.httpStatus) return route.fulfill({ status: cfg.httpStatus, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'E', message: 'x' } }) });
          return route.fulfill(ok(current));
        }
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'success', metadata: null, data: {} }) });
      });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
      await page.goto(`${BASE}/checkout/${ORDER}#code=palsu-code`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);

      if (cfg.act === 'pickVaBank') {
        await page.getByText('Virtual Account', { exact: true }).first().click().catch(() => {});
        await page.waitForTimeout(400);
      } else if (cfg.act === 'pickQris') {
        await page.getByText('QRIS', { exact: true }).first().click().catch(() => {});
        await page.waitForTimeout(400);
      } else if (cfg.act === 'openAccordions') {
        for (const d of await page.locator('details').all()) await d.evaluate((el) => { el.open = true; }).catch(() => {});
        await page.waitForTimeout(400);
      }

      const m = await page.evaluate(PROBE);
      const file = `${OUT}/co-${DARK ? 'dark-' : ''}${VP.name}-${nama}.png`;
      await page.screenshot({ path: file, fullPage: true });
      hasil[`${VP.name}/${nama}`] = { ...m, errs, file };
      console.log(`[${VP.name}${DARK ? '/dark' : ''}] ${nama}  scrollX=${m.scrollX} (${m.scrollW}>${m.clientW})${errs.length ? '  ERR:' + errs[0] : ''}`);
      await ctx.close();
    }
  }
  fs.writeFileSync(`${OUT}/hasil-${DARK ? 'dark-' : ''}${VIEWPORTS.map((v) => v.name).join('_')}.json`, JSON.stringify(hasil, null, 2));
  await browser.close();
})();
