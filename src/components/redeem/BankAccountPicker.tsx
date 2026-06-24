"use client";

// Saved bank-account picker for the redeem "To this bank account" field
// (USDX-261, week3.md § Bank Account Book). Parity with the mint address-book
// picker: list saved payout accounts (GET /v2/bank-accounts), select one to apply
// to the form, delete per-entry, and open the "Add Bank Account" modal.
//
// Applying a selection (USDX-267): both an existing entry and a just-added one are
// applied as a SAVED account — the form keeps only the `bankAccountId` reference and
// shows a read-only summary (bank + masked number + name). The redeem create sends
// `bankAccountId`; the backend resolves the number/name from the entry, so the user
// never re-types the (only-ever-masked) number.

import { useState } from "react";
import { Check, Landmark, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AddBankAccountModal } from "./AddBankAccountModal";
import { useBankAccounts, useDeleteBankAccount } from "@/hooks/useBankAccounts";
import { getBankByCode } from "@/lib/banks";
import { useLang } from "@/providers/LanguageProvider";
import type { BankAccountEntry, SelectedBankAccount } from "@/types";

// Map a Bank Account Book entry → the saved-account snapshot the form holds.
function toSelected(entry: BankAccountEntry): SelectedBankAccount {
  return {
    id: entry.id,
    bankCode: entry.bankCode,
    accountNumberMasked: entry.accountNumberMasked,
    accountName: entry.accountName,
  };
}

interface BankAccountPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (account: SelectedBankAccount) => void;
}

export function BankAccountPicker({ open, onOpenChange, onApply }: BankAccountPickerProps) {
  const { t } = useLang();
  const { data: entries, isLoading } = useBankAccounts();
  const deleteMutation = useDeleteBankAccount();

  const [addOpen, setAddOpen] = useState(false);
  // Two-step inline confirm so a stray click can't delete a saved account.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDelete(id: string) {
    deleteMutation
      .mutateAsync(id)
      .then(() => toast.success(t("bankbook.deleted")))
      .catch(() => toast.error(t("bankbook.deleteFailed")))
      .finally(() => setConfirmDeleteId(null));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-lg font-medium text-foreground">
          {t("bankbook.pickTitle")}
        </DialogTitle>
        <div className="mt-2 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries && entries.length > 0 ? (
            <ul className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
              {entries.map((entry) => {
                const bankName = getBankByCode(entry.bankCode)?.name ?? entry.bankCode;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApply(toSelected(entry));
                        onOpenChange(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Landmark className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {entry.label || bankName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {bankName} · {entry.accountNumberMasked} · {entry.accountName}
                        </span>
                      </span>
                    </button>

                    {confirmDeleteId === entry.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 text-xs text-muted-foreground">
                          {t("addrbook.deleteConfirm")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleteMutation.isPending}
                          aria-label={t("addrbook.deleteAria")}
                          className="flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deleteMutation.isPending}
                          aria-label={t("common.cancel")}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                        >
                          <X className="size-4" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label={t("addrbook.deleteAria")}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("bankbook.empty")}</p>
          )}

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-4" /> {t("bankbook.add")}
          </button>
        </div>

        <AddBankAccountModal
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={(entry) => {
            // Just added → apply it as a saved account (bankAccountId) and close the
            // picker too. No plaintext needed: the redeem create resolves the entry.
            onApply(toSelected(entry));
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
