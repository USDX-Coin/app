import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { PinChangeDialog } from "@/components/shared/PinChangeDialog";
import { useAuthStore } from "@/stores/authStore";
import { changePin, logout } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/types";

vi.mock("@/lib/api/auth-api", () => ({
  setPin: vi.fn(),
  changePin: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
}));
// The "Lupa PIN?" link logs in again (USDX-696), which needs the app router.
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const changePinMock = vi.mocked(changePin);

// Change-PIN dialog (pin.yaml § change, USDX-651): the current PIN gates the
// change, a wrong one stays on its own field with the new PIN intact, and the
// shared lockout shows up as a countdown. Rendered in Indonesian.
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
  pinSet: true,
  custodialWallet: null,
};

function renderDialog() {
  const Wrapper = createWrapper();
  const onOpenChange = vi.fn();
  render(
    <Wrapper>
      <LanguageProvider>
        <PinChangeDialog open onOpenChange={onOpenChange} />
      </LanguageProvider>
    </Wrapper>,
  );
  return { onOpenChange };
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("PIN saat ini"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("PIN baru"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Ulangi PIN baru"), { target: { value: confirm } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Ubah PIN" }));

beforeEach(() => {
  changePinMock.mockReset();
  useAuthStore.getState().setAuth(USER, "token");
});

describe("PinChangeDialog", () => {
  describe("positive", () => {
    test("current + matching new PIN → POST change, dialog closes", async () => {
      changePinMock.mockResolvedValueOnce(undefined);
      const { onOpenChange } = renderDialog();

      fill("123456", "654321", "654321");
      submit();

      await waitFor(() =>
        expect(changePinMock).toHaveBeenCalledWith({ currentPin: "123456", newPin: "654321" }),
      );
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe("negative", () => {
    test("wrong current PIN (401 INVALID_PIN) → error under the current field, new PIN kept, dialog open", async () => {
      changePinMock.mockRejectedValueOnce(new ApiError(401, "INVALID_PIN", "PIN salah"));
      const { onOpenChange } = renderDialog();

      fill("000000", "654321", "654321");
      submit();

      await waitFor(() => expect(screen.getByText("PIN salah. Coba lagi.")).toBeInTheDocument());
      expect(screen.getByLabelText("PIN saat ini")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("PIN baru")).toHaveValue("654321");
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    test("new PIN equal to the current one → rejected before it is sent", () => {
      renderDialog();
      fill("123456", "123456", "123456");
      submit();

      expect(screen.getByText("Pilih PIN yang berbeda dari PIN saat ini.")).toBeInTheDocument();
      expect(changePinMock).not.toHaveBeenCalled();
    });

    test("repeat does not match → inline error, nothing sent", () => {
      renderDialog();
      fill("123456", "654321", "654322");
      submit();

      expect(screen.getByText("PIN tidak sama.")).toBeInTheDocument();
      expect(changePinMock).not.toHaveBeenCalled();
    });

    test("401 PIN_NOT_SET → sentence above the form and the profile copy flips to false", async () => {
      changePinMock.mockRejectedValueOnce(new ApiError(401, "PIN_NOT_SET", "x"));
      renderDialog();
      fill("123456", "654321", "654321");
      submit();

      await waitFor(() =>
        expect(screen.getByTestId("pin-change-error")).toHaveTextContent(/belum punya PIN/),
      );
      expect(useAuthStore.getState().user?.pinSet).toBe(false);
    });
  });

  describe("edge case", () => {
    test("lockout (429, Retry-After 900) → the button counts down 15 minutes", async () => {
      changePinMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      renderDialog();
      fill("000000", "654321", "654321");
      submit();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Coba lagi dalam 15 menit/ })).toBeDisabled(),
      );
    });

    test("cancel clears the fields", () => {
      const { onOpenChange } = renderDialog();
      fill("123456", "654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Batal" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// Pintu lupa-PIN (custodial-wallet.md §5.1 "Lupa PIN di web", USDX-696): Ubah PIN
// wajib PIN lama — user yang lupa butuh jalan keluar di sini, juga saat terkunci.
describe("PinChangeDialog — Forgot PIN door", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(logout).mockReset().mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  describe("positive", () => {
    test("'Lupa PIN?' → Log in again → forgot-pin marked, /login; no PIN change is sent", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));

      expect(sessionStorage.getItem("usdx-relogin-intent")).toBe("forgot-pin");
      expect(push).toHaveBeenCalledWith("/login");
      expect(changePinMock).not.toHaveBeenCalled();
    });
  });

  describe("negative", () => {
    test("the link never submits the change form", () => {
      renderDialog();
      fill("123456", "654321", "654321");
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      expect(changePinMock).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("after five wrong current PINs (countdown on the button) the link is still usable", async () => {
      changePinMock.mockRejectedValueOnce(
        new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 900 }, 900),
      );
      renderDialog();
      fill("111111", "654321", "654321");
      submit();

      await waitFor(() => expect(screen.getByRole("button", { name: /Coba lagi dalam/ })).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Lupa PIN?" })).toBeEnabled();
    });
  });
});
