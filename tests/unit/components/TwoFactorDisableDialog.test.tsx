import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TwoFactorDisableDialog } from "@/components/settings/TwoFactorDisableDialog";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// Turn off 2FA (two-factor.yaml § disable, custodial-wallet.md §6.1 no.6, USDX-714):
// the 24-hour hold on transfers & withdrawals is stated BEFORE the user confirms;
// password OR the authenticator code (either/or — PM decision, not tightened).

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SLOW = { timeout: 3000 };
const USER: User = {
  id: "usr_1",
  name: "Demo",
  email: "demo@usdx.com",
  phone: null,
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  twoFactorEnabled: true,
};

function renderDialog() {
  const Wrapper = createWrapper();
  const onOpenChange = vi.fn();
  render(
    <Wrapper>
      <LanguageProvider>
        <TwoFactorDisableDialog open onOpenChange={onOpenChange} />
      </LanguageProvider>
    </Wrapper>,
  );
  return { onOpenChange };
}

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
  seedMockTwoFactor(true);
  useAuthStore.getState().setAuth(USER, "tok");
});

describe("TwoFactorDisableDialog", () => {
  describe("positive", () => {
    test("the 24-hour warning is on screen before confirming; password → off", async () => {
      const { onOpenChange } = renderDialog();
      expect(screen.getByText(/ditahan 24 jam setelah 2FA dimatikan/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA" }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), SLOW);
      expect(isMockTwoFactorEnabled()).toBe(false);
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(false);
    });

    test("with the authenticator code instead of the password", async () => {
      const { onOpenChange } = renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Pakai kode authenticator" }));
      fireEvent.change(screen.getByLabelText("Kode 6 digit dari aplikasi"), {
        target: { value: MOCK_TOTP_CODE },
      });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA" }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), SLOW);
      expect(isMockTwoFactorEnabled()).toBe(false);
    });
  });

  describe("negative", () => {
    test("a wrong password keeps 2FA on and says so", async () => {
      const { onOpenChange } = renderDialog();
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "nope" } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA" }));

      expect(await screen.findByText("Kata sandi salah.", undefined, SLOW)).toBeInTheDocument();
      expect(isMockTwoFactorEnabled()).toBe(true);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    test("a wrong code keeps 2FA on and says so", async () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Pakai kode authenticator" }));
      fireEvent.change(screen.getByLabelText("Kode 6 digit dari aplikasi"), { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA" }));

      expect(await screen.findByText(/Kode salah atau sudah kedaluwarsa/, undefined, SLOW)).toBeInTheDocument();
      expect(isMockTwoFactorEnabled()).toBe(true);
    });
  });

  describe("edge case", () => {
    test("switching back to the password clears the other field's error", async () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Pakai kode authenticator" }));
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA" }));
      expect(screen.getByText("Masukkan kode 6 digit.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Pakai kata sandi" }));
      expect(screen.queryByText("Masukkan kode 6 digit.")).toBeNull();
      expect(screen.getByLabelText("Kata sandi")).toBeInTheDocument();
    });
  });
});
