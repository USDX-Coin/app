// Tafsir status transfer custodial (wallet.yaml § WalletTransferStatus +
// WalletTransfer.failureReason, USDX-701). Satu-satunya tempat FE membaca
// `status` / `failureReason` mentah dari API.
//
// Aturan kontraknya:
//   - Enum boleh bertambah → nilai `status` tak dikenal diperlakukan PENDING
//     (cabang default). Artinya layar tetap "menunggu konfirmasi" + tautan
//     explorer dan tracker terus memantau — bukan tebakan berhasil/gagal.
//   - CONFIRMED dan FAILED final: tidak pernah berubah lagi, polling berhenti.
//   - `failureReason` hanya bermakna saat FAILED. Nilai yang tidak dikenal TIDAK
//     membatalkan FAILED (FAILED sudah pasti "USDX tidak berpindah" menurut
//     kontrak, apa pun sebabnya); ia hanya tidak punya label teknis → null.
//   - Umur transfer TIDAK PERNAH dipakai di sini: PENDING lama tetap PENDING.

import type {
  WalletTransfer,
  WalletTransferFailureReason,
  WalletTransferStatus,
} from "@/types";

const KNOWN_STATUSES: readonly WalletTransferStatus[] = ["PENDING", "CONFIRMED", "FAILED"];
const KNOWN_REASONS: readonly WalletTransferFailureReason[] = ["REVERTED", "DROPPED"];

export function transferStatusOf(transfer: Pick<WalletTransfer, "status">): WalletTransferStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(transfer.status)
    ? (transfer.status as WalletTransferStatus)
    : "PENDING";
}

export function transferFailureReasonOf(
  transfer: Pick<WalletTransfer, "status" | "failureReason">,
): WalletTransferFailureReason | null {
  if (transferStatusOf(transfer) !== "FAILED") return null;
  const reason = transfer.failureReason;
  return reason && (KNOWN_REASONS as readonly string[]).includes(reason)
    ? (reason as WalletTransferFailureReason)
    : null;
}

export function isFinalTransferStatus(status: WalletTransferStatus): boolean {
  return status === "CONFIRMED" || status === "FAILED";
}
