import { describe, test, expect } from "vitest";
import nextConfig from "../../next.config";

// ─────────────────────────────────────────────────────────────────────────────
// Header keamanan hidup di `next.config.ts` dan TIDAK ADA YANG MENJAGANYA
// sampai berkas ini lahir — itulah yang membuat test ini perlu.
//
// Sebelum pindah ke server sendiri, nilai-nilai ini juga ada di `netlify.toml`.
// Netlify-nya dibuang (app sudah di-host sendiri), jadi `next.config.ts` kini
// SATU-SATUNYA tempat header ini hidup.
//
// Bukan kekhawatiran teoretis: `desk.usdx.co.id` (back-office, SPA statis) sudah
// KEHILANGAN keempat header ini di produksi dengan cara persis begitu — headernya
// dulu datang dari `netlify.toml`, host-nya pindah, dan tidak ada yang menyadari
// karena tidak ada satu pun test yang memeriksanya. Diverifikasi 21 Sep 2026:
//
//   curl -sSIL https://desk.usdx.co.id/login   → nol header keamanan
//   curl -sSIL https://app.usdx.co.id/         → keempatnya ada
//
// Yang membedakan kedua host itu cuma satu: `app` adalah Next.js, jadi headernya
// ikut ke mana pun ia di-host. Test ini yang menjaga supaya tetap begitu.
//
// Nilainya dari USDX-362 / USDX-380 (residual pentest WSTG-CLNT-09/14) — kalau
// mau berubah, ubah tiketnya dulu, jangan berkasnya duluan.
// ─────────────────────────────────────────────────────────────────────────────

const WAJIB = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none';",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

async function headerUntuk(source: string) {
  const aturan = await nextConfig.headers!();
  const cocok = aturan.filter((r) => r.source === source);
  return new Map(cocok.flatMap((r) => r.headers.map((h) => [h.key, h.value] as const)));
}

describe("security headers (next.config.ts)", () => {
  describe("positive", () => {
    test.each(Object.entries(WAJIB))("mengirim %s dengan nilai dari USDX-362", async (key, value) => {
      expect((await headerUntuk("/(.*)")).get(key)).toBe(value);
    });

    test("dipasang untuk SELURUH path, bukan sebagian", async () => {
      // `/(.*)` mencakup semuanya. Aturan yang mempersempitnya (mis. hanya `/login`)
      // meninggalkan halaman lain tanpa proteksi — dan halaman lain itulah yang
      // memegang saldo, alamat dompet, dan alur mint.
      const aturan = await nextConfig.headers!();
      const sumber = aturan.map((r) => r.source);
      expect(sumber).toContain("/(.*)");
    });
  });

  describe("negative", () => {
    test("CSP-nya TIDAK boleh membatasi apa pun selain framing", async () => {
      // Menambah `script-src`/`connect-src` di sini akan mematikan wagmi/rainbowkit
      // (WalletConnect relay, RPC) dalam diam — halaman render, dompet tidak connect.
      // Anti-clickjacking tidak butuh direktif lain, jadi kalau CSP-nya tumbuh, itu
      // keputusan terpisah yang harus ditulis sadar, bukan efek samping.
      const csp = (await headerUntuk("/(.*)")).get("Content-Security-Policy");
      expect(csp).toBe("frame-ancestors 'none';");
      expect(csp).not.toMatch(/script-src|connect-src|default-src|img-src/);
    });

    test("frame-ancestors-nya bukan 'self' atau daftar izin", async () => {
      // `app` aplikasi top-level dan tidak pernah di-iframe. `'self'` masih
      // mengizinkan framing dari origin sendiri, yang cukup untuk sebagian
      // serangan clickjacking berbasis path.
      const csp = (await headerUntuk("/(.*)")).get("Content-Security-Policy") ?? "";
      expect(csp).not.toMatch(/frame-ancestors\s+'self'/);
      expect(csp).not.toMatch(/frame-ancestors\s+https?:/);
    });
  });

  describe("edge cases", () => {
    test("`headers()` memang ada — bukan hanya nilainya yang benar", async () => {
      // Menghapus seluruh `async headers()` adalah cara paling mudah kehilangan
      // keempatnya sekaligus, dan itu tidak akan menggagalkan satu pun test yang
      // cuma memeriksa isi konstanta.
      expect(typeof nextConfig.headers).toBe("function");
      expect((await nextConfig.headers!()).length).toBeGreaterThan(0);
    });

    test("tidak ada header wajib yang dikirim dua kali dengan nilai berbeda", async () => {
      const aturan = await nextConfig.headers!();
      const semua = aturan.flatMap((r) => r.headers);
      for (const key of Object.keys(WAJIB)) {
        const nilai = new Set(semua.filter((h) => h.key === key).map((h) => h.value));
        expect(nilai.size).toBeLessThanOrEqual(1);
      }
    });
  });
});
