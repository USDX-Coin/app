"use client";

// "Add Wallet" modal (USDX-203, week2.md § Address Book). Adds a saved mint
// destination to the user's address book: POST /api/v2/address-book. On success
// the modal closes, the list refreshes (mutation invalidates ADDRESS_BOOK_KEY),
// and the new address is selected into the mint "To" field via onAdded().
//
// - Wallet Address: EVM, checksum-insensitive (validateAddress). Required.
// - Label: required, max 50 chars.
// - Add button: disabled until both fields are valid.
// - 409 ADDRESS_ALREADY_EXISTS → inline error; 422 VALIDATION_ERROR → inline
//   validation message (USDX-214); other failures → generic inline error.

import { useState } from "react";
import { ScanLine } from "lucide-react";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AddressScannerDialog } from "@/components/mint/AddressScannerDialog";
import { useAddAddressBook } from "@/hooks/useAddressBook";
import { translateValidation, validateAddress } from "@/lib/validations";
import { hasErrorCode, isValidationError } from "@/lib/api/errors";
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
  const [scanOpen, setScanOpen] = useState(false);
  const addMutation = useAddAddressBook();

  // Inline validity (errors only shown once the field has input, like MintForm).
  // `validateAddress` returns an i18n key, not a sentence (finding D1).
  const addressError = address ? validateAddress(address.trim()) : null;
  const addressErrorText = translateValidation(t, addressError);
  const labelValid = label.trim().length > 0 && label.trim().length <= LABEL_MAX;
  const isValid = !addressError && address.trim() !== "" && labelValid;

  const submitError = addMutation.error
    ? hasErrorCode(addMutation.error, "ADDRESS_ALREADY_EXISTS")
      ? t("addrbook.errDuplicate")
      : isValidationError(addMutation.error)
        ? t("addrbook.errValidation")
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
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("addrbook.addTitle")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="gap-4">
          {/* Wallet address + scan QR */}
          <Field>
            <FieldLabel htmlFor="addr-address">{t("addrbook.fieldAddress")}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="addr-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addrbook.fieldAddressPh")}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!addressErrorText}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon"
                  onClick={() => setScanOpen(true)}
                  aria-label={t("scan.open")}
                >
                  <ScanLine />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldHelp id="addr-address" error={addressErrorText} />
          </Field>

          {/* Label (required, max 50) */}
          <Field>
            <FieldLabel htmlFor="addr-label">{t("addrbook.fieldLabel")}</FieldLabel>
            <Input
              id="addr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("addrbook.fieldLabelPh")}
              maxLength={LABEL_MAX}
            />
          </Field>

          {/* A failed submit keeps the dialog open and stays inside it — a toast
              would take the message away from the form that produced it. */}
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
            {t("addrbook.submit")}
          </Button>
        </DialogFooter>

        <AddressScannerDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onScanned={(addr) => {
            setAddress(addr);
            addMutation.reset();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
