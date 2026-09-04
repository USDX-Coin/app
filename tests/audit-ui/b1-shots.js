// Screenshot pendukung PR 2 kelompok DATA: A4 (Profil dua tema), B10 (profil 500),
// F3/D9 (coming soon), A7 (404), B2 (sesi kedaluwarsa), B12 (skeleton).
const { chromium } = require('@playwright/test');
const OUT = process.env.OUT || '/Users/wisnu/Documents/projects/USDX/catatan/audit-ui-2026-09-03/bukti-b1';

const USER = {
  id: 'u_audit', name: 'Audit Wisnu', email: 'audit@usdx.co.id', phone: null,
  entityType: 'INDIVIDUAL', kycStatus: 'VERIFIED', suspended: false,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};
const okMe = { status: 'success', metadata: null, data: USER };

const CASES = [
  { id: 'profil-terang', url: '/profile', tema: 'light' },
  { id: 'profil-gelap', url: '/profile', tema: 'dark' },
  { id: 'profil-500-data-basi', url: '/profile', tema: 'light', me500: true },
  { id: 'profil-skeleton-tanpa-cache', url: '/profile', tema: 'light', tanpaUser: true, meLambat: 15000, tungguSelector: '[data-slot=skeleton]' },
  { id: 'comingsoon-pengaturan-terang', url: '/settings', tema: 'light' },
  { id: 'comingsoon-pengaturan-gelap', url: '/settings', tema: 'dark' },
  { id: 'comingsoon-bridge-terang', url: '/bridge', tema: 'light' },
  { id: 'comingsoon-kirim-mobile', url: '/send', tema: 'light', vp: { width: 375, height: 812 } },
  { id: '404-terang', url: '/halaman-ngawur', tema: 'light', publik: true },
  { id: '404-gelap', url: '/halaman-ngawur', tema: 'dark', publik: true },
  { id: 'login-sesi-habis', url: '/login?sesi=habis', tema: 'light', publik: true },
];

(async () => {
  const browser = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const c of CASES) {
    if (only && !only.some((o) => c.id.includes(o))) continue;
    const ctx = await browser.newContext({ viewport: c.vp || { width: 1440, height: 900 }, locale: 'id-ID' });
    await ctx.addInitScript(({ u, tema, tanpaUser }) => {
      if (!tanpaUser) localStorage.setItem('usdx-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 }));
      else localStorage.setItem('usdx-auth', JSON.stringify({ state: { user: null, isAuthenticated: true }, version: 0 }));
      localStorage.setItem('usdx-lang', 'id');
      localStorage.setItem('theme', tema);
    }, { u: USER, tema: c.tema, tanpaUser: c.tanpaUser });

    await ctx.route('**://api-dev.usdx.co.id/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/v2/auth/me')) {
        if (c.me500) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'INTERNAL_ERROR', message: 'boom' } }) });
        if (c.meLambat) await new Promise((r) => setTimeout(r, c.meLambat));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okMe) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data: null }) });
    });

    const page = await ctx.newPage();
    await page.goto('http://localhost:3000' + c.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (c.tungguSelector) await page.waitForSelector(c.tungguSelector, { timeout: 60000 }).catch(() => {});
    else await page.waitForTimeout(c.publik ? 4000 : 7000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/ds-${c.id}.png`, fullPage: false });
    const teks = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').split('\n').filter(Boolean).slice(0, 20));
    console.log(`\n=== ${c.id}\n  ${JSON.stringify(teks)}`);
    await ctx.close();
  }
  await browser.close();
})();
