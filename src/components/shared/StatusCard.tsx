"use client";

import { Hourglass } from "lucide-react";
import { useLang } from "@/providers/LanguageProvider";
import type { SummaryRow } from "./ConfirmationCard";

function Row({ label, value }: SummaryRow) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-foreground">{value}</span>
    </div>
  );
}

export function StatusCard({
  title,
  network,
  requestId,
  submitted,
  rows,
  receiveLabel,
  receiveValue,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  network?: string;
  requestId: string;
  submitted: string;
  rows: SummaryRow[];
  receiveLabel: string;
  receiveValue: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Hourglass className="size-9 text-gold" />
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("status.genericDesc", { network: network ?? "" })}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-5">
        <Row label={t("status.requestId")} value={requestId} />
        <Row label={t("status.submittedAt")} value={submitted} />
        <Row
          label={t("status.status")}
          value={
            <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              {t("status.pending")}
            </span>
          }
        />
        <p className="pt-1 text-base font-medium text-foreground">{t("sum.title")}</p>
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-medium text-foreground">{receiveLabel}</span>
          <span className="text-base font-semibold text-foreground">{receiveValue}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="brand-gradient flex h-[42px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-white"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}
