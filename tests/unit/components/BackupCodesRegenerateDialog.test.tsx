import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { BackupCodesRegenerateDialog } from "@/components/settings/BackupCodesRegenerateDialog";
import { useAuthStore } from "@/stores/authStore";
import { MOCK_BACKUP_CODES, resetMockTwoFactor, seedMockTwoFactor } from "@/lib/api/mock-two-factor";
import type { User } from "@/types";

// New backup codes (two-factor.yaml § regenerateBackupCodes, USDX-714): password →
// the new set shown once → "Done" only after "I have saved" is ticked.

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
        <BackupCodesRegenerateDialog open onOpenChange={onOpenChange} />
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

describe("BackupCodesRegenerateDialog", () => {
  describe("positive", () => {
    test("password → a new set (not the old one) → Done after 'saved'", async () => {
      const { onOpenChange } = renderDialog();
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Buat kode baru" }));

      const list = await screen.findByTestId("backup-codes-list", undefined, SLOW);
      expect(list.querySelectorAll("li")).toHaveLength(MOCK_BACKUP_CODES.length);
      expect(screen.queryByText(MOCK_BACKUP_CODES[0])).toBeNull();

      const done = screen.getByRole("button", { name: "Selesai" });
      expect(done).toBeDisabled();
      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      fireEvent.click(done);
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe("negative", () => {
    test("a wrong password shows no codes", async () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "nope" } });
      fireEvent.click(screen.getByRole("button", { name: "Buat kode baru" }));
      expect(await screen.findByText("Kata sandi salah.", undefined, SLOW)).toBeInTheDocument();
      expect(screen.queryByTestId("backup-codes-list")).toBeNull();
    });
  });

  describe("edge case", () => {
    test("2FA turned off elsewhere → the sentence, and the profile copy follows", async () => {
      resetMockTwoFactor();
      renderDialog();
      fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "Demo1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Buat kode baru" }));
      expect(await screen.findByText("2FA belum aktif di akun ini.", undefined, SLOW)).toBeInTheDocument();
      expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(false);
    });
  });
});
