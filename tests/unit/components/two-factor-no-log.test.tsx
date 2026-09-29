import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { LoginForm } from "@/components/auth/LoginForm";
import { TwoFactorEnableDialog } from "@/components/settings/TwoFactorEnableDialog";
import { useAuthStore } from "@/stores/authStore";
import {
  MOCK_BACKUP_CODES,
  MOCK_RECOVERY_OTP,
  MOCK_TOTP_CODE,
  resetMockTwoFactor,
  seedMockTwoFactor,
} from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// AC USDX-714 (custodial-wallet.md §6.1 "Log"): the `code` — authenticator code,
// backup code, email OTP — never reaches the client's log. The client has no
// analytics SDK; `console.*` is the only log it has, so every console call made
// during the 2FA flows (success AND failure paths) is checked for the secrets.

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SLOW = { timeout: 4000 };
const SECRETS = [MOCK_TOTP_CODE, MOCK_RECOVERY_OTP, MOCK_BACKUP_CODES[0], "000000", "999999", "Demo1234"];
const METHODS = ["log", "info", "warn", "error", "debug"] as const;
let spies: ReturnType<typeof vi.spyOn>[] = [];

function loggedText(): string {
  return spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg)))
    .join("\n");
}

function expectNoSecretLogged() {
  const text = loggedText();
  for (const secret of SECRETS) expect(text).not.toContain(secret);
}

function renderWithProviders(ui: React.ReactNode) {
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>{ui}</LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  resetMockTwoFactor();
  useAuthStore.getState().logout();
  spies = METHODS.map((m) => vi.spyOn(console, m));
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
});

describe("2FA codes never reach the client log", () => {
  describe("positive", () => {
    test("login step 2 with a wrong then the right code", async () => {
      seedMockTwoFactor(true);
      renderWithProviders(<LoginForm />);
      fireEvent.change(screen.getByLabelText("Alamat email"), { target: { value: "demo@usdx.com" } });
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
      const field = await screen.findByLabelText("Kode authenticator atau backup code", undefined, SLOW);

      fireEvent.change(field, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: "Verifikasi & masuk" }));
      await screen.findByText(/Kode salah/, undefined, SLOW);
      fireEvent.change(field, { target: { value: MOCK_TOTP_CODE } });
      fireEvent.click(screen.getByRole("button", { name: "Verifikasi & masuk" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/mint"), SLOW);

      expectNoSecretLogged();
    });
  });

  describe("negative", () => {
    test("email recovery with a wrong then the right OTP", async () => {
      seedMockTwoFactor(true);
      renderWithProviders(<LoginForm />);
      fireEvent.change(screen.getByLabelText("Alamat email"), { target: { value: "demo@usdx.com" } });
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
      await screen.findByRole("heading", { name: "Masukkan kode authenticator" }, SLOW);
      fireEvent.click(screen.getByRole("button", { name: "Tidak bisa akses authenticator?" }));
      fireEvent.click(screen.getByRole("button", { name: "Kirim kode ke email" }));
      const otp = await screen.findByLabelText("Kode dari email", undefined, SLOW);

      fireEvent.change(otp, { target: { value: "999999" } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA & masuk" }));
      await screen.findByText("Kode email salah atau sudah kedaluwarsa.", undefined, SLOW);
      fireEvent.change(otp, { target: { value: MOCK_RECOVERY_OTP } });
      fireEvent.click(screen.getByRole("button", { name: "Matikan 2FA & masuk" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/mint"), SLOW);

      expectNoSecretLogged();
    });
  });

  describe("edge case", () => {
    test("enrollment: the backup codes and the code shown/typed in Settings", async () => {
      useAuthStore.getState().setAuth({ id: "usr_1", twoFactorEnabled: false } as User, "tok");
      renderWithProviders(<TwoFactorEnableDialog open onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
      await screen.findByText(MOCK_BACKUP_CODES[0], undefined, SLOW);
      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      fireEvent.change(screen.getByLabelText("Kode 6 digit dari aplikasi"), { target: { value: MOCK_TOTP_CODE } });
      fireEvent.click(screen.getByRole("button", { name: "Aktifkan 2FA" }));
      await waitFor(() => expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true), SLOW);

      expectNoSecretLogged();
    });
  });
});
