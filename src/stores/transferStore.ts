import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TransferAccepted } from "@/types";
import { uuidv7 } from "@/lib/uuid";

// Transfer custodial (USDX-567, wallet.yaml § POST /api/v2/wallet/transfer).
// Dua tampilan: `form` (tujuan + jumlah, Ringkasan sebagai modal, lalu dialog
// PIN) dan `done` (tracker konfirmasi, USDX-701). 202 adalah bukti BROADCAST;
// `done` memantau GET /api/v2/wallet/transfers/{result.id} sampai final — store
// hanya memegang satu `result`, jadi replay 200 (id sama) tetap satu tracker.
//
// `idempotencyKey` adalah bagian kontrak, bukan detail teknis: satu key = satu
// NIAT transfer. Dibuat sekali saat user pertama kali mengonfirmasi, dipakai
// ulang oleh setiap retry (salah PIN, 409 IN_PROGRESS, 503, jaringan putus) —
// karena yang pertama bisa saja sudah ter-broadcast — dan DIBUANG hanya ketika
// user sengaja mengubah tujuan/jumlah (niat baru). Karena itu `setTo`/`setAmount`
// yang menghapusnya, bukan pemanggil.
//
// Niat itu DI-PERSIST ke sessionStorage (`usdx-transfer-intent`: hanya `to`,
// `amount`, `idempotencyKey`). Kasus yang dilindungi kontrak adalah "koneksi
// putus setelah broadcast tapi sebelum respons sampai" — dan reload halaman di
// tengah permintaan adalah bentuk paling umum dari kasus itu. Tanpa persist,
// user yang memuat ulang lalu mengetik tujuan + jumlah yang sama akan mendapat
// key BARU = transfer kedua. sessionStorage, bukan localStorage: niat mati
// bersama tab, tidak ikut ke sesi lain. Tampilan (`step`, `result`, modal) tidak
// ikut — transfer yang sudah terkirim tetap bisa ditemukan di riwayat
// (/history tab Keluar, USDX-701 → USDX-713).
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

export const useTransferStore = create<TransferState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: "usdx-transfer-intent",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        to: state.to,
        amount: state.amount,
        idempotencyKey: state.idempotencyKey,
      }),
    },
  ),
);
