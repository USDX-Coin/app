"use client";

import { useLang } from "@/providers/LanguageProvider";

export interface SummaryRow {
  label: string;
  value: React.ReactNode;
}

function Row({ label, value }: SummaryRow) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ConfirmationCard({
  rows,
  receiveLabel,
  receiveValue,
  onCancel,
  onConfirm,
  loading = false,
}: {
  rows: SummaryRow[];
  receiveLabel: string;
  receiveValue: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const { t } = useLang();
  return (
    <div className="flex w-full max-w-[500px] flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-medium text-foreground">{t("sum.title")}</h2>
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-base font-medium text-foreground">{receiveLabel}</span>
          <span className="text-base font-semibold text-foreground">{receiveValue}</span>
        </div>
      </div>

      <div className="rounded-lg bg-[#eef4fb] p-3 text-sm text-foreground dark:bg-[#13243d]">
        <span className="font-semibold">{t("confirm.note")}</span> {t("confirm.noteGeneric")}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {loading ? t("common.processing") : t("btn.confirmProceed")}
        </button>
      </div>
    </div>
  );
}
