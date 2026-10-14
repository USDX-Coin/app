import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { MintRatesPopover, formatRateIDR } from "@/components/mint/MintRatesPopover";

// "Lihat kurs" beside the "Senilai" box (D25 rev-15, week2.md § 1. Form Mint).
// Transfer BNI is described, never priced (USDX-749, PM decision 14 Oct 2026).

function renderPopover(props: { offersBniTransfer: boolean; gatewayBuyRate?: number | null }) {
  render(
    <LanguageProvider>
      <MintRatesPopover
        offersBniTransfer={props.offersBniTransfer}
        gatewayBuyRate={props.gatewayBuyRate === undefined ? 16160 : props.gatewayBuyRate}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Lihat kurs" }));
}

describe("MintRatesPopover", () => {
  describe("positive", () => {
    test("VA rate with its number, BNI row with the wondr phrase, and the method note", () => {
      renderPopover({ offersBniTransfer: true });

      const details = screen.getByTestId("mint-rate-details");
      expect(screen.getByTestId("mint-rate-va")).toHaveTextContent("Kurs Virtual AccountRp 16.160");
      expect(screen.getByTestId("mint-rate-bni")).toHaveTextContent(
        /^Transfer BNI: kurs mengikuti BNI di aplikasi wondr$/,
      );
      expect(details).toHaveTextContent("Metode dipilih di halaman pembayaran.");
    });

    test("no total, no QRIS, no 'payment gateway'", () => {
      renderPopover({ offersBniTransfer: true });
      const details = screen.getByTestId("mint-rate-details");
      expect(details).not.toHaveTextContent(/total|QRIS|payment gateway/i);
    });
  });

  describe("negative", () => {
    test("the BNI row never carries a rupiah figure, a '≈' or an update time", () => {
      renderPopover({ offersBniTransfer: true });
      const bni = screen.getByTestId("mint-rate-bni");
      expect(bni).not.toHaveTextContent(/Rp|≈|\d|diperbarui|·|tanpa biaya/);
    });

    test("BNI not offered → no BNI row, the VA rate stays", () => {
      renderPopover({ offersBniTransfer: false });
      expect(screen.queryByTestId("mint-rate-bni")).toBeNull();
      expect(screen.queryByText(/wondr/)).toBeNull();
      expect(screen.getByTestId("mint-rate-va")).toHaveTextContent("Rp 16.160");
    });

    test("VA not offered → no VA row", () => {
      renderPopover({ offersBniTransfer: true, gatewayBuyRate: null });
      expect(screen.queryByTestId("mint-rate-va")).toBeNull();
      expect(screen.getByTestId("mint-rate-bni")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    test("rates keep their decimals; whole rates print none", () => {
      expect(formatRateIDR(16412.5)).toBe("Rp 16.412,50");
      expect(formatRateIDR(16200)).toBe("Rp 16.200");
    });

    test("nothing offered → only the method note", () => {
      renderPopover({ offersBniTransfer: false, gatewayBuyRate: null });
      expect(screen.queryByTestId("mint-rate-va")).toBeNull();
      expect(screen.queryByTestId("mint-rate-bni")).toBeNull();
      expect(screen.getByTestId("mint-rate-details")).toHaveTextContent(
        "Metode dipilih di halaman pembayaran.",
      );
    });
  });
});
