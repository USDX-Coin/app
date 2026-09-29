import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { BackupCodesPanel } from "@/components/settings/BackupCodesPanel";

// Backup codes are shown ONCE (two-factor.yaml § TwoFactorEnroll /
// regenerateBackupCodes, USDX-714): the panel lists them, copies them, downloads
// them as a text file, and asks the user to confirm they saved them.

const CODES = ["K7QM2-X8WP4", "R3TN9-B2LC6", "H5VD1-Q9ZK3"];

function renderPanel(saved = false) {
  const onSavedChange = vi.fn();
  render(
    <LanguageProvider>
      <BackupCodesPanel codes={CODES} saved={saved} onSavedChange={onSavedChange} />
    </LanguageProvider>,
  );
  return { onSavedChange };
}

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  URL.createObjectURL = vi.fn(() => "blob:codes");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackupCodesPanel", () => {
  describe("positive", () => {
    test("lists every code", () => {
      renderPanel();
      for (const code of CODES) expect(screen.getByText(code)).toBeInTheDocument();
    });

    test("copy puts all codes on the clipboard, one per line", async () => {
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Salin" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(CODES.join("\n")));
      expect(await screen.findByRole("button", { name: "Tersalin" })).toBeInTheDocument();
    });

    test("download saves a text file with the codes", async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Unduh" }));

      expect(click).toHaveBeenCalledTimes(1);
      const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
      expect(blob.type).toBe("text/plain");
      const text = await blob.text();
      for (const code of CODES) expect(text).toContain(code);
    });

    test("ticking 'I have saved' reports it", () => {
      const { onSavedChange } = renderPanel();
      fireEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" }));
      expect(onSavedChange).toHaveBeenCalledWith(true);
    });
  });

  describe("negative", () => {
    test("a refused clipboard does not claim 'copied'", async () => {
      writeText.mockRejectedValueOnce(new Error("denied"));
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Salin" }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(screen.queryByRole("button", { name: "Tersalin" })).toBeNull();
    });
  });

  describe("edge case", () => {
    test("the checkbox follows the parent's value", () => {
      renderPanel(true);
      expect(screen.getByRole("checkbox", { name: "Saya sudah menyimpan backup code" })).toBeChecked();
    });
  });
});
