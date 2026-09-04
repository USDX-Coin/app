// Buka tiap modal/dialog/dropdown lalu ukur perilakunya (tutup, Esc, fokus, ukuran, gaya).
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');
const log = (...a) => console.log(...a);
const VP = process.env.VP === 'mobile' ? { name: 'mobile', width: 375, height: 812 } : { name: 'desktop', width: 1440, height: 900 };

const MEASURE = () => {
  const d = document.querySelector('[role=dialog]');
  if (!d) return { ada: false };
  const cs = getComputedStyle(d);
  const r = d.getBoundingClientRect();
  const overlay = [...document.querySelectorAll('div')].find(el => {
    const s = getComputedStyle(el);
    return s.position === 'fixed' && parseFloat(s.zIndex || 0) >= 40 && el.getBoundingClientRect().width >= window.innerWidth - 2 && !el.contains(d);
  });
  const focus = document.activeElement;
  return {
    ada: true,
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    radius: cs.borderRadius, padding: cs.padding, bg: cs.backgroundColor, shadow: cs.boxShadow.slice(0, 40),
    maxH: cs.maxHeight, overflowY: cs.overflowY,
    kontenLebihTinggi: d.scrollHeight > d.clientHeight + 1,
    scrollHeight: d.scrollHeight, clientHeight: d.clientHeight,
    keluarViewport: r.bottom > window.innerHeight + 1 || r.top < -1,
    adaTombolTutup: !!d.querySelector('[aria-label*="lose" i],[aria-label*="utup" i]') || /Close|Tutup/.test(d.innerText),
    fokusDiDialog: focus ? d.contains(focus) : false,
    fokusPada: focus ? focus.tagName.toLowerCase() + (focus.className ? '.' + String(focus.className).split(' ')[0] : '') : null,
    adaOverlay: !!overlay,
    overlayBg: overlay ? getComputedStyle(overlay).backgroundColor : null,
    judul: (d.querySelector('h1,h2,h3,[data-slot=dialog-title]') || {}).textContent || null,
    tombol: [...d.querySelectorAll('button')].map(b => ((b.textContent || '').trim() || b.getAttribute('aria-label') || '(ikon)') + (b.disabled ? '[off]' : '')),
    teks: d.innerText.replace(/\n{2,}/g, '\n').slice(0, 400),
  };
};

const CASES = [
  { nama: 'Mint · Buku Alamat', url: '/mint', open: async p => p.locator('div.bg-muted button').first().click() },
  { nama: 'Mint · Scan QR', url: '/mint', open: async p => p.locator('div.bg-muted button').nth(1).click() },
  { nama: 'Mint · Review', url: '/mint', open: async p => {
      await p.locator('input[placeholder="0"]').first().fill('10');
      await p.locator('div.bg-muted input').last().fill('0x3333335b13F29e208eE1066Fd6cE86Da66958da7');
      await p.waitForTimeout(800);
      await p.getByRole('button', { name: /^Mint$/ }).last().click();
    } },
  { nama: 'Redeem · Rekening tersimpan', url: '/redeem', open: async p => p.getByRole('button', { name: /Rekening tersimpan/i }).click() },
  { nama: 'Profil · Ganti Password', url: '/profile', open: async p => p.getByRole('button', { name: /Ganti Password/i }).click() },
];

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, locale: 'id-ID', storageState: OUT + '/auth-state.json' });
    const TOKEN = fs.readFileSync(OUT + '/token.txt', 'utf8').trim();
    await ctx.route('**://api-dev.usdx.co.id/**', route => route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer ' + TOKEN } }));
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    try {
      await page.goto('http://localhost:3000' + c.url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(2000);
      await c.open(page);
      await page.waitForTimeout(1500);
      const m = await page.evaluate(MEASURE);
      await page.screenshot({ path: `${OUT}/shots/modal-${VP.name}-${c.nama.replace(/[^a-zA-Z0-9]+/g, '-')}.png`, fullPage: false });

      // uji Esc
      let escTutup = null, overlayTutup = null;
      if (m.ada) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
        escTutup = !(await page.locator('[role=dialog]').count());
        if (!escTutup) {
          await page.mouse.click(5, 5);
          await page.waitForTimeout(700);
          overlayTutup = !(await page.locator('[role=dialog]').count());
        }
      }
      results[c.nama] = { ...m, escTutup, overlayTutup, errs };
      log(`\n=== ${c.nama} (${VP.name}) ===`);
      if (!m.ada) { log('  ❌ DIALOG TIDAK TERBUKA'); continue; }
      log(`  judul="${(m.judul || '').trim()}" rect=${m.rect} radius=${m.radius} bg=${m.bg}`);
      log(`  maxH=${m.maxH} overflowY=${m.overflowY} kontenLebihTinggi=${m.kontenLebihTinggi} (${m.scrollHeight}/${m.clientHeight}) keluarViewport=${m.keluarViewport}`);
      log(`  tombolTutup=${m.adaTombolTutup} esc=${escTutup} klikOverlay=${overlayTutup} fokusMasuk=${m.fokusDiDialog} (${m.fokusPada}) overlay=${m.adaOverlay} ${m.overlayBg || ''}`);
      log(`  tombol: ${JSON.stringify(m.tombol)}`);
      if (errs.length) log('  ⚠ error:', JSON.stringify(errs).slice(0, 200));
    } catch (e) {
      log(`\n=== ${c.nama} (${VP.name}) ===\n  ❌ GAGAL: ${String(e).slice(0, 160)}`);
      results[c.nama] = { gagal: String(e).slice(0, 200) };
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/modal-audit-${VP.name}.json`, JSON.stringify(results, null, 2));
  await browser.close();
})();
