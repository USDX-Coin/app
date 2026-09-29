// ── Kode yang diterima mock 2FA (USDX-714) ───────────────────────────────────
// Dipakai mock-two-factor (unit) DAN spec Playwright — karena itu file ini tidak
// mengimpor apa pun: suite Playwright mengimpornya lewat path relatif tanpa
// menarik klien API / env Next (pola mock-wallet-transfer-fixtures).

/** Kode authenticator yang "sedang tampil" di aplikasi. */
export const MOCK_TOTP_CODE = "246810";
/** OTP di email pemulihan. */
export const MOCK_RECOVERY_OTP = "135790";
/** Set backup code bawaan (sekali pakai). */
export const MOCK_BACKUP_CODES = [
  "K7QM2-X8WP4",
  "R3TN9-B2LC6",
  "H5VD1-Q9ZK3",
  "M8PX4-T6GJ2",
  "W2CF7-N4YR8",
  "D9LS3-J1HB5",
  "F6ZA8-C3MV7",
  "P4GE2-V7XQ1",
  "Y1BK6-S5DT9",
  "U3HW5-L8NA2",
];
/** Secret di otpauth:// — yang tampil sebagai "kunci manual". */
export const MOCK_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
