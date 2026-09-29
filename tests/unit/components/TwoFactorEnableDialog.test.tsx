import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TwoFactorEnableDialog } from "@/components/settings/TwoFactorEnableDialog";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_BACKUP_CODES,
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  resetMockTwoFactor,
} from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// Turn on 2FA from Settings (two-factor.yaml § enable → verify, USDX-714):
// password → QR rendered locally + the key for manual entry + backup codes shown
// once ("I have saved" ticked) → 6-digit code → on. Mock backend.

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
  twoFactorEnabled: false,
};

function renderDialog() {
  const Wrapper = createWrapper();
  const onOpenChange = vi.fn();
  const onEnabled = vi.fn();
  render(
    <Wrapper>
      <LanguageProvider>
        <TwoFactorEnableDialog open onOpenChange={onOpenChange} onEnabled={onEnabled} />
      </LanguageProvider>
    </Wrapper>,
  );
  return { onOpenChange, onEnabled };
}

async function passPassword() {
  fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
  await screen.findByRole("img", { name: "Kode QR untuk aplikasi authenticator" }, SLOW);
}

function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Kode 6 digit dari aplikasi"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Aktifkan 2FA" }));
}

beforeEach(() => {
  localStorage.clear();
  resetMockTwoFactor();
  useAuthStore.getState().setAuth(USER, "tok");
});

describe("TwoFactorEnableDialog", () => {
  describe("positive", () => {
    test("password → QR + manual key + backup codes → code → 2FA on", async () => {
      const { onOpenChange, onEnabled } = renderDialog();
      await passPassword();

      expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
      for (const code of MOCK_BACKUP_CODES) expect(screen.getByText(code)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      enterCode(MOCK_TOTP_CODE);

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), SLOW);
      expect(onEnabled).toHaveBeenCalledTimes(1);
      expect(isMockTwoFactorEnabled()).toBe(true);
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true);
    });
  });

  describe("negative", () => {
    test("a wrong password stays on the first step with its sentence", async () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "nope" } });
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
      expect(await screen.findByText("Kata sandi salah.", undefined, SLOW)).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: "Kode QR untuk aplikasi authenticator" })).toBeNull();
    });

    test("a wrong code says so and 2FA stays off", async () => {
      const { onOpenChange } = renderDialog();
      await passPassword();
      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      enterCode("000000");

      expect(await screen.findByText(/Kode salah atau sudah kedaluwarsa/, undefined, SLOW)).toBeInTheDocument();
      expect(isMockTwoFactorEnabled()).toBe(false);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    test("an empty password is caught before anything is sent", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
      expect(screen.getByText("Masukkan kata sandi.")).toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("the code cannot be submitted before the backup codes are marked saved", async () => {
      renderDialog();
      await passPassword();
      fireEvent.change(screen.getByLabelText("Kode 6 digit dari aplikasi"), {
        target: { value: MOCK_TOTP_CODE },
      });
      expect(screen.getByRole("button", { name: "Aktifkan 2FA" })).toBeDisabled();
    });

    test("an incomplete code shows the format sentence and sends nothing", async () => {
      renderDialog();
      await passPassword();
      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      enterCode("123");
      expect(screen.getByText("Masukkan kode 6 digit.")).toBeInTheDocument();
      expect(isMockTwoFactorEnabled()).toBe(false);
    });
  });
});
