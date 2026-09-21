import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { PinSection } from "@/components/settings/PinSection";
import { useAuthStore } from "@/stores/authStore";
import { markReloginIntent, reloginLanding } from "@/lib/auth/relogin-intent";
import type { User } from "@/types";

vi.mock("@/lib/api/auth-api", () => ({
  setPin: vi.fn(),
  changePin: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Pengaturan → PIN transaksi, sebagai layar tujuan "Login ulang" (USDX-697,
// custodial-wallet.md §5.1): sesudah login user mendarat di sini dan dialog Buat
// PIN sudah terbuka — sesinya segar, jendela 5 menit sedang berjalan.
const USER = { id: "usr_1", email: "demo@usdx.com", pinSet: false } as User;

function renderSection() {
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>
        <PinSection />
      </LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.getState().setAuth(USER, "token");
});

describe("PinSection", () => {
  describe("positive", () => {
    test("a create-pin re-login intent opens the Create PIN dialog and is used up", async () => {
      markReloginIntent("create-pin");
      renderSection();

      expect(await screen.findByTestId("pin-setup-dialog")).toBeInTheDocument();
      expect(reloginLanding()).toBeNull();
    });
  });

  describe("negative", () => {
    test("no intent → the row only, no dialog", () => {
      renderSection();
      expect(screen.getByRole("button", { name: "Buat PIN" })).toBeInTheDocument();
      expect(screen.queryByTestId("pin-setup-dialog")).not.toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("the account has a PIN by now → no Create PIN dialog, and the intent is still dropped", () => {
      useAuthStore.getState().setPinSet(true);
      markReloginIntent("create-pin");
      renderSection();

      expect(screen.queryByTestId("pin-setup-dialog")).not.toBeInTheDocument();
      expect(reloginLanding()).toBeNull();
    });
  });
});
