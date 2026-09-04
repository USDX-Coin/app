"use client";

// "Add Bank Account" modal (USDX-261, week3.md § Bank Account Book). Adds a saved
// redeem payout account: POST /api/v2/bank-accounts. No inquiry at add (parity
// address book; the account is validated at POST /v2/redeem). On success the modal
// closes, the list refreshes (mutation invalidates BANK_ACCOUNTS_KEY), and the new
// entry is applied to the redeem form via onAdded (week3.md § Form Redeem + § Bank
// Account Book "auto-isi bank + nomor + nama"): a just-added account is the manual
// path — the returned entry carries the full number (un-mask 2026-06-25), so the form
// auto-fills the editable fields. An EXISTING saved account instead goes through
// `bankAccountId` (USDX-267).
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BankSelect } from "./BankSelect";
import { useAddBankAccount } from "@/hooks/useBankAccounts";
import {
  translateValidation,
  validateBankAccountNumber,
  validateBankAccountName,
} from "@/lib/validations";
import { hasErrorCode, isValidationError } from "@/lib/api/errors";
import { useLang } from "@/providers/LanguageProvider";
import type { BankAccountEntry } from "@/types";

const LABEL_MAX = 50;

interface AddBankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful add with the new entry — which now carries the full
   *  number (un-mask 2026-06-25), so it fills the form's manual fields (USDX-267). */
  onAdded: (entry: BankAccountEntry) => void;
}

export function AddBankAccountModal({ open, onOpenChange, onAdded }: AddBankAccountModalProps) {
  const { t } = useLang();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [label, setLabel] = useState("");
  const addMutation = useAddBankAccount();

  // Inline validity (errors only shown once the field has input, like MintForm).
  // Both validators return i18n keys, not sentences (finding D1).
  const numberError = accountNumber ? validateBankAccountNumber(accountNumber) : null;
  const nameError = accountName ? validateBankAccountName(accountName) : null;
  const numberErrorText = translateValidation(t, numberError);
  const nameErrorText = translateValidation(t, nameError);
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
        onAdded(entry);
        reset();
        onOpenChange(false);
      })
      // Failure surfaces via `submitError`; swallow the rejection.
      .catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("bankbook.addTitle")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="gap-4">
          {/* Bank */}
          <Field>
            <FieldLabel>{t("form.bank")}</FieldLabel>
            <BankSelect value={bankCode} onSelect={setBankCode} />
          </Field>

          {/* Account number */}
          <Field>
            <FieldLabel htmlFor="bank-number">{t("modal.accountNumber")}</FieldLabel>
            <Input
              id="bank-number"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={t("modal.accountNumberPh")}
              autoComplete="off"
              aria-invalid={!!numberErrorText}
            />
            <FieldHelp id="bank-number" error={numberErrorText} />
          </Field>

          {/* Holder name */}
          <Field>
            <FieldLabel htmlFor="bank-name">{t("modal.holderName")}</FieldLabel>
            <Input
              id="bank-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={t("modal.holderNamePh")}
              autoComplete="off"
              aria-invalid={!!nameErrorText}
            />
            <FieldHelp id="bank-name" error={nameErrorText} />
          </Field>

          {/* Label (optional, max 50) */}
          <Field>
            <FieldLabel htmlFor="bank-label">{t("bankbook.fieldLabel")}</FieldLabel>
            <Input
              id="bank-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("bankbook.fieldLabelPh")}
              maxLength={LABEL_MAX}
            />
          </Field>

          {/* A failed submit stays inside the dialog: the form that produced the
              error is the only place the fix can happen. */}
          {submitError && <Alert tone="danger">{submitError}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={addMutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={handleAdd}
            disabled={!isValid}
            loading={addMutation.isPending}
            loadingLabel={t("common.processing")}
          >
            {t("bankbook.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
