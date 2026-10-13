import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { MintReview } from "@/components/mint/MintReview";

// Ringkasan Transaksi menampilkan kurs beli tiap metode yang ditawarkan, sama
// dengan "Lihat kurs" (keputusan Wisnu 13 Okt 2026) — bukan satu "Nilai tukar"
// yang hanya menunjukkan kurs VA.

const mint = {
  selectedChain: { name: "Polygon", icon: "/polygon.svg" },
  destinationAddress: "0xb27FF52fC22aaFCAff2439ED6bcf5308cDc8d4BE",
  isCustodialDestination: false,
  amountUsdx: 10,
  conversionRate: 16331.25 as number | null,
  bniTransferBuyRate: 16400 as number | null,
  gatewayBuyRate: 16331.25 as number | null,
  isMintDisabled: false,
  submitMint: vi.fn(() => Promise.resolve()),
  isSubmitting: false,
  createErrorKey: null,
};

vi.mock("@/hooks/useMint", () => ({ useMint: () => mint }));

function renderReview() {
  render(
    <LanguageProvider>
      <MintReview open onOpenChange={() => {}} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  mint.conversionRate = 16331.25;
  mint.bniTransferBuyRate = 16400;
  mint.gatewayBuyRate = 16331.25;
});

describe("MintReview — kurs per metode", () => {
  describe("positive", () => {
    test("both methods offered → the BNI and the Virtual Account rate, labelled", () => {
      renderReview();
      expect(screen.getByText("Kurs Transfer BNI")).toBeInTheDocument();
      expect(screen.getByTestId("mint-review-rate-bni")).toHaveTextContent("1 USDX = Rp 16.400");
      expect(screen.getByText("Kurs Virtual Account")).toBeInTheDocument();
      expect(screen.getByTestId("mint-review-rate-va")).toHaveTextContent("1 USDX = Rp 16.331,25");
      expect(screen.queryByText("Nilai tukar")).toBeNull();
    });
  });

  describe("negative", () => {
    test("Transfer BNI not offered → only the Virtual Account rate", () => {
      mint.bniTransferBuyRate = null;
      renderReview();
      expect(screen.queryByTestId("mint-review-rate-bni")).toBeNull();
      expect(screen.getByTestId("mint-review-rate-va")).toHaveTextContent("Rp 16.331,25");
    });

    test("Virtual Account not offered → only the BNI rate", () => {
      mint.gatewayBuyRate = null;
      mint.conversionRate = 16400;
      renderReview();
      expect(screen.queryByTestId("mint-review-rate-va")).toBeNull();
      expect(screen.getByTestId("mint-review-rate-bni")).toHaveTextContent("Rp 16.400");
    });
  });

  describe("edge cases", () => {
    test("a backend without per-method rates keeps the single 'Nilai tukar' row", () => {
      mint.bniTransferBuyRate = null;
      mint.gatewayBuyRate = null;
      mint.conversionRate = 16250;
      renderReview();
      expect(screen.getByText("Nilai tukar")).toBeInTheDocument();
      expect(screen.getByText(/1 USDX ≈ Rp 16\.250/)).toBeInTheDocument();
    });
  });
});
