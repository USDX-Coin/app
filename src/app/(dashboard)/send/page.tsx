import { TransferPageContent } from "@/components/transfer/TransferPageContent";

// /send — transfer USDX dari wallet custodial (USDX-567). User tanpa wallet
// custodial tetap mendapat ComingSoon (kirim dari wallet eksternal belum ada
// backend-nya); pemilihannya ada di TransferPageContent, dari profil user.
export default function SendPage() {
  return <TransferPageContent />;
}
