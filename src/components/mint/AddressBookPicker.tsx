"use client";

// Picker for the mint "To" field (USDX-201): select a saved destination wallet
// from the address book (GET /v2/address-book). The "Add Wallet" create flow
// lands in USDX-203 — the add button is a disabled placeholder here.

import { BookText, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAddressBook } from "@/hooks/useAddressBook";
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
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(entry.address);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("addrbook.empty")}</p>
          )}

          {/* "Add Wallet" create flow lands in USDX-203 — disabled for now. */}
          <button
            type="button"
            disabled
            title={t("addrbook.addSoon")}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground opacity-60"
          >
            <Plus className="size-4" /> {t("addrbook.add")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
