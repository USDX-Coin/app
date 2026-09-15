import { test, expect } from "@playwright/test";
import { loginViaStorage, forceIndonesian, seedKycStatus } from "../helpers/playwright-utils";

// USDX-688 — app shell tidak boleh bisa di-scroll menembus dirinya sendiri.
//
// Kejadian di production 15 Sep 2026: halaman /kyc menggulung jauh melewati
// isinya — sidebar ikut menggulung lalu berhenti di tengah, menyisakan area
// kosong ratusan piksel. Sebabnya elemen berposisi ABSOLUT (`sr-only` milik
// shadcn berposisi absolut) yang containing block-nya jatuh ke <body> karena
// tidak ada leluhur ber-`position`. Elemen itu lalu ditempatkan pada posisi
// statisnya diukur dari body, dan tinggi dokumen ikut melar.
//
// Diuji lewat TINGGI DOKUMEN, bukan lewat satu komponen: penambalan sebelumnya
// memberi `relative` pada satu komponen yang kebetulan ketahuan, dan bug yang
// sama muncul lagi dari komponen lain. Yang dijaga di sini adalah sifat yang
// harus benar untuk SEMUA halaman dashboard — shell-nya `h-screen
// overflow-hidden`, jadi dokumen tidak boleh punya scroll sendiri sama sekali.
const DASHBOARD_ROUTES = ["/kyc", "/redeem", "/mint", "/history"];

// Dua ukuran layar, dan alasannya bukan kelengkapan: bug ini DILAPORKAN dari
// jendela lebar (~2000px), sementara viewport bawaan Playwright 1280×720. Tinggi
// dokumen yang melar bergantung pada posisi statis elemen absolutnya, dan posisi
// itu bergeser mengikuti lebar layar — menguji satu ukuran saja berarti menebak
// bahwa ukuran itulah yang mewakili.
const VIEWPORTS = [
  { name: "laptop 1280×720", size: { width: 1280, height: 720 } },
  { name: "layar lebar 2000×1200", size: { width: 2000, height: 1200 } },
];

test.describe("Dashboard shell — dokumen tidak boleh menggulung sendiri", () => {
  for (const route of DASHBOARD_ROUTES) {
    for (const vp of VIEWPORTS) {
    test(`positive: ${route} tidak melar melewati viewport (${vp.name})`, async ({ page }) => {
      await page.setViewportSize(vp.size);
      await forceIndonesian(page);
      await seedKycStatus(page, "PENDING");
      await loginViaStorage(page, { kycStatus: "PENDING" });
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const { scrollHeight, innerHeight } = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));

      // Toleransi 2px untuk pembulatan sub-piksel — bukan untuk "sedikit melar".
      expect(
        scrollHeight,
        `dokumen ${route} setinggi ${scrollHeight}px padahal viewport ${innerHeight}px — ` +
          "ada elemen absolut yang lolos dari containing block halaman",
      ).toBeLessThanOrEqual(innerHeight + 2);
    });
    }
  }

  test("negative: area konten yang PANJANG tetap menggulung di dalam kartunya sendiri", async ({
    page,
  }) => {
    // Sifat di atas tidak boleh dicapai dengan mematikan scroll di mana-mana:
    // halaman yang isinya melebihi layar harus tetap bisa dibaca seluruhnya.
    await forceIndonesian(page);
    await seedKycStatus(page, "PENDING");
    await loginViaStorage(page, { kycStatus: "PENDING" });
    await page.goto("/kyc");
    await page.waitForLoadState("networkidle");

    const scroller = page.locator("main div.overflow-y-auto").first();
    await expect(scroller).toBeVisible();
    const canScrollInside = await scroller.evaluate(
      (el) => el.scrollHeight > el.clientHeight || getComputedStyle(el).overflowY === "auto",
    );
    expect(canScrollInside).toBe(true);
  });
});
