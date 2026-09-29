import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { CustodialWalletSection } from "@/components/wallet/CustodialWalletSection";
import { useAuthStore } from "@/stores/authStore";
import type { CustodialWalletState } from "@/hooks/useCustodialWallet";
import type { User } from "@/types";

// Ajakan "Aktifkan 2FA" tepat sesudah wallet custodial dibuat (custodial-wallet.md
// §6.1 "Web" + risiko residual no.9, USDX-714): 2FA wajib untuk mengirim/redeem,
// dan mengaktifkannya sekarang memperkecil peluang orang lain mengaktifkannya lebih
// dulu. Satu ajakan, tidak memaksa, hanya untuk wallet yang dibuat di layar ini.
const walletState = vi.hoisted(() => ({ current: {} as Partial<CustodialWalletState> }));
vi.mock("@/hooks/useCustodialWallet", () => ({ useCustodialWallet: () => walletState.current }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({}) }));
vi.mock("@/lib/env", () => ({ env: { walletCreateEnabled: true } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
  walletState.current = { create: vi.fn(async () => {}), createPending: false, createError: null, pinSet: true, ...overrides };
}

function signIn(twoFactorEnabled: boolean | undefined) {
  useAuthStore.getState().setAuth({ id: "usr_1", email: "demo@usdx.com", twoFactorEnabled } as User, "tok");
}

const section = () => (
  <LanguageProvider>
    <CustodialWalletSection variant="settings" />
  </LanguageProvider>
);

function createHereThenActive() {
  const view = render(section(), { wrapper: createWrapper() });
  fireEvent.click(screen.getByRole("button", { name: "Buatkan saya wallet" }));
  state(ACTIVE);
  view.rerender(section());
}

const invite = () => screen.queryByTestId("wallet-2fa-invite");

beforeEach(() => {
  state({ status: "none" });
  signIn(false);
});

describe("CustodialWalletSection — turn-on-2FA invite", () => {
  describe("positive", () => {
    test("wallet created here and ACTIVE, 2FA off → one invite that opens the enable dialog", () => {
      createHereThenActive();
      expect(invite()).toHaveTextContent("Lindungi wallet baru Anda: aktifkan 2FA");
      fireEvent.click(screen.getByRole("button", { name: "Aktifkan 2FA" }));
      expect(screen.getByTestId("two-factor-enable-dialog")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("2FA already on → no invite", () => {
      signIn(true);
      createHereThenActive();
      expect(invite()).not.toBeInTheDocument();
    });

    test("a wallet that already existed → no invite (Settings → 2FA is its home)", () => {
      state(ACTIVE);
      render(section(), { wrapper: createWrapper() });
      expect(invite()).not.toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("unknown 2FA status (older session) → no invite", () => {
      signIn(undefined);
      createHereThenActive();
      expect(invite()).not.toBeInTheDocument();
    });
  });
});
