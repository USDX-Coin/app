import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { CustodialWalletOffer } from "@/components/wallet/CustodialWalletOffer";
import { ApiError } from "@/lib/api/client";

// The offer has two faces, chosen at build time by `env.walletCreateEnabled`
// (custodial-wallet.md §1, amandemen 21 Sep 2026, USDX-699): the dev build gets
// the "Buatkan saya wallet" button back, production keeps the "Segera hadir"
// pill of hotfix USDX-684 and must never send POST /api/v2/wallet.
// Rendered in Indonesian (the provider default).
const envMock = vi.hoisted(() => ({ walletCreateEnabled: true }));
vi.mock("@/lib/env", () => ({ env: envMock }));

function renderOffer(props: Partial<React.ComponentProps<typeof CustodialWalletOffer>> = {}) {
  const onCreate = vi.fn();
  const { container } = render(
    <LanguageProvider>
      <CustodialWalletOffer onCreate={onCreate} pending={false} error={null} {...props} />
    </LanguageProvider>,
  );
  return { onCreate, container };
}

const soonPill = (container: HTMLElement) => container.querySelector('[data-slot="wallet-offer-soon"]');

beforeEach(() => {
  envMock.walletCreateEnabled = true;
});

describe("CustodialWalletOffer", () => {
  describe("positive", () => {
    test("switch on (dev build) → the create button, no 'Segera hadir' pill; a click asks for the wallet", () => {
      const { onCreate, container } = renderOffer();
      expect(soonPill(container)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Buatkan saya wallet" }));
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    test("switch off (production) → the pill, and no create button to press", () => {
      envMock.walletCreateEnabled = false;
      const { onCreate, container } = renderOffer();
      expect(soonPill(container)).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Buatkan saya wallet" })).toBeNull();
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  describe("negative", () => {
    test("503 from the wallet service → the 'nothing was changed' sentence, never the raw error", () => {
      renderOffer({ error: new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "upstream down: ECONNREFUSED") });
      expect(screen.getByText(/Layanan wallet sedang tidak tersedia\. Tidak ada yang berubah/)).toBeTruthy();
      expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
    });

    test("any other failure → 'try again'", () => {
      renderOffer({ error: new ApiError(409, "SOMETHING_ELSE", "x") });
      expect(screen.getByText("Wallet belum bisa dibuat. Coba lagi.")).toBeTruthy();
    });
  });

  describe("edge case", () => {
    test("while the request is pending the skip button is disabled (onboarding)", () => {
      renderOffer({ pending: true, onSkip: vi.fn() });
      expect(screen.getByRole("button", { name: "Nanti saja" }).hasAttribute("disabled")).toBe(true);
    });

    test("switch off → a leftover create error is not shown next to the pill", () => {
      envMock.walletCreateEnabled = false;
      renderOffer({ error: new ApiError(503, "WALLET_SERVICE_UNAVAILABLE", "x") });
      expect(screen.queryByText(/Layanan wallet sedang tidak tersedia/)).toBeNull();
    });
  });
});
