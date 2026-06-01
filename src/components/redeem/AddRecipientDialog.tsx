"use client";

import { useState } from "react";
import { Landmark, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLang } from "@/providers/LanguageProvider";

interface AddRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BANKS = ["Mandiri", "BCA", "BNI", "BRI", "CIMB Niaga", "Permata"];
const EWALLETS = ["OVO", "GoPay", "DANA", "ShopeePay", "LinkAja"];

type AccountType = "bank" | "ewallet";

export function AddRecipientDialog({ open, onOpenChange }: AddRecipientDialogProps) {
  const { t } = useLang();
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [provider, setProvider] = useState(BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");

  const providers = accountType === "bank" ? BANKS : EWALLETS;

  function selectType(type: AccountType) {
    setAccountType(type);
    setProvider(type === "bank" ? BANKS[0] : EWALLETS[0]);
  }

  function handleConfirm() {
    if (!accountNumber || !holderName) {
      toast.error("Please fill all fields");
      return;
    }
    toast.success(`Recipient "${holderName}" added`);
    setAccountNumber("");
    setHolderName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-4 border-white/20 p-0 sm:max-w-[520px]">
        <div className="border-b border-border p-4">
          <DialogTitle className="text-base font-medium text-foreground">{t("modal.addRecipient")}</DialogTitle>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t("modal.accountType")}</p>
            <div className="flex gap-2">
              <TypeCard
                active={accountType === "bank"}
                onClick={() => selectType("bank")}
                icon={<Landmark className="size-5" />}
                label={t("modal.bankAccount")}
              />
              <TypeCard
                active={accountType === "ewallet"}
                onClick={() => selectType("ewallet")}
                icon={<Wallet className="size-5" />}
                label={t("modal.eWallet")}
              />
            </div>
          </div>

          <Field label={accountType === "bank" ? t("modal.bankName") : t("modal.ewalletProvider")}>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            >
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          <Field label={t("modal.accountNumber")}>
            <input
              inputMode="numeric"
              placeholder="999123458900"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </Field>

          <Field label={t("modal.holderName")}>
            <input
              placeholder="Pranatha W"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </Field>
        </div>

        <div className="flex gap-4 border-t border-border p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-[38px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="brand-gradient flex h-[38px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white"
          >
            {t("common.confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2.5 rounded-md bg-muted p-3">{children}</div>
    </div>
  );
}
