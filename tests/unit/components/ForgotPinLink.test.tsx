import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { ForgotPinLink } from "@/components/shared/ForgotPinLink";
import { useAuthStore } from "@/stores/authStore";
import { logout as revokeSession } from "@/lib/api/auth-api";
import { RELOGIN_INTENT_KEY, reloginLanding } from "@/lib/auth/relogin-intent";
import type { User } from "@/types";

vi.mock("@/lib/api/auth-api", () => ({ logout: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

// Pintu lupa-PIN (custodial-wallet.md §5.1 "Lupa PIN di web", USDX-696): tautan →
// satu kalimat + "Login ulang" → sesi ini diakhiri, penanda forgot-pin (per tab,
// tanpa PIN) → halaman login. Batal tidak meninggalkan jejak apa pun.
const USER = { id: "usr_1", email: "demo@usdx.com", pinSet: true } as User;

function renderLink() {
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>
        <ForgotPinLink />
      </LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  push.mockReset();
  vi.mocked(revokeSession).mockReset().mockResolvedValue(undefined);
  useAuthStore.getState().setAuth(USER, "token");
});

describe("ForgotPinLink", () => {
  describe("positive", () => {
    test("link → one sentence + Log in again → session ended, forgot-pin marked, on to /login", () => {
      renderLink();
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));

      const dialog = screen.getByRole("dialog");
      // Satu kalimat (custodial-wallet.md §5.1; tiket: "dialog konfirmasi satu kalimat").
      const sentence = within(dialog).getByText(/^Login ulang, lalu buat PIN baru/).textContent ?? "";
      expect(sentence).toBe("Login ulang, lalu buat PIN baru tanpa perlu PIN lama.");
      expect(sentence.match(/[.!?]/g)).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));

      expect(reloginLanding()).toBe("/settings");
      expect(sessionStorage.getItem(RELOGIN_INTENT_KEY)).toBe("forgot-pin");
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(push).toHaveBeenCalledWith("/login");
    });
  });

  describe("negative", () => {
    test("Cancel → still logged in, no marker, no navigation", async () => {
      renderLink();
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      fireEvent.click(screen.getByRole("button", { name: "Batal" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(sessionStorage.getItem(RELOGIN_INTENT_KEY)).toBeNull();
      expect(revokeSession).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("the marker holds only the intent name — never a PIN — and nothing lands in localStorage", () => {
      renderLink();
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));

      expect(sessionStorage.length).toBe(1);
      expect(sessionStorage.getItem(RELOGIN_INTENT_KEY)).not.toMatch(/\d/);
      expect(localStorage.getItem(RELOGIN_INTENT_KEY)).toBeNull();
    });

    test("the link is a plain button (type=button): inside a PIN form it never submits the form", () => {
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <LanguageProvider>
            <form onSubmit={onSubmit}>
              <ForgotPinLink />
            </form>
          </LanguageProvider>
        </Wrapper>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      fireEvent.click(screen.getByRole("button", { name: "Login ulang" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
