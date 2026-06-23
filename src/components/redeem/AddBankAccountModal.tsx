"use client";

// "Add Bank Account" modal (USDX-261, week3.md § Bank Account Book). Adds a saved
// redeem payout account: POST /api/v2/bank-accounts. No inquiry at add (parity
// address book; the account is validated at POST /v2/redeem). On success the modal
// closes, the list refreshes (mutation invalidates BANK_ACCOUNTS_KEY), and the new
// account is applied to the redeem form via onAdded — with the plaintext number
// the user just typed, so the redeem form can autofill it fully.
//
// - Bank: required (BankSelect, same options as the redeem bank field).
// - Account Number: required, 6–20 digits (validateBankAccountNumber).
// - Holder Name: required, ≥ 2 chars (validateBankAccountName).
// - Label: optional, max 50 chars.
// - Add: disabled until bank + number + name are valid.
// - 409 BANK_ACCOUNT_ALREADY_EXISTS → inline; 422 VALIDATION_ERROR → inline;
//   other failures → generic inline error.

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BankSelect } from "./BankSelect";
import { useAddBankAccount } from "@/hooks/useBankAccounts";
import { validateBankAccountNumber, validateBankAccountName } from "@/lib/validations";
import { hasErrorCode, isValidationError } from "@/lib/api/errors";
import { useLang } from "@/providers/LanguageProvider";
import type { BankAccountEntry } from "@/types";

const LABEL_MAX = 50;

interface AddBankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful add, with the new entry + the plaintext number. */
  onAdded: (entry: BankAccountEntry, accountNumber: string) => void;
}

export function AddBankAccountModal({ open, onOpenChange, onAdded }: AddBankAccountModalProps) {
  const { t } = useLang();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [label, setLabel] = useState("");
  const addMutation = useAddBankAccount();

  // Inline validity (errors only shown once the field has input, like MintForm).
  const numberError = accountNumber ? validateBankAccountNumber(accountNumber) : null;
  const nameError = accountName ? validateBankAccountName(accountName) : null;
  const isValid =
    bankCode !== "" &&
    accountNumber.trim() !== "" &&
    accountName.trim() !== "" &&
    !numberError &&
    !nameError &&
    label.trim().length <= LABEL_MAX;

  const submitError = addMutation.error
    ? hasErrorCode(addMutation.error, "BANK_ACCOUNT_ALREADY_EXISTS")
      ? t("bankbook.errDuplicate")
      : isValidationError(addMutation.error)
        ? t("bankbook.errValidation")
        : t("bankbook.errGeneric")
    : null;

  function reset() {
    setBankCode("");
    setAccountNumber("");
    setAccountName("");
    setLabel("");
    addMutation.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleAdd() {
    if (!isValid || addMutation.isPending) return;
    const number = accountNumber.trim();
    addMutation
      .mutateAsync({
        bankCode,
        accountNumber: number,
        accountName: accountName.trim(),
        label: label.trim() || undefined,
      })
      .then((entry) => {
        toast.success(t("bankbook.added"));
        onAdded(entry, number);
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
          {t("bankbook.addTitle")}
        </DialogTitle>

        <div className="mt-2 flex flex-col gap-4">
          {/* Bank */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("form.bank")}</span>
            <BankSelect value={bankCode} onSelect={setBankCode} />
          </div>

          {/* Account number */}
          <div className="flex flex-col gap-2">
            <label htmlFor="bank-number" className="text-sm font-medium text-muted-foreground">
              {t("modal.accountNumber")}
            </label>
            <input
              id="bank-number"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={t("modal.accountNumberPh")}
              autoComplete="off"
              className="rounded-md bg-muted p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {numberError && <p className="text-sm text-destructive">{numberError}</p>}
          </div>

          {/* Holder name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="bank-name" className="text-sm font-medium text-muted-foreground">
              {t("modal.holderName")}
            </label>
            <input
              id="bank-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={t("modal.holderNamePh")}
              autoComplete="off"
              className="rounded-md bg-muted p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          {/* Label (optional, max 50) */}
          <div className="flex flex-col gap-2">
            <label htmlFor="bank-label" className="text-sm font-medium text-muted-foreground">
              {t("bankbook.fieldLabel")}
            </label>
            <input
              id="bank-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("bankbook.fieldLabelPh")}
              maxLength={LABEL_MAX}
              className="rounded-md bg-muted p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
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
              {addMutation.isPending ? t("common.processing") : t("bankbook.submit")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
