import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { PinConfirmDialog } from "@/components/shared/PinConfirmDialog";

// The create-PIN dialog inside the "no PIN yet" notice carries a re-login button
// (USDX-697), which needs the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

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
    test("submits the 6-digit PIN with the authenticator code (USDX-717)", () => {
      const { onSubmit } = renderDialog();
      const input = screen.getByLabelText("PIN 6 digit");
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.change(screen.getByLabelText("Kode authenticator"), { target: { value: "492817" } });
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi" }));
      expect(onSubmit).toHaveBeenCalledWith("123456", "492817");
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

// Pintu lupa-PIN (custodial-wallet.md §5.1 "Lupa PIN di web", USDX-696): tautan
// di dialog PIN transaksi, termasuk saat terkunci hitung mundur — user yang
// terkunci justru yang paling butuh jalan keluar.
describe("PinConfirmDialog — Forgot PIN door", () => {
  describe("positive", () => {
    test("the PIN input carries a 'Lupa PIN?' link that opens the log-in-again step", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Lupa PIN?" }));
      expect(screen.getByTestId("forgot-pin-dialog")).toHaveTextContent("Login ulang");
    });
  });

  describe("negative", () => {
    test("no PIN on the account → nothing to forget, no link (the notice creates one)", () => {
      renderDialog({ pinNotSet: true });
      expect(screen.queryByRole("button", { name: "Lupa PIN?" })).not.toBeInTheDocument();
    });
  });

  describe("edge case", () => {
    test("locked out: the link is still there and usable while the input is disabled", () => {
      renderDialog({ cooldownSeconds: 900 });
      expect(screen.getByLabelText("PIN 6 digit")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Lupa PIN?" })).toBeEnabled();
    });

    test("while the PIN is on its way the link is disabled — leaving mid-request is not offered", () => {
      renderDialog({ isSubmitting: true });
      expect(screen.getByRole("button", { name: "Lupa PIN?" })).toBeDisabled();
    });
  });
});

// Kolom kode authenticator di bawah PIN (custodial-wallet.md §6.1, USDX-717): 6 digit
// TOTP, atau backup code lewat "Pakai backup code". Galat kode tampil di kolom kode;
// PIN tidak dikosongkan. Lockout `2fa-stepup` punya kalimatnya sendiri.
function typePin(value = "123456") {
  fireEvent.change(screen.getByLabelText("PIN 6 digit"), { target: { value } });
}

describe("PinConfirmDialog — authenticator code", () => {
  describe("positive", () => {
    test("'Pakai backup code' switches to a backup-code field that keeps letters and dashes", () => {
      const { onSubmit } = renderDialog();
      typePin();
      fireEvent.click(screen.getByRole("button", { name: "Pakai backup code" }));
      const backup = screen.getByLabelText("Backup code") as HTMLInputElement;
      fireEvent.change(backup, { target: { value: "AbC12-xYz89" } });
      expect(backup.value).toBe("AbC12-xYz89");
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi" }));
      expect(onSubmit).toHaveBeenCalledWith("123456", "AbC12-xYz89");
    });

    test("the way back to the app code is right there", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Pakai backup code" }));
      fireEvent.click(screen.getByRole("button", { name: "Pakai kode authenticator" }));
      expect(screen.getByLabelText("Kode authenticator")).toBeInTheDocument();
    });
  });

  describe("negative", () => {
    test("confirm stays disabled until the code has six digits; letters are dropped", () => {
      const { onSubmit } = renderDialog();
      typePin();
      const code = screen.getByLabelText("Kode authenticator") as HTMLInputElement;
      const confirm = screen.getByRole("button", { name: "Konfirmasi" });
      expect(confirm).toBeDisabled();
      fireEvent.change(code, { target: { value: "49a28" } });
      expect(code.value).toBe("4928");
      expect(confirm).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test("the caller's code error shows under the code field; the PIN stays filled", () => {
      renderDialog({ twoFactorErrorKey: "stepUp.errInvalid" });
      typePin();
      const code = screen.getByLabelText("Kode authenticator");
      expect(code).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Kode authenticator salah");
      expect((screen.getByLabelText("PIN 6 digit") as HTMLInputElement).value).toBe("123456");
      expect(screen.getByLabelText("PIN 6 digit")).toHaveAttribute("aria-invalid", "false");
    });
  });

  describe("edge case", () => {
    test("2FA lockout: its own countdown sentence on the code field, confirm disabled, PIN untouched", () => {
      renderDialog({ twoFactorCooldownSeconds: 900 });
      typePin();
      expect(screen.getByLabelText("Kode authenticator")).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(/kode authenticator yang salah.*15 menit/);
      expect(screen.getByRole("alert")).not.toHaveTextContent(/percobaan/);
      expect(screen.getByLabelText("PIN 6 digit")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Konfirmasi" })).toBeDisabled();
    });

    test("switching between app code and backup code clears what was typed", () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText("Kode authenticator"), { target: { value: "492817" } });
      fireEvent.click(screen.getByRole("button", { name: "Pakai backup code" }));
      expect((screen.getByLabelText("Backup code") as HTMLInputElement).value).toBe("");
    });
  });
});
