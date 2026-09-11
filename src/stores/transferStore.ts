import { create } from "zustand";
import type { TransferAccepted } from "@/types";
import { uuidv7 } from "@/lib/uuid";

// Transfer custodial (USDX-567, wallet.yaml § POST /api/v2/wallet/transfer).
// Dua tampilan: `form` (tujuan + jumlah, Ringkasan sebagai modal, lalu dialog
// PIN) dan `done` (tx hash + tautan explorer). Tidak ada tracker: 202 adalah
// bukti BROADCAST dan belum ada endpoint pemantau konfirmasi (USDX-577).
//
// `idempotencyKey` adalah bagian kontrak, bukan detail teknis: satu key = satu
// NIAT transfer. Dibuat sekali saat user pertama kali mengonfirmasi, dipakai
// ulang oleh setiap retry (salah PIN, 409 IN_PROGRESS, 503, jaringan putus) —
// karena yang pertama bisa saja sudah ter-broadcast — dan DIBUANG hanya ketika
// user sengaja mengubah tujuan/jumlah (niat baru). Karena itu `setTo`/`setAmount`
// yang menghapusnya, bukan pemanggil.
export type TransferStep = "form" | "done";

interface TransferState {
  step: TransferStep;
  to: string;
  amount: string;
  reviewOpen: boolean;
  pinOpen: boolean;
  idempotencyKey: string | null;
  result: TransferAccepted | null;
  setTo: (to: string) => void;
  setAmount: (amount: string) => void;
  setReviewOpen: (open: boolean) => void;
  setPinOpen: (open: boolean) => void;
  /** Key untuk niat transfer saat ini — dibuat kalau belum ada, dipakai ulang kalau ada. */
  ensureIdempotencyKey: () => string;
  /** Hanya untuk 409 IDEMPOTENCY_KEY_REUSED (bug FE): key dianggap rusak. */
  clearIdempotencyKey: () => void;
  /** Broadcast diterima → tampilan hasil; modal & dialog ditutup; niat selesai. */
  setResult: (result: TransferAccepted) => void;
  reset: () => void;
}

const initialState = {
  step: "form" as TransferStep,
  to: "",
  amount: "",
  reviewOpen: false,
  pinOpen: false,
  idempotencyKey: null as string | null,
  result: null as TransferAccepted | null,
};

export const useTransferStore = create<TransferState>()((set, get) => ({
  ...initialState,
  setTo: (to) => set((s) => ({ to, idempotencyKey: to === s.to ? s.idempotencyKey : null })),
  setAmount: (amount) =>
    set((s) => ({ amount, idempotencyKey: amount === s.amount ? s.idempotencyKey : null })),
  setReviewOpen: (reviewOpen) => set({ reviewOpen }),
  setPinOpen: (pinOpen) => set({ pinOpen }),
  ensureIdempotencyKey: () => {
    const existing = get().idempotencyKey;
    if (existing) return existing;
    const key = uuidv7();
    set({ idempotencyKey: key });
    return key;
  },
  clearIdempotencyKey: () => set({ idempotencyKey: null }),
  setResult: (result) =>
    set({ result, step: "done", reviewOpen: false, pinOpen: false, idempotencyKey: null }),
  reset: () => set(initialState),
}));
