import { redirect } from "next/navigation";
import { OUTGOING_HISTORY_HREF } from "@/lib/history-item";

// /send/history (daftar, USDX-701) digantikan /history tab Keluar (custodial-wallet.md
// §5.7, USDX-713). Route tetap ada supaya tautan/bookmark lama tidak 404; detail
// /send/history/[id] tidak terpengaruh.
export default function TransferHistoryPage() {
  redirect(OUTGOING_HISTORY_HREF);
}
