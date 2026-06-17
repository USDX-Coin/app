"use client";

// Picker for the mint "To" field (USDX-201): select a saved destination wallet
// from the address book (GET /v2/address-book). USDX-203 wires the "Add Wallet"
// create modal (the bottom button) and per-entry delete (DELETE /v2/address-book/{id}).

import { useState } from "react";
import { BookText, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AddWalletModal } from "@/components/mint/AddWalletModal";
import { useAddressBook, useDeleteAddressBook } from "@/hooks/useAddressBook";
import { truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

interface AddressBookPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (address: string) => void;
}

export function AddressBookPicker({ open, onOpenChange, onSelect }: AddressBookPickerProps) {
  const { t } = useLang();
  const { data: entries, isLoading } = useAddressBook();
  const deleteMutation = useDeleteAddressBook();

  const [addOpen, setAddOpen] = useState(false);
  // Two-step inline confirm so a stray click can't delete a saved wallet.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDelete(id: string) {
    deleteMutation
      .mutateAsync(id)
      .then(() => toast.success(t("addrbook.deleted")))
      .catch(() => toast.error(t("addrbook.deleteFailed")))
      .finally(() => setConfirmDeleteId(null));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-lg font-medium text-foreground">
          {t("addrbook.pickTitle")}
        </DialogTitle>
        <div className="mt-2 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries && entries.length > 0 ? (
            <ul className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(entry.address);
                      onOpenChange(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <BookText className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {entry.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {truncateAddress(entry.address)}
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
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("addrbook.empty")}</p>
          )}

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-4" /> {t("addrbook.add")}
          </button>
        </div>

        <AddWalletModal
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={(address) => {
            // Success: pick the new address into "To" and close the picker too.
            onSelect(address);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
