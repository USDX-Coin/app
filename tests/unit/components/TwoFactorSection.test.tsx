import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TwoFactorSection } from "@/components/settings/TwoFactorSection";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

// Pengaturan → Akun → 2FA (custodial-wallet.md §6.1 "Web", USDX-714). The status
// comes from `user.twoFactorEnabled` (GET /auth/me); the actions follow it.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const USER = { id: "usr_1", email: "demo@usdx.com" } as User;

function renderSection(twoFactorEnabled: boolean | undefined) {
  useAuthStore.getState().setAuth({ ...USER, twoFactorEnabled }, "tok");
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>
        <TwoFactorSection />
      </LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("TwoFactorSection", () => {
  describe("positive", () => {
    test("off → 'Belum aktif' + Aktifkan 2FA, which opens the enable dialog", () => {
      renderSection(false);
      expect(screen.getByText("Belum aktif")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Aktifkan 2FA" }));
      expect(screen.getByTestId("two-factor-enable-dialog")).toBeInTheDocument();
    });

    test("on → 'Aktif' + Matikan and Backup code baru, each opening its dialog", () => {
      renderSection(true);
      expect(screen.getByText("Aktif")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Aktifkan 2FA" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Matikan" }));
      expect(screen.getByTestId("two-factor-disable-dialog")).toBeInTheDocument();
    });

    test("on → Backup code baru opens the regenerate dialog", () => {
      renderSection(true);
      fireEvent.click(screen.getByRole("button", { name: "Backup code baru" }));
      expect(screen.getByTestId("backup-codes-regenerate-dialog")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("off → no Matikan / Backup code baru", () => {
      renderSection(false);
      expect(screen.queryByRole("button", { name: "Matikan" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Backup code baru" })).toBeNull();
    });
  });

  describe("edge case", () => {
    // An older persisted session without the field must not offer "turn on": on an
    // account that already has 2FA, enable would rotate the secret of the live one.
    test("unknown (older session) → no badge and no action until /auth/me answers", () => {
      renderSection(undefined);
      expect(screen.queryByRole("button", { name: "Aktifkan 2FA" })).toBeNull();
      expect(screen.queryByText("Belum aktif")).toBeNull();
    });
  });
});
