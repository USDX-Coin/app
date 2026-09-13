import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { RedeemStatus } from "@/components/redeem/RedeemStatus";
import { useRedeemStore } from "@/stores/redeemStore";
import type { RedeemOrderDetail } from "@/types";

// Layar pra-burn (USDX-661) diuji di sini, bukan lewat fungsi murni, karena dua
// klaimnya hidup di komponen dan tidak bisa dibuktikan di luarnya:
//
//   1. USDX-672 — kalimat asal nama pemilik. "Jawaban bank atas nomor rekening ini"
//      hanya boleh tampil kalau order menyatakan `bankAccountNameVerified: true`;
//      `false` DAN field yang belum dikirim backend sama-sama jatuh ke kalimat tanpa
//      klaim asal-usul — sementara namanya tetap tampil dan persetujuannya tetap
//      diminta.
//   2. USDX-661 — persetujuan disimpan sebagai ID ORDER, bukan boolean, supaya order
//      lain yang dibuka di komponen yang sama tidak mewarisi persetujuan order
//      sebelumnya. Itu klaim andalan PR-nya dan satu-satunya cara membuktikannya
//      adalah menukar order di bawah komponen yang sama (jalur resume dari /history
//      memang memakai instance yang sama).

const WALLET = "0xC0FFEE0000000000000000000000000000C0FFEE";

// Order yang dikembalikan tracker. Mutable: menukar isinya lalu `rerender` adalah
// tepat apa yang terjadi saat nasabah membuka order lain di layar yang sama.
let tracked: RedeemOrderDetail;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Tracker-nya react-query + fetch; di sini datanya yang diuji, bukan pollingnya.
vi.mock("@/hooks/useRedeemTracker", () => ({
  useRedeemTracker: () => ({ data: tracked, isLoading: false }),
}));

// Tidak ada WagmiProvider di jsdom. Wallet dibuat "siap burn" dan cocok dengan
// order, supaya yang menggerbangi tombol burn tinggal persetujuan tujuan.
vi.mock("@/lib/redeem/wallet", () => ({
  useRedeemPreconditions: () => ({
    isConnected: true,
    address: WALLET,
    connect: () => {},
    chainOk: true,
    switchNetwork: () => {},
    isSwitchingNetwork: false,
    balanceUsdx: 1_000_000,
    insufficientBalance: false,
    lowGasWarning: false,
    canBurn: true,
  }),
}));

const runBurn = vi.fn();
vi.mock("@/hooks/useRedeemBurn", () => ({
  useRedeemBurn: () => ({ runBurn, burnState: "idle", burnErrorKey: null }),
}));

function order(overrides: Partial<RedeemOrderDetail> = {}): RedeemOrderDetail {
  return {
    id: "order-a",
    orderNumber: "RDM-A",
    customerName: "Demo User",
    type: "REDEEM",
    chain: "polygon",
    userAddress: WALLET,
    burnMode: "SELF_SIGN",
    contractAddress: "0x0000000000000000000000000000000000000001",
    redeemId: "0x" + "ab".repeat(32),
    inputCurrency: "USD",
    amount: "100",
    amountWei: "100000000",
    baseRate: "16000.00",
    spreadSellPct: "2.0",
    effectiveRate: "15680.00",
    grossIdr: "1568000.00",
    redeemFeePct: "1.0",
    redeemFeeIdr: "15680.00",
    disbursementFeeIdr: "5000.00",
    totalFeeIdr: "20680.00",
    netPayoutIdr: "1547320.00",
    bankCode: "014",
    bankName: "BCA",
    bankAccountNumber: "1234563210",
    bankAccountName: "SITI AMINAH",
    bankAccountNameVerified: true,
    status: "AWAITING_BURN",
    lateBurn: false,
    staleBurn: false,
    payoutProvider: "MOCK",
    payoutRef: null,
    burnTxHash: null,
    burnSubmittedAt: null,
    burnedAt: null,
    payoutCompletedAt: null,
    expiresAt: new Date(Date.now() + 25 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderTracker(initial: RedeemOrderDetail) {
  tracked = initial;
  return render(
    <LanguageProvider>
      <RedeemStatus />
    </LanguageProvider>,
  );
}

const nameNote = () => screen.getByTestId("redeem-destination-name-note").textContent;
const burnButton = () => screen.getByRole("button", { name: "Burn USDX" });

beforeEach(() => {
  cleanup();
  runBurn.mockClear();
  useRedeemStore.getState().reset();
});

describe("RedeemStatus — pre-burn destination block", () => {
  describe("positive", () => {
    test('verified name gets the "the bank answered this" caption', () => {
      renderTracker(order({ bankAccountNameVerified: true }));
      expect(screen.getByTestId("redeem-destination-name")).toHaveTextContent("SITI AMINAH");
      expect(nameNote()).toBe("Jawaban bank atas nomor rekening ini.");
    });
  });

  describe("negative", () => {
    test("unverified name is still shown, but the caption claims no provenance", () => {
      // Jalur provider MOCK: nama di response order justru ketikan nasabah sendiri.
      renderTracker(
        order({ bankAccountName: "BUDI SANTOSO", bankAccountNameVerified: false }),
      );
      expect(screen.getByTestId("redeem-destination-name")).toHaveTextContent("BUDI SANTOSO");
      expect(nameNote()).toBe(
        "Nama ini belum dikonfirmasi bank — periksa sendiri dengan teliti sebelum menyetujui.",
      );
      expect(nameNote()).not.toMatch(/[Jj]awaban bank/);
    });

    test("a missing field is read like false — backend has not merged yet", () => {
      const withoutTheField = order();
      delete withoutTheField.bankAccountNameVerified;
      renderTracker(withoutTheField);
      expect(nameNote()).not.toMatch(/[Jj]awaban bank/);
      expect(nameNote()).toMatch(/belum dikonfirmasi bank/);
    });

    test("the gate does not weaken when the name is unverified", () => {
      renderTracker(order({ bankAccountNameVerified: false }));
      // Blok persetujuannya tetap hadir, tombol burn tetap mati sampai dicentang,
      // dan tidak ada langkah tambahan yang muncul.
      expect(screen.getByTestId("redeem-confirm-destination")).toBeInTheDocument();
      expect(burnButton()).toBeDisabled();
      fireEvent.click(screen.getByRole("checkbox"));
      expect(burnButton()).toBeEnabled();
      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    test('no name at all → "—" and the bank-did-not-answer caption', () => {
      renderTracker(order({ bankAccountName: "", bankAccountNameVerified: true }));
      expect(screen.getByTestId("redeem-destination-name")).toHaveTextContent("—");
      expect(nameNote()).toBe("Bank tidak mengembalikan nama pemilik untuk rekening ini.");
      expect(burnButton()).toBeDisabled();
    });
  });
});

// Klaim andalan USDX-661: persetujuan itu milik SATU order. Layar yang sama dipakai
// ulang oleh jalur resume dari /history, jadi kalau persetujuannya sebuah boolean,
// order kedua akan terbuka dengan tombol burn yang sudah hidup — sebuah burn ke
// rekening yang belum pernah dibaca nasabah.
describe("RedeemStatus — the agreement belongs to one order", () => {
  describe("negative", () => {
    test("order A's agreement does not carry over to order B", () => {
      const { rerender } = renderTracker(order({ id: "order-a" }));

      fireEvent.click(screen.getByRole("checkbox"));
      expect(screen.getByRole("checkbox")).toBeChecked();
      expect(burnButton()).toBeEnabled();

      // Order lain dibuka di komponen yang sama (resume dari /history).
      tracked = order({
        id: "order-b",
        orderNumber: "RDM-B",
        bankAccountNumber: "9876543210",
        bankAccountName: "AGUS PRASETYO",
      });
      rerender(
        <LanguageProvider>
          <RedeemStatus />
        </LanguageProvider>,
      );

      // Tujuannya memang order B…
      expect(screen.getByTestId("redeem-destination-name")).toHaveTextContent("AGUS PRASETYO");
      // …dan persetujuannya tidak diwariskan: centang kosong, burn mati.
      expect(screen.getByRole("checkbox")).not.toBeChecked();
      expect(burnButton()).toBeDisabled();
      expect(runBurn).not.toHaveBeenCalled();
    });

    test("agreeing to B then going back to A does not carry back either", () => {
      const { rerender } = renderTracker(order({ id: "order-a" }));
      const reopen = () =>
        rerender(
          <LanguageProvider>
            <RedeemStatus />
          </LanguageProvider>,
        );

      tracked = order({ id: "order-b", bankAccountName: "AGUS PRASETYO" });
      reopen();
      fireEvent.click(screen.getByRole("checkbox"));
      expect(burnButton()).toBeEnabled();

      tracked = order({ id: "order-a" });
      reopen();
      expect(screen.getByRole("checkbox")).not.toBeChecked();
      expect(burnButton()).toBeDisabled();
    });
  });

  describe("positive", () => {
    test("re-agreeing to the order on screen enables its own burn", () => {
      const { rerender } = renderTracker(order({ id: "order-a" }));
      fireEvent.click(screen.getByRole("checkbox"));

      tracked = order({ id: "order-b" });
      rerender(
        <LanguageProvider>
          <RedeemStatus />
        </LanguageProvider>,
      );
      expect(burnButton()).toBeDisabled();

      fireEvent.click(screen.getByRole("checkbox"));
      expect(burnButton()).toBeEnabled();
      fireEvent.click(burnButton());
      expect(runBurn).toHaveBeenCalledTimes(1);
      // Yang dibakar order yang sedang tampil, bukan yang disetujui sebelumnya.
      expect(runBurn.mock.calls[0][0]).toMatchObject({ id: "order-b" });
    });
  });
});
