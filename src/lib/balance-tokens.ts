// Aturan "token mana yang dibaca surface mana" — USDX-640, diperluas untuk redeem.
//
// Hidup di modul NETRAL, bukan di `hooks/useWalletBalance` maupun `lib/redeem/wallet`,
// karena keduanya membutuhkannya dan `useWalletBalance` sudah mengimpor `useUsdxBalance`
// dari `lib/redeem/wallet`. Menaruh aturannya di salah satu dari keduanya berarti impor
// melingkar; menyalinnya ke dua tempat berarti dua aturan yang suatu hari berbeda — dan
// bedanya muncul sebagai nasabah yang ditolak memakai token yang benar-benar ia punya.
import { USDX_CONTRACT_ADDRESS } from "@/lib/constants";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export interface BalanceTokens {
  /** Token the main balance reads. Always the production one. */
  main: `0x${string}`;
  /** Token for the test-mint strip, or null when no strip should appear. */
  test: `0x${string}` | null;
  /**
   * Token yang akan BENAR-BENAR DIBAKAR kalau redeem dibuat sekarang — token uji
   * selama mode uji, token produksi selain itu.
   *
   * Ini konsep KETIGA dan bukan salah satu dari dua di atas, karena pertanyaannya
   * memang berbeda. `main` menjawab "berapa USDX milik orang ini" dan sengaja
   * tidak pernah ikut bergeser (USDX-640). `redeem` menjawab "token mana yang
   * akan hilang dari dompetnya", dan itu ditentukan mode — persis aturan yang
   * dipakai backend saat men-snapshot `contract_address` ke baris order.
   */
  redeem: `0x${string}`;
}

/**
 * Which token each balance surface reads, given what the config returned.
 *
 * Exported and pure because this is the whole safety rule of USDX-640, and it is
 * worth being able to state it without a wallet:
 *
 *   main — `contractAddress`, in EVERY mode. It always denotes the production
 *     token; the backend never swaps it for the test one. The build-time env
 *     address is only a fallback for "the config has not arrived yet", which is
 *     the point of the ticket: stop trusting an address baked into a bundle.
 *   test — `testContractAddress`, and only while the mode says TEST. A holder of
 *     real USDX must never be shown 0 because ops flipped a switch, so this
 *     address is never allowed near the main balance.
 *   redeem — token yang akan dibakar: `test` kalau ada, kalau tidak `main`.
 *     Dipisah dari `main` karena selama mode uji keduanya BEDA, dan memakai
 *     `main` untuk memagari redeem berarti memagarinya dengan saldo token yang
 *     bukan token yang dibakar — pagar yang menolak nasabah yang sebenarnya
 *     punya cukup token, sambil meloloskan yang tidak punya.
 *
 * Both conditions are required for the strip on purpose. The field is documented
 * as non-null only in TEST, but a strip appearing on a production session would
 * be the exact failure this hook exists to prevent, so the mode is checked too
 * rather than trusted implicitly.
 */
export function resolveBalanceTokens(
  configAddress: string | null,
  testConfigAddress: string | null | undefined,
  mintMode: "PROD" | "TEST",
  envAddress: `0x${string}` = USDX_CONTRACT_ADDRESS,
): BalanceTokens {
  const asAddress = (value: string | null | undefined) =>
    value && EVM_ADDRESS.test(value) ? (value as `0x${string}`) : null;

  const main = asAddress(configAddress) ?? envAddress;
  const test = mintMode === "TEST" ? asAddress(testConfigAddress) : null;
  // `test ?? main`, bukan cabang atas mode lagi: satu sumber, jadi tidak mungkin
  // ada keadaan "mode TEST tapi alamat ujinya tidak terbaca" yang membuat redeem
  // memagari dengan token uji yang tidak ada sementara strip-nya sendiri hilang.
  return { main, test, redeem: test ?? main };
}
