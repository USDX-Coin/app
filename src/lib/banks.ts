// Indonesian bank list for the redeem payout dropdown (USDX-243). `code` is the
// 3-digit Bank Indonesia sandi bank sent as `bankCode` in POST /v2/redeem.
//
// W3 `bankCode` is a free string (redeem.yaml) — there's no /api/v2/banks
// endpoint yet (week3.md § Open Questions #5). This is a curated FE list so the
// form offers a "Bank (pilih)" dropdown instead of free text; when the provider
// goes live the enumeration may move to the backend.

export interface Bank {
  code: string;
  name: string;
}

export const BANKS: Bank[] = [
  { code: "014", name: "BCA" },
  { code: "008", name: "Mandiri" },
  { code: "009", name: "BNI" },
  { code: "002", name: "BRI" },
  { code: "451", name: "Bank Syariah Indonesia (BSI)" },
  { code: "013", name: "Permata" },
  { code: "022", name: "CIMB Niaga" },
  { code: "011", name: "Danamon" },
  { code: "016", name: "Maybank Indonesia" },
  { code: "200", name: "BTN" },
  { code: "426", name: "Bank Mega" },
  { code: "213", name: "BTPN / Jenius" },
];

const BANK_MAP = new Map(BANKS.map((b) => [b.code, b]));

export function getBankByCode(code: string): Bank | undefined {
  return BANK_MAP.get(code);
}

// Resolve a bankCode → display name, falling back to the raw code when unknown
// (un-mask 2026-06-25, USDX-270 — mirrors the backend static-reference resolve so
// the UI shows "BCA", not "014").
export function getBankName(code: string): string {
  return BANK_MAP.get(code)?.name ?? code;
}
