import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { PinSetupDialog } from "@/components/shared/PinSetupDialog";
import { useAuthStore } from "@/stores/authStore";
import { setPin, logout as revokeSession } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import { reloginLanding } from "@/lib/auth/relogin-intent";
import type { User } from "@/types";

vi.mock("@/lib/api/auth-api", () => ({
  setPin: vi.fn(),
  changePin: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const setPinMock = vi.mocked(setPin);

// Create-PIN dialog (pin.yaml § set, USDX-651): two fields that must agree, the
// shape check before anything leaves, and the server's answers on the right
// field. Rendered in Indonesian (the provider default).
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
  pinSet: false,
  custodialWallet: null,
};

function renderDialog(props: Partial<React.ComponentProps<typeof PinSetupDialog>> = {}) {
  const Wrapper = createWrapper();
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <Wrapper>
      <LanguageProvider>
        <PinSetupDialog open onOpenChange={onOpenChange} onCreated={onCreated} {...props} />
      </LanguageProvider>
    </Wrapper>,
  );
  return { onOpenChange, onCreated };
}

function fill(pin: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("PIN baru"), { target: { value: pin } });
  fireEvent.change(screen.getByLabelText("Ulangi PIN"), { target: { value: confirm } });
}

beforeEach(() => {
  setPinMock.mockReset();
  vi.mocked(revokeSession).mockReset().mockResolvedValue(undefined);
  push.mockReset();
  sessionStorage.clear();
  useAuthStore.getState().setAuth(USER, "token");
});

describe("PinSetupDialog", () => {
  describe("positive", () => {
    test("matching 6-digit PINs → POST set, user.pinSet true, dialog closes, onCreated fires", async () => {
      setPinMock.mockResolvedValueOnce(undefined);
      const { onOpenChange, onCreated } = renderDialog();

      fill("654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      await waitFor(() => expect(setPinMock).toHaveBeenCalledWith({ pin: "654321" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });
  });

  describe("negative", () => {
    test("PINs that do not match → inline error, nothing sent", () => {
      renderDialog();
      fill("654321", "654322");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      expect(screen.getByText("PIN tidak sama.")).toBeInTheDocument();
      expect(setPinMock).not.toHaveBeenCalled();
    });

    test("fewer than six digits → shape error, nothing sent", () => {
      renderDialog();
      fill("12345", "12345");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      expect(screen.getByText("Masukkan 6 digit PIN Anda")).toBeInTheDocument();
      expect(setPinMock).not.toHaveBeenCalled();
    });

    test("401 REAUTH_REQUIRED (the account already has a PIN) → sentence above the form, dialog stays open", async () => {
      setPinMock.mockRejectedValueOnce(new ApiError(401, "REAUTH_REQUIRED", "x"));
      const { onOpenChange } = renderDialog();
      fill("654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      await waitFor(() =>
        expect(screen.getByTestId("pin-setup-error")).toHaveTextContent("Akun Anda sudah punya PIN"),
      );
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      // The profile copy follows the backend: this account has a PIN.
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
      // Changing PIN is the way out here — no re-login button.
      expect(screen.queryByRole("button", { name: "Login ulang" })).not.toBeInTheDocument();
    });

    // pin.yaml § set, keputusan PM 21 Sep 2026 (USDX-697): akun ber-wallet
    // custodial tanpa PIN + sesi tidak segar. Jalan keluarnya login ulang, lalu
    // user kembali ke dialog ini lewat penanda tujuan.
    test("401 REAUTH_REQUIRED + details.pinSet false → log-in-again sentence and button; the copy stays false", async () => {
      setPinMock.mockRejectedValueOnce(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: false }));
      renderDialog();
      fill("654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      await waitFor(() =>
        expect(screen.getByTestId("pin-setup-error")).toHaveTextContent(
          "Demi keamanan, login ulang dulu, lalu buat PIN dalam 5 menit.",
        ),
      );
      expect(screen.getByTestId("pin-setup-error")).not.toHaveTextContent("Ubah PIN");
      expect(useAuthStore.getState().user?.pinSet).toBe(false);

      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));
      expect(reloginLanding()).toBe("/settings");
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  describe("edge case", () => {
    test("letters are dropped from the PIN as typed", () => {
      renderDialog();
      const input = screen.getByLabelText("PIN baru") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "12ab34" } });
      expect(input.value).toBe("1234");
      expect(input).toHaveAttribute("type", "password");
      expect(input).toHaveAttribute("inputmode", "numeric");
    });

    test("429 lockout → the submit button counts down instead of sending", async () => {
      setPinMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      renderDialog();
      fill("654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Coba lagi dalam 15 menit/ })).toBeDisabled(),
      );
    });
  });
});

// Varian "Buat PIN baru" — jalur lupa-PIN (custodial-wallet.md §5.1 "Lupa PIN di
// web", USDX-696): dibuka sesudah login ulang, akun biasanya SUDAH punya PIN, body
// tetap `{pin}` tanpa `currentPin`. REAUTH_REQUIRED di sini = jendela 5 menit
// lewat → login ulang dengan niat forgot-pin, tidak pernah "gunakan Ubah PIN".
describe("PinSetupDialog — reset variant (forgot PIN)", () => {
  beforeEach(() => {
    useAuthStore.getState().setPinSet(true);
  });

  function fillReset(pin: string) {
    fireEvent.change(screen.getByLabelText("PIN baru"), { target: { value: pin } });
    fireEvent.change(screen.getByLabelText("Ulangi PIN"), { target: { value: pin } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan PIN baru" }));
  }

  describe("positive", () => {
    test("own title, no old-PIN field, POST set {pin} only; closes and pinSet stays true", async () => {
      setPinMock.mockResolvedValueOnce(undefined);
      const { onOpenChange } = renderDialog({ variant: "reset" });

      expect(screen.getByRole("heading", { name: "Buat PIN baru" })).toBeInTheDocument();
      expect(screen.getByText(/PIN lama tidak diperlukan/)).toBeInTheDocument();
      expect(screen.queryByLabelText("PIN saat ini")).not.toBeInTheDocument();

      fillReset("654321");

      await waitFor(() => expect(setPinMock).toHaveBeenCalledWith({ pin: "654321" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(useAuthStore.getState().user?.pinSet).toBe(true);
    });
  });

  describe("negative", () => {
    test("REAUTH_REQUIRED (5 minutes passed) → log-in-again sentence, never 'Ubah PIN'; the button marks forgot-pin", async () => {
      setPinMock.mockRejectedValueOnce(new ApiError(401, "REAUTH_REQUIRED", "x", { pinSet: true }));
      renderDialog({ variant: "reset" });
      fillReset("654321");

      await waitFor(() =>
        expect(screen.getByTestId("pin-setup-error")).toHaveTextContent(
          "Demi keamanan, login ulang dulu, lalu buat PIN baru dalam 5 menit.",
        ),
      );
      expect(screen.getByTestId("pin-setup-error")).not.toHaveTextContent("Ubah PIN");

      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));
      expect(sessionStorage.getItem("usdx-relogin-intent")).toBe("forgot-pin");
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  describe("edge case", () => {
    test("cancelling sends nothing and leaves no marker behind", () => {
      const { onOpenChange } = renderDialog({ variant: "reset" });
      fireEvent.change(screen.getByLabelText("PIN baru"), { target: { value: "654321" } });
      fireEvent.click(screen.getByRole("button", { name: "Batal" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(setPinMock).not.toHaveBeenCalled();
      expect(reloginLanding()).toBeNull();
    });
  });
});
