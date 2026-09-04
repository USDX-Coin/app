const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || (__dirname + '/keluaran');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID' });
  const page = await ctx.newPage();
  let loginBody = null;
  page.on('response', async r => {
    if (r.url().includes('/auth/login')) { try { loginBody = await r.json(); } catch {} }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('#email', process.env.EMAIL);
  await page.fill('#password', process.env.PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/mint', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log('URL sesudah login:', page.url());
  console.log('bentuk respons login:', JSON.stringify(loginBody, (k, v) =>
    (k === 'accessToken' || k === 'sessionId' || k === 'token') && typeof v === 'string' ? v.slice(0, 12) + '…(' + v.length + ' char)' : v, 2).slice(0, 900));

  const token = loginBody?.data?.accessToken || loginBody?.accessToken || loginBody?.data?.token || loginBody?.token;
  if (token) {
    fs.writeFileSync(OUT + '/token.txt', token);
    console.log('TOKEN tersimpan (panjang ' + token.length + ')');
  } else {
    console.log('TOKEN TIDAK KETEMU di respons login');
  }
  await ctx.storageState({ path: OUT + '/auth-state.json' });
  await browser.close();
})();
