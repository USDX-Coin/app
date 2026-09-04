"use client";

// Saved bank-account picker for the redeem "To this bank account" field
// (USDX-261, week3.md § Bank Account Book). Parity with the mint address-book
// picker: list saved payout accounts (GET /v2/bank-accounts), select one to apply
// to the form, delete per-entry, and open the "Add Bank Account" modal.
//
// Two-path apply (USDX-267, week3.md § Form Redeem + § Bank Account Book):
// - Selecting an EXISTING entry → "saved" fill: only `bankAccountId` is sent at
//   redeem create (number/name resolved server-side) and the form shows a read-only
//   summary — the number is never re-typed (the owner sees it in full, un-mask 2026-06-25).
// - A JUST-ADDED entry (modal) → "manual" fill: the user just typed the plaintext,
//   so the form auto-fills the editable bank/number/name fields (manual path).

import { useState } from "react";
import { Check, Landmark, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { AddBankAccountModal } from "./AddBankAccountModal";
import { useBankAccounts, useDeleteBankAccount } from "@/hooks/useBankAccounts";
import { useLang } from "@/providers/LanguageProvider";
import type { BankAccountEntry, SelectedBankAccount } from "@/types";

// What the picker hands back to the form: an existing entry (saved path,
// bankAccountId) or a just-added one with its plaintext number (manual path).
export type BankFill =
  | { mode: "saved"; account: SelectedBankAccount }
  | { mode: "manual"; bankCode: string; accountNumber: string; accountName: string };

// Map a Bank Account Book entry → the saved-account snapshot the form holds.
function toSelected(entry: BankAccountEntry): SelectedBankAccount {
  return {
    id: entry.id,
    bankCode: entry.bankCode,
    bankName: entry.bankName,
    accountNumber: entry.accountNumber,
    accountName: entry.accountName,
  };
}

interface BankAccountPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (fill: BankFill) => void;
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
      {/* `lg` because a row here carries three values — bank, number, holder —
          and wrapping them onto three lines is what makes a saved account hard
          to recognise at a glance. The body scrolls; "Tambah rekening" stays
          pinned in the footer (A8). */}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("bankbook.pickTitle")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="gap-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5 text-muted-text" aria-label={t("common.processing")} />
            </div>
          ) : entries && entries.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {entries.map((entry) => {
                const bankName = entry.bankName;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 rounded-xl border border-border p-2 transition-control pointer-fine:hover:bg-accent"
                  >
                    {/* Ghost with its own hover switched off: the row (`li`) owns
                        the hover, and a second layer would light up only the left
                        half of a row the user is pointing at as a whole. */}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onApply({ mode: "saved", account: toSelected(entry) });
                        onOpenChange(false);
                      }}
                      className="h-auto min-w-0 shrink flex-1 justify-start gap-3 p-1 text-left pointer-fine:hover:bg-transparent active:bg-transparent"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
                        <Landmark className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {entry.label || bankName}
                        </span>
                        <span className="truncate text-xs text-muted-text">
                          {bankName} · {entry.accountNumber} · {entry.accountName}
                        </span>
                      </span>
                    </Button>

                    {confirmDeleteId === entry.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 text-xs text-muted-text">
                          {t("addrbook.deleteConfirm")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(entry.id)}
                          loading={deleteMutation.isPending}
                          aria-label={t("addrbook.deleteAria")}
                          className="text-destructive-text pointer-fine:hover:bg-destructive/10"
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deleteMutation.isPending}
                          aria-label={t("common.cancel")}
                          className="text-muted-text"
                        >
                          <X />
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label={t("addrbook.deleteAria")}
                        className="shrink-0 text-muted-text pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive-text"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty className="min-h-40 py-4">
              <EmptyHeader>
                <EmptyMedia kind="empty">
                  <Landmark />
                </EmptyMedia>
                <EmptyTitle>{t("bankbook.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("bankbook.emptyDesc")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => setAddOpen(true)}>
            <Plus /> {t("bankbook.add")}
          </Button>
        </DialogFooter>

        <AddBankAccountModal
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={(entry) => {
            // Just added → manual fill: the entry now carries the full number
            // (un-mask 2026-06-25, USDX-270), so use it directly. Close the picker
            // too; auto-fills the form's editable bank/number/name fields.
            onApply({
              mode: "manual",
              bankCode: entry.bankCode,
              accountNumber: entry.accountNumber,
              accountName: entry.accountName,
            });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
