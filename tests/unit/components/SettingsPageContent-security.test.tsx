import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { SettingsPageContent } from "@/components/settings/SettingsPageContent";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

// Pengaturan → Keamanan (custodial-wallet.md §6.1 "Web", USDX-714): 2FA has its own
// "Keamanan" card, separate from the Account card that holds the PIN.

vi.mock("@/components/wallet/CustodialWalletSection", () => ({ CustodialWalletSection: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeEach(() => {
  useAuthStore.getState().setAuth({ id: "usr_1", pinSet: true, twoFactorEnabled: false } as User, "tok");
});

function renderPage() {
  const Wrapper = createWrapper();
  render(
    <Wrapper>
      <LanguageProvider>
        <SettingsPageContent />
      </LanguageProvider>
    </Wrapper>,
  );
}

describe("SettingsPageContent — Keamanan", () => {
  describe("positive", () => {
    test("the 2FA row sits in the Keamanan card", () => {
      renderPage();
      const card = screen.getByRole("heading", { name: "Keamanan" }).closest('[data-slot="settings-security"]');
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByText("Verifikasi dua langkah (2FA)")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("the Account card no longer holds the 2FA row", () => {
      renderPage();
      const account = document.querySelector('[data-slot="settings-account"]') as HTMLElement;
      expect(within(account).queryByText("Verifikasi dua langkah (2FA)")).toBeNull();
      expect(within(account).getByText("PIN transaksi")).toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("exactly one 2FA row on the page", () => {
      renderPage();
      expect(document.querySelectorAll('[data-slot="settings-2fa"]')).toHaveLength(1);
    });
  });
});
