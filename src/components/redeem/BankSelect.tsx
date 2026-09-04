"use client";

// Destination bank dropdown for redeem (USDX-243). Lists the curated ID bank
// set (lib/banks.ts) and emits the selected `bankCode` — sent verbatim in
// POST /v2/redeem. There's no saved bank-account book; bank details are entered
// inline per order (redeem.yaml CreateRedeemOrder).
//
// This used to be a hand-rolled div + two `<button>`s: no `role`, no Escape, no
// arrow keys, and a menu positioned with `top-[calc(100%+4px)]` (findings C3,
// C12). It is now `ui/select.tsx` — 12 banks is under the 15-option threshold
// where a Select still beats a searchable combobox.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/providers/LanguageProvider";
import { BANKS } from "@/lib/banks";

interface BankSelectProps {
  value: string; // bankCode
  onSelect: (code: string) => void;
  id?: string;
  /** Set when the surrounding `Field` is showing an error. */
  "aria-invalid"?: boolean;
}

export function BankSelect({ value, onSelect, id, ...props }: BankSelectProps) {
  const { t } = useLang();

  return (
    // Radix treats "" as "no value", which is exactly what an unpicked bank is.
    <Select value={value || undefined} onValueChange={onSelect}>
      <SelectTrigger id={id} aria-label={t("form.selectBank")} {...props}>
        <SelectValue placeholder={t("form.selectBank")} />
      </SelectTrigger>
      <SelectContent>
        {BANKS.map((bank) => (
          <SelectItem key={bank.code} value={bank.code}>
            {bank.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
