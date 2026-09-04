# Audit UI — alat ukur, bukan test

Beda dari `tests/e2e` dan `tests/integration`: yang di sini **tidak punya assertion** dan
tidak lulus/gagal sendiri. Mereka **mengukur** halaman lalu menulis angka ke JSON —
tinggi dokumen, kotak batas tiap elemen, rasio kontras, ukuran target sentuh, indikator
fokus. Karena itu dijalankan lewat `node`, bukan runner Playwright.

Kenapa ini ada: bug yang membuka audit September 2026 lolos dari mata dan dari test.
Yang menangkapnya angka — `scrollHeight 1962` melawan `clientHeight 900` — lalu terlacak
ke `offsetParent = body` pada dua input `sr-only` yang lepas dari wadah `relative`.

## Menjalankan

```bash
pnpm dev                 # app di :3000
pnpm audit:ui            # login → sapuan → state → a11y → modal
```

Keluaran masuk ke `tests/audit-ui/keluaran/` (diabaikan git — berisi token sesi dan
screenshot). Arahkan ke tempat lain dengan `AUDIT_OUT`, misalnya untuk membandingkan
sebelum dan sesudah sebuah PR:

```bash
AUDIT_OUT=/tmp/sebelum pnpm audit:ui
# ...terapkan perubahan...
AUDIT_OUT=/tmp/sesudah pnpm audit:ui
```

Batasi cakupan lewat env: `VPS=desktop,mobile` dan `ROUTES=/mint,/history`.

## Isi

| Skrip | Mengukur | Masuk `audit:ui` |
|---|---|---|
| `login.js` | Ambil token sesi → `keluaran/token.txt`; prasyarat sisanya | ya, pertama |
| `sweep-auth.js` | Semua halaman ber-auth × 4 viewport: overflow, elemen keluar batas | ya |
| `state-audit.js` | Kosong, 500, 401, 429, offline, loading lambat | ya |
| `a11y-audit.js` | Fokus keyboard, target sentuh, kontras WCAG | ya |
| `modal-audit.js` | Perilaku semua dialog: max-height, scroll, fokus | ya |
| `sweep.js` | Halaman publik (tanpa login) | manual |
| `checkout-states.js` | 8 kondisi order + 3 error di `:3001` | manual — butuh order nyata |
| `kyc-states.js` | Lima status KYC | manual — butuh akun per status |

Dua yang terakhir tidak masuk `audit:ui` karena butuh data yang disiapkan lebih dulu;
menjalankannya tanpa itu menghasilkan angka yang menyesatkan, bukan kegagalan yang jujur.

Token sesi disuntik lewat interceptor `ctx.route`, bukan cookie, karena cookie sesi
backend tidak berlaku lintas-site di localhost.

## Syarat lulus

Nol dokumen yang ikut ter-scroll · nol elemen keluar batas · nol field tanpa indikator
fokus · nol kegagalan server yang tampil sebagai empty state · seluruh teks lolos kontras
AA di kedua tema.

Sebelas skrip diagnosa sekali-pakai (mis. pembedah tabrakan breakpoint tabel, pemburu
`absolute` yang lepas dari wadah) sengaja **tidak** ikut ke repo — mereka menjawab satu
pertanyaan lalu selesai. Arsipnya di `catatan/audit-ui-2026-09-03/harness/`.
