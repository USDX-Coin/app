import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { CustodialWalletSection } from "@/components/wallet/CustodialWalletSection";
import type { CustodialWalletState } from "@/hooks/useCustodialWallet";

// Ajakan "Buat PIN" tepat sesudah wallet custodial berhasil dibuat
// (custodial-wallet.md §6 "Saran alur FE", USDX-697): sesi user masih segar di
// saat itu, jadi membuat PIN tidak butuh login ulang. Satu ajakan, tidak memaksa,
// hanya untuk wallet yang dibuat di layar ini.
const walletState = vi.hoisted(() => ({ current: {} as Partial<CustodialWalletState> }));
vi.mock("@/hooks/useCustodialWallet", () => ({ useCustodialWallet: () => walletState.current }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({}) }));
vi.mock("@/lib/env", () => ({ env: { walletCreateEnabled: true } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const ACTIVE: Partial<CustodialWalletState> = {
  status: "ACTIVE",
  isLoading: false,
  isError: false,
  isFetching: false,
  wallet: null,
  summary: { address: "0x000000C528aE908fB929a0898B65e913623c9aFf", status: "ACTIVE" },
  balanceUsdx: 0,
  balanceAt: "2026-09-21T00:00:00.000Z",
  refetch: vi.fn(),
};

function state(overrides: Partial<CustodialWalletState>) {
  walletState.current = { create: vi.fn(async () => {}), createPending: false, createError: null, pinSet: false, ...overrides };
}

// A fresh element each time: re-rendering the SAME element object is a no-op.
const section = () => (
  <LanguageProvider>
    <CustodialWalletSection variant="settings" />
  </LanguageProvider>
);

function renderSection() {
  const view = render(section(), { wrapper: createWrapper() });
  return { rerender: () => view.rerender(section()) };
}

const invite = () => screen.queryByTestId("wallet-pin-invite");

beforeEach(() => {
  state({ status: "none" });
});

describe("CustodialWalletSection — create-PIN invite", () => {
  describe("positive", () => {
    test("wallet created here and now ACTIVE, account without a PIN → one invite with a Create PIN button", () => {
      const view = renderSection();
      fireEvent.click(screen.getByRole("button", { name: "Buatkan saya wallet" }));

      state({ ...ACTIVE, pinSet: false });
      view.rerender();

      expect(invite()).toHaveTextContent("Wallet Anda siap. Buat PIN sekarang");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));
      expect(screen.getByTestId("pin-setup-dialog")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("a wallet that already existed (not created on this screen) → no invite", () => {
      state({ ...ACTIVE, pinSet: false });
      renderSection();
      expect(invite()).not.toBeInTheDocument();
    });

    test("created here but the account already has a PIN → no invite", () => {
      const view = renderSection();
      fireEvent.click(screen.getByRole("button", { name: "Buatkan saya wallet" }));
      state({ ...ACTIVE, pinSet: true });
      view.rerender();
      expect(invite()).not.toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("still PROVISIONING after the click → no invite yet (the PIN is useless until the wallet is ready)", () => {
      const view = renderSection();
      fireEvent.click(screen.getByRole("button", { name: "Buatkan saya wallet" }));
      state({ ...ACTIVE, status: "PROVISIONING", summary: { address: null, status: "PROVISIONING" } });
      view.rerender();
      expect(invite()).not.toBeInTheDocument();
    });
  });
});
