import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  isMockTwoFactorEnabled,
  resetMockTwoFactor,
  seedMockTwoFactor,
  seedMockTwoFactorChallengeExpired,
} from "@/lib/api/mock-two-factor";

// Login on a 2FA account in the web (auth.yaml § loginV2, USDX-714 — closes the
// 22 Sep GAP): email + password → "Masukkan kode authenticator" (TOTP or backup
// code) → in. "Tidak bisa akses authenticator?" → email recovery, with the 24-hour
// hold warning BEFORE the user confirms. Runs against the mock backend.

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SLOW = { timeout: 4000 };

function renderLogin() {
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>
        <LoginForm />
      </LanguageProvider>
    </Wrapper>,
  );
}

async function passStepOne() {
  fireEvent.change(screen.getByLabelText("Alamat email"), { target: { value: "demo@usdx.com" } });
  fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
  await screen.findByRole("heading", { name: "Masukkan kode authenticator" }, SLOW);
}

function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Kode authenticator atau backup code"), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verifikasi & masuk" }));
}

beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  resetMockTwoFactor();
  useAuthStore.getState().logout();
  seedMockTwoFactor(true);
});

describe("LoginForm — 2FA step", () => {
  describe("positive", () => {
    test("password → code step (the password form is gone) → right code → in", async () => {
      renderLogin();
      await passStepOne();
      expect(screen.queryByLabelText("Kata sandi")).toBeNull();

      enterCode(MOCK_TOTP_CODE);

      await waitFor(() => expect(push).toHaveBeenCalledWith("/mint"), SLOW);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    test("a backup code logs in too", async () => {
      renderLogin();
      await passStepOne();
      enterCode(MOCK_BACKUP_CODES[3]);
      await waitFor(() => expect(push).toHaveBeenCalledWith("/mint"), SLOW);
    });

    test("email recovery: warning first, OTP sent, right OTP → 2FA off and logged in", async () => {
      renderLogin();
      await passStepOne();
      fireEvent.click(screen.getByRole("button", { name: "Tidak bisa akses authenticator?" }));

      // The 24-hour hold is stated before anything is sent or confirmed.
      expect(screen.getByText(/ditahan 24 jam setelah 2FA dimatikan/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Kirim kode ke email" }));

      const otp = await screen.findByLabelText("Kode dari email", undefined, SLOW);
      expect(screen.getByText(/ditahan 24 jam setelah 2FA dimatikan/)).toBeInTheDocument();
      fireEvent.change(otp, { target: { value: MOCK_RECOVERY_OTP } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA & masuk" }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/mint"), SLOW);
      expect(isMockTwoFactorEnabled()).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe("negative", () => {
    test("a wrong code says so and stays on the code step", async () => {
      renderLogin();
      await passStepOne();
      enterCode("000000");

      expect(await screen.findByText(/Kode salah atau sudah kedaluwarsa/, undefined, SLOW)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Masukkan kode authenticator" })).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test("an empty code is caught before anything is sent", async () => {
      renderLogin();
      await passStepOne();
      fireEvent.click(screen.getByRole("button", { name: "Verifikasi & masuk" }));
      expect(screen.getByText("Masukkan kodenya dulu.")).toBeInTheDocument();
    });

    test("a wrong email OTP says so; 2FA stays on", async () => {
      renderLogin();
      await passStepOne();
      fireEvent.click(screen.getByRole("button", { name: "Tidak bisa akses authenticator?" }));
      fireEvent.click(screen.getByRole("button", { name: "Kirim kode ke email" }));
      fireEvent.change(await screen.findByLabelText("Kode dari email", undefined, SLOW), {
        target: { value: "999999" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA & masuk" }));

      expect(await screen.findByText("Kode email salah atau sudah kedaluwarsa.", undefined, SLOW)).toBeInTheDocument();
      expect(isMockTwoFactorEnabled()).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("an expired challenge goes back to the password form with a sentence", async () => {
      renderLogin();
      await passStepOne();
      seedMockTwoFactorChallengeExpired();
      enterCode(MOCK_TOTP_CODE);

      expect(
        await screen.findByText(/Verifikasi terlalu lama/, undefined, SLOW),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Kata sandi")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    test("five wrong codes lock the button with a countdown (Retry-After)", async () => {
      renderLogin();
      await passStepOne();
      for (let i = 0; i < 5; i += 1) {
        enterCode("000000");
        await screen.findByText(/Kode salah/, undefined, SLOW);
        await waitFor(() => expect(screen.getByRole("button", { name: "Verifikasi & masuk" })).toBeEnabled(), SLOW);
      }
      enterCode(MOCK_TOTP_CODE);
      await waitFor(
        () => expect(screen.getByRole("button", { name: /Coba lagi dalam/ })).toBeDisabled(),
        SLOW,
      );
      expect(push).not.toHaveBeenCalled();
    });

    test("'Back to login' returns to the password form", async () => {
      renderLogin();
      await passStepOne();
      fireEvent.click(screen.getByRole("button", { name: "Kembali ke login" }));
      expect(screen.getByLabelText("Kata sandi")).toBeInTheDocument();
    });
  });
});
