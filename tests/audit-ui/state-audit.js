// Audit kondisi/state: kosong, daftar panjang, error 500/401/429, offline, loading lambat.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const TOKEN = fs.readFileSync(OUT + '/token.txt', 'utf8').trim();
const log = (...a) => console.log(...a);
const VP = process.env.VP === 'mobile' ? { name: 'mobile', width: 375, height: 812 } : { name: 'desktop', width: 1440, height: 900 };

const ok = d => ({ status: 'success', metadata: null, data: d });
const err = (code, msg) => ({ status: 'error', metadata: null, data: null, error: { code, message: msg } });

const banyakWallet = Array.from({ length: 12 }, (_, i) => ({
  id: 'w' + i, label: 'Wallet cadangan nomor ' + (i + 1), chain: 'polygon',
  address: '0x' + (i + 1).toString().padStart(2, '0') + '33335b13F29e208eE1066Fd6cE86Da6695' + i,
  createdAt: '2026-08-01T00:00:00.000Z',
}));

const CASES = [
  { nama: 'Riwayat · loading lambat 8 detik', url: '/history', delay: { frag: 'transactions', ms: 8000 }, tungguMs: 2500 },
  { nama: 'Mint · loading lambat 8 detik', url: '/mint', delay: { frag: 'rate', ms: 8000 }, tungguMs: 2500 },
  { nama: 'Profil · loading lambat 8 detik', url: '/profile', delay: { frag: 'auth/me', ms: 8000 }, tungguMs: 2500 },
  { nama: 'Buku alamat · 12 entri', url: '/mint', routes: { 'address-book': () => ({ s: 200, b: ok(banyakWallet) }) },
    open: async p => p.locator('div.bg-muted button').first().click() },
  { nama: 'Riwayat · kosong', url: '/history', routes: { 'transactions': () => ({ s: 200, b: { status: 'success', metadata: { page: 1, limit: 10, total: 0 }, data: [] } }) } },
  { nama: 'Riwayat · server error 500', url: '/history', routes: { 'transactions': () => ({ s: 500, b: err('INTERNAL_ERROR', 'Internal server error') }) } },
  { nama: 'Mint · rate gagal 500', url: '/mint', routes: { 'rate': () => ({ s: 500, b: err('INTERNAL_ERROR', 'Internal server error') }) } },
  { nama: 'Mint · sesi kedaluwarsa 401', url: '/mint', routes: { 'rate': () => ({ s: 401, b: err('UNAUTHORIZED', 'Session expired') }), 'auth/me': () => ({ s: 401, b: err('UNAUTHORIZED', 'Session expired') }) } },
  { nama: 'Mint · kena rate limit 429', url: '/mint', routes: { 'rate': () => ({ s: 429, b: err('RATE_LIMITED', 'Too many requests') }) } },
  { nama: 'Riwayat · jaringan mati', url: '/history', abortAll: true },
  { nama: 'Profil · server error 500', url: '/profile', routes: { 'auth/me': () => ({ s: 500, b: err('INTERNAL_ERROR', 'Internal server error') }) } },
  { nama: 'Redeem · daftar bank gagal', url: '/redeem', routes: { 'bank': () => ({ s: 500, b: err('INTERNAL_ERROR', 'boom') }) } },
];

const PROBE = () => {
  const t = document.body.innerText.replace(/\n{2,}/g, '\n');
  const d = document.querySelector('[role=dialog]');
  return {
    teks: t.slice(0, 1200),
    adaKataError: /(gagal|error|salah|coba lagi|tidak dapat|tidak bisa|terjadi kesalahan)/i.test(t),
    adaTombolCobaLagi: [...document.querySelectorAll('button,a')].some(b => /coba lagi|muat ulang|refresh|retry/i.test(b.textContent || '')),
    skeleton: document.querySelectorAll('.animate-pulse').length,
    spinner: document.querySelectorAll('.animate-spin').length,
    toast: [...document.querySelectorAll('[data-sonner-toast]')].map(x => x.innerText.replace(/\n/g, ' ').slice(0, 120)),
    dialog: d ? { rect: (() => { const r = d.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; })(),
      keluarViewport: d.getBoundingClientRect().bottom > window.innerHeight + 1,
      bisaDiscroll: d.scrollHeight > d.clientHeight + 1, scrollH: d.scrollHeight, clientH: d.clientHeight,
      maxH: getComputedStyle(d).maxHeight } : null,
    docScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  };
};

(async () => {
  const browser = await chromium.launch();
  const hasil = {};
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, locale: 'id-ID', storageState: OUT + '/auth-state.json' });
    await ctx.route('**://api-dev.usdx.co.id/**', async route => {
      const url = route.request().url();
      if (c.abortAll) return route.abort('internetdisconnected');
      if (c.delay && url.includes('/api/v2/' + c.delay.frag)) {
        await new Promise(r => setTimeout(r, c.delay.ms));
        return route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer ' + TOKEN } });
      }
      for (const [frag, fn] of Object.entries(c.routes || {})) {
        if (url.includes('/api/v2/' + frag)) { const { s, b } = fn(); return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) }); }
      }
      return route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer ' + TOKEN } });
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    try {
      await page.goto('http://localhost:3000' + c.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(c.tungguMs || 4500);
      if (c.open) { await c.open(page); await page.waitForTimeout(1500); }
      const m = await page.evaluate(PROBE);
      await page.screenshot({ path: `${OUT}/shots/state-${VP.name}-${c.nama.replace(/[^a-zA-Z0-9]+/g, '-')}.png`, fullPage: true });
      hasil[c.nama] = { ...m, errs };
      log(`\n=== ${c.nama} (${VP.name}) ===`);
      log(`  pesan error tampil? ${m.adaKataError ? 'ya' : '❌ TIDAK'} | tombol coba lagi? ${m.adaTombolCobaLagi ? 'ya' : '❌ tidak'} | skeleton=${m.skeleton} spinner=${m.spinner}`);
      if (m.toast.length) log('  toast:', JSON.stringify(m.toast));
      if (m.dialog) log(`  dialog: ${m.dialog.rect} maxH=${m.dialog.maxH} keluarViewport=${m.dialog.keluarViewport} bisaDiscroll=${m.dialog.bisaDiscroll} (${m.dialog.scrollH}/${m.dialog.clientH})`);
      if (m.docScrollable) log('  ⚠ dokumen ikut bisa di-scroll');
      log('  isi layar:', JSON.stringify(m.teks.split('\n').filter(l => l.trim()).slice(-8)));
      if (errs.length) log('  ⚠ pageError:', JSON.stringify(errs).slice(0, 200));
    } catch (e) {
      log(`\n=== ${c.nama} ===\n  ❌ GAGAL: ${String(e).slice(0, 150)}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/state-audit-${VP.name}.json`, JSON.stringify(hasil, null, 2));
  await browser.close();
})();
