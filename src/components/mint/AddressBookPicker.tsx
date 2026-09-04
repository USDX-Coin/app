"use client";

// Picker for the mint "To" field (USDX-201): select a saved destination wallet
// from the address book (GET /v2/address-book). USDX-203 wires the "Add Wallet"
// create modal (the bottom button) and per-entry delete (DELETE /v2/address-book/{id}).

import { useState } from "react";
import { BookText, Check, Plus, Trash2, X } from "lucide-react";
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
      {/* A long list is the reason the dialog has a max height at all: twelve
          entries used to push "Tambah wallet" off the bottom of the screen with
          nothing to scroll (A8). The list scrolls with the body now, so the
          footer button is always where the user left it. */}
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("addrbook.pickTitle")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="gap-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5 text-muted-text" aria-label={t("common.processing")} />
            </div>
          ) : entries && entries.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {entries.map((entry) => (
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
                      onSelect(entry.address);
                      onOpenChange(false);
                    }}
                    className="h-auto min-w-0 shrink flex-1 justify-start gap-3 p-1 text-left pointer-fine:hover:bg-transparent active:bg-transparent"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-text">
                      <BookText className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {entry.label}
                      </span>
                      <span className="truncate text-xs text-muted-text">
                        {truncateAddress(entry.address)}
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
              ))}
            </ul>
          ) : (
            <Empty className="min-h-40 py-4">
              <EmptyHeader>
                <EmptyMedia kind="empty">
                  <BookText />
                </EmptyMedia>
                <EmptyTitle>{t("addrbook.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("addrbook.emptyDesc")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => setAddOpen(true)}>
            <Plus /> {t("addrbook.add")}
          </Button>
        </DialogFooter>

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
