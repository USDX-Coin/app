import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { PinConfirmDialog } from "@/components/shared/PinConfirmDialog";

// PIN dialog (USDX-567) — the one approval step on the custodial money paths.
// The dialog owns only the shape check; the caller maps the API answer into
// `errorKey` / `cooldownSeconds`. The QueryClient is for the "no PIN yet" state,
// whose notice hosts the create-PIN dialog (USDX-651).
function renderDialog(props: Partial<React.ComponentProps<typeof PinConfirmDialog>> = {}) {
  const Wrapper = createWrapper();
  const onSubmit = vi.fn();
  const utils = render(
    <Wrapper>
      <LanguageProvider>
        <PinConfirmDialog open onOpenChange={() => {}} onSubmit={onSubmit} {...props} />
      </LanguageProvider>
    </Wrapper>,
  );
  return { ...utils, onSubmit };
}

describe("PinConfirmDialog", () => {
  describe("positive", () => {
    test("submits the 6-digit PIN", () => {
      const { onSubmit } = renderDialog();
      const input = screen.getByLabelText("PIN 6 digit");
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi" }));
      expect(onSubmit).toHaveBeenCalledWith("123456");
    });

    test("shows what is being approved", () => {
      renderDialog({ description: "Kirim 25 USDX ke 0x5aAe…BeAed" });
      expect(screen.getByText("Kirim 25 USDX ke 0x5aAe…BeAed")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("confirm stays disabled until six digits are typed; letters are dropped", () => {
      const { onSubmit } = renderDialog();
      const input = screen.getByLabelText("PIN 6 digit") as HTMLInputElement;
      const confirm = screen.getByRole("button", { name: "Konfirmasi" });
      expect(confirm).toBeDisabled();
      fireEvent.change(input, { target: { value: "12ab34" } });
      expect(input.value).toBe("1234");
      expect(confirm).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test("renders the caller's error key inline", () => {
      renderDialog({ errorKey: "pin.errInvalid" });
      expect(screen.getByRole("alert")).toHaveTextContent("PIN salah. Coba lagi.");
    });

    test("PIN not set → warning with a Create PIN button instead of an input", () => {
      const { onSubmit } = renderDialog({ pinNotSet: true });
      expect(screen.queryByLabelText("PIN 6 digit")).toBeNull();
      expect(screen.getByRole("alert")).toHaveTextContent(/belum punya PIN/);
      // Copy tanpa jargon (USDX-651 AC): "wallet USDX", bukan "custodial".
      expect(screen.getByRole("alert")).not.toHaveTextContent(/custodial/i);
      expect(screen.getByRole("button", { name: "Konfirmasi" })).toBeDisabled();
      // The way out is right there (USDX-651): the notice opens the create-PIN dialog.
      fireEvent.click(screen.getByRole("button", { name: "Buat PIN" }));
      expect(screen.getByRole("heading", { name: "Buat PIN" })).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("lockout: countdown shown, input and confirm disabled", () => {
      renderDialog({ cooldownSeconds: 900 });
      expect(screen.getByLabelText("PIN 6 digit")).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(/15 menit/);
      expect(screen.getByRole("button", { name: "Konfirmasi" })).toBeDisabled();
    });

    test("cannot be dismissed while submitting", () => {
      const onOpenChange = vi.fn();
      renderDialog({ isSubmitting: true, onOpenChange });
      expect(screen.queryByRole("button", { name: "Batal" })).toBeDisabled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
