"use client";

// "Add Wallet" modal (USDX-203, week2.md § Address Book). Adds a saved mint
// destination to the user's address book: POST /api/v2/address-book. On success
// the modal closes, the list refreshes (mutation invalidates ADDRESS_BOOK_KEY),
// and the new address is selected into the mint "To" field via onAdded().
//
// - Wallet Address: EVM, checksum-insensitive (validateAddress). Required.
// - Label: required, max 50 chars.
// - Add button: disabled until both fields are valid.
// - 409 ADDRESS_ALREADY_EXISTS → inline error; other failures → generic inline error.
// - The scan-QR icon is a deferred placeholder (functional scanner = follow-up).

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAddAddressBook } from "@/hooks/useAddressBook";
import { validateAddress } from "@/lib/validations";
import { hasErrorCode } from "@/lib/api/errors";
import { useLang } from "@/providers/LanguageProvider";

const LABEL_MAX = 50;

interface AddWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved address after a successful add. */
  onAdded: (address: string) => void;
}

export function AddWalletModal({ open, onOpenChange, onAdded }: AddWalletModalProps) {
  const { t } = useLang();
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const addMutation = useAddAddressBook();

  // Inline validity (errors only shown once the field has input, like MintForm).
  const addressError = address ? validateAddress(address.trim()) : null;
  const labelValid = label.trim().length > 0 && label.trim().length <= LABEL_MAX;
  const isValid = !addressError && address.trim() !== "" && labelValid;

  const submitError = addMutation.error
    ? hasErrorCode(addMutation.error, "ADDRESS_ALREADY_EXISTS")
      ? t("addrbook.errDuplicate")
      : t("addrbook.errGeneric")
    : null;

  function reset() {
    setAddress("");
    setLabel("");
    addMutation.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleAdd() {
    if (!isValid || addMutation.isPending) return;
    addMutation
      .mutateAsync({ address: address.trim(), label: label.trim() })
      .then((entry) => {
        toast.success(t("addrbook.added"));
        onAdded(entry.address);
        reset();
        onOpenChange(false);
      })
      // Failure surfaces via `submitError`; swallow the rejection.
      .catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogTitle className="text-base font-medium text-foreground">
          {t("addrbook.addTitle")}
        </DialogTitle>

        <div className="mt-2 flex flex-col gap-4">
          {/* Wallet Address + scan-QR icon (scanner deferred to a follow-up) */}
          <div className="flex flex-col gap-2">
            <label htmlFor="addr-address" className="text-sm font-medium text-muted-foreground">
              {t("addrbook.fieldAddress")}
            </label>
            <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
              <input
                id="addr-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addrbook.fieldAddressPh")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <ScanLine
                className="size-4 shrink-0 text-muted-foreground/50"
                aria-label={t("addrbook.scanSoon")}
              />
            </div>
            {addressError && <p className="text-sm text-destructive">{addressError}</p>}
          </div>

          {/* Label (required, max 50) */}
          <div className="flex flex-col gap-2">
            <label htmlFor="addr-label" className="text-sm font-medium text-muted-foreground">
              {t("addrbook.fieldLabel")}
            </label>
            <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">
              <input
                id="addr-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("addrbook.fieldLabelPh")}
                maxLength={LABEL_MAX}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={addMutation.isPending}
              className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isValid || addMutation.isPending}
              className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            >
              {addMutation.isPending ? t("common.processing") : t("addrbook.submit")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
