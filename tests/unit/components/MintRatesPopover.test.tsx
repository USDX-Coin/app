import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import {
  MintRatesPopover,
  formatRateIDR,
  formatRateTime,
} from "@/components/mint/MintRatesPopover";

// "Lihat kurs" beside the "Senilai" box (D25 rev-15, week2.md § 1. Form Mint).
const UPDATED_AT = "2026-10-02T02:15:00Z"; // 09.15 WIB

function renderPopover(props: {
  bniTransferBuyRate: number | null;
  bniTransferBuyRateUpdatedAt?: string | null;
  gatewayBuyRate?: number | null;
}) {
  render(
    <LanguageProvider>
      <MintRatesPopover
        bniTransferBuyRate={props.bniTransferBuyRate}
        bniTransferBuyRateUpdatedAt={props.bniTransferBuyRateUpdatedAt ?? null}
        gatewayBuyRate={props.gatewayBuyRate === undefined ? 16160 : props.gatewayBuyRate}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Lihat kurs" }));
}

describe("MintRatesPopover", () => {
  describe("positive", () => {
    test("shows both rates, the wondr source + time, and the method note", () => {
      renderPopover({ bniTransferBuyRate: 15950, bniTransferBuyRateUpdatedAt: UPDATED_AT });

      const details = screen.getByTestId("mint-rate-details");
      expect(screen.getByTestId("mint-rate-bni")).toHaveTextContent("Kurs Transfer BNIRp 15.950");
      expect(details).toHaveTextContent("sesuai aplikasi wondr by BNI · diperbarui 09.15 WIB");
      expect(screen.getByTestId("mint-rate-va")).toHaveTextContent("Kurs Virtual AccountRp 16.160");
      expect(details).toHaveTextContent("Metode dipilih di halaman pembayaran.");
    });

    test("rates only — no total, no fee, no QRIS, no 'payment gateway'", () => {
      renderPopover({ bniTransferBuyRate: 15950, bniTransferBuyRateUpdatedAt: UPDATED_AT });
      const details = screen.getByTestId("mint-rate-details");
      expect(details).not.toHaveTextContent(/total|biaya|QRIS|payment gateway/i);
    });
  });

  describe("negative", () => {
    test("BNI not offered → no BNI row, the VA rate stays", () => {
      renderPopover({ bniTransferBuyRate: null });
      expect(screen.queryByTestId("mint-rate-bni")).toBeNull();
      expect(screen.getByTestId("mint-rate-va")).toHaveTextContent("Rp 16.160");
    });

    test("VA not offered → no VA row", () => {
      renderPopover({ bniTransferBuyRate: 15950, gatewayBuyRate: null });
      expect(screen.queryByTestId("mint-rate-va")).toBeNull();
      expect(screen.getByTestId("mint-rate-bni")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    test("no BNI update time → the source without '· diperbarui'", () => {
      renderPopover({ bniTransferBuyRate: 15950, bniTransferBuyRateUpdatedAt: null });
      const bni = screen.getByTestId("mint-rate-bni");
      expect(bni).toHaveTextContent("sesuai aplikasi wondr by BNI");
      expect(bni).not.toHaveTextContent("diperbarui");
    });

    test("rates keep their decimals; whole rates print none", () => {
      expect(formatRateIDR(16412.5)).toBe("Rp 16.412,50");
      expect(formatRateIDR(16200)).toBe("Rp 16.200");
    });

    test("the update time is Jakarta time, 24-hour; a bad value shows nothing", () => {
      expect(formatRateTime(UPDATED_AT)).toBe("09.15 WIB");
      expect(formatRateTime("2026-10-02T10:05:00Z")).toBe("17.05 WIB");
      expect(formatRateTime("not-a-date")).toBeNull();
      expect(formatRateTime(null)).toBeNull();
    });
  });
});
