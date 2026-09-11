// UUID v7 (RFC 9562) untuk header `Idempotency-Key` transfer custodial
// (wallet.yaml § POST /api/v2/wallet/transfer: "UUID v7 yang dibuat FE, satu per
// niat transfer"). Bit 0–47 = milidetik Unix, lalu versi 7, 74 bit acak, varian
// RFC. Backend hanya memaksa `format: uuid`; v7 dipilih supaya kunci terurut
// waktu di log dan tidak pernah bertabrakan dengan kunci sesi sebelumnya.
//
// `crypto.getRandomValues` ada di semua browser target dan di Node ≥ 19 (Vitest).
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-bit timestamp, big-endian.
  const ts = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & BigInt(0xff));
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versi 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // varian RFC (10xx)

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
