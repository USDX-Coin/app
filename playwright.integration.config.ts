import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  timeout: 60000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    // `env` di sini MENGUNCI dua variabel yang menentukan ke mana suite ini bicara.
    // Bukan kerapian: sebelum dikunci, `next build` ikut membaca `.env.local`
    // pengembang, dan berkas itu gitignored — jadi CI (yang tidak punya `.env.local`,
    // sehingga `apiBaseUrl === ""` dan `env.useMock` jatuh ke `true`) hijau sementara
    // mesin lokal merah, dengan gejala yang sama sekali tidak menunjuk penyebabnya.
    //
    // Gejalanya begini: `.env.local` yang menyetel `NEXT_PUBLIC_API_BASE_URL`
    // membalik `env.useMock` jadi `false`, jadi build tes memanggil backend dev yang
    // SUNGGUHAN. Semua spec menyemai token `"mock-token"` lewat `loginViaStorage`;
    // backend sungguhan menjawabnya **401**; `ApiClientBridge` melempar ke
    // `/login?sesi=habis`. Yang terlihat di laporan cuma "heading 'Identity
    // Verification' tidak ditemukan, timeout 15 dtk" pada helper `gotoKyc`, dan spec
    // mana yang kena bergantung balapan dengan latensi jaringan — jadi ia tampak
    // seperti flake acak atau selector basi, bukan seperti salah konfigurasi.
    // Terdiagnosis 5 September 2026; gejala yang sama pernah muncul di
    // `kyc-gate.spec.ts` sehari sebelumnya dan waktu itu salah disimpulkan sebagai
    // artefak build.
    //
    // Setiap spec di `tests/integration` memang ditulis untuk mock — headernya
    // menuliskannya ("Runs against the mock backend via the existing localStorage
    // seams"), dan seam `usdx-mock-*` hanya dibaca `mock-api.ts`. Jadi mock bukan
    // penyederhanaan, ia kontrak suite ini.
    env: {
      NEXT_PUBLIC_USE_MOCK: "true",
      // `.env.local` untuk audit UI menunjuk checkout ke `http://localhost:3001`;
      // spec handoff mint→checkout mengasumsikan domain prod.
      NEXT_PUBLIC_CHECKOUT_URL: "https://mint.usdx.co.id",
    },
    // JANGAN pakai ulang server yang kebetulan sudah hidup di :3000. Ia biasanya
    // `next dev` milik sesi lain, dibangun dengan env yang berbeda, dan `env` di atas
    // TIDAK berlaku untuk proses yang tidak kita jalankan sendiri — jadi `reuse` yang
    // menyala diam-diam membatalkan penguncian barusan. Ini lubang kedua dari
    // kesalahan diagnosis yang sama (`kyc-gate.spec.ts`, 4 September: "rebuild
    // mendarat di bawah next start").
    //
    // Dengan `false`, port yang terpakai membuat Playwright berhenti dan MENGATAKANNYA,
    // bukan diam-diam menguji build yang salah. Harganya satu `pnpm build` per
    // jalannya di lokal; itu harga yang benar untuk suite yang tugasnya membuktikan
    // sesuatu.
    reuseExistingServer: false,
    timeout: 180000,
  },
});
