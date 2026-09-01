"use client";

import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/providers/LanguageProvider";
import { KycCddFields } from "./KycCddFields";
import type { CddErrorField, CddFormState } from "@/lib/kyc/cdd";

// CDD top-up for an ALREADY-VERIFIED customer (USDX-545, Wisnu 27 Aug 2026).
//
// These customers passed KYC under the standard in force at the time — KTP,
// selfie, Disdukcapil — and were simply never asked the due-diligence questions.
// So this view:
//   - asks for the CDD BLOCK AND NOTHING ELSE (tujuh field, jadi sebelas sejak
//     USDX-586). Identitas sudah diterima; memintanya lagi berarti memperlakukan
//     top-up sebagai pengajuan ulang. Lima field identitas baru USDX-586 SENGAJA
//     tidak ada di sini: kontraknya menaruhnya di `SubmitKycRequest`, dan
//     `PATCH /api/v2/kyc/cdd` tidak boleh berkuasa mengubah identitas yang sudah
//     disetujui tanpa review — lubang yang sudah diketahui, jalurnya keputusan PM
//     (pengkinian data berkala Pasal 51).
//   - submits through `submitCdd` (PATCH /api/v2/kyc/cdd), never through the full
//     KYC submit, so the customer's VERIFIED status and submission_count are
//     untouched. See lib/kyc/form-mode.ts.
//   - INFORMS rather than threatens. Nothing is gated on this: the customer keeps
//     full access and can keep transacting, and the notice says so explicitly. If
//     this copy ever turns into "complete it or your account is limited", that is
//     not the decision that was made.

export interface KycCddTopUpProps {
  form: CddFormState;
  errors: Partial<Record<CddErrorField, string | undefined>>;
  onChange: <K extends keyof CddFormState>(key: K, value: CddFormState[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function KycCddTopUp({ form, errors, onChange, onSubmit, submitting }: KycCddTopUpProps) {
  const { t } = useLang();

  return (
    <form onSubmit={onSubmit} data-testid="kyc-cdd-topup">
      <fieldset disabled={submitting} className="space-y-4 disabled:opacity-60">
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sky-900 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <Info className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">{t("kyc.cdd.topup.title")}</p>
            <p className="mt-1 text-sm opacity-90">{t("kyc.cdd.topup.body")}</p>
            {/* Load-bearing sentence, not decoration: it is the difference between
                an invitation and an ultimatum. Asserted by kyc-cdd-topup.spec.ts. */}
            <p className="mt-2 text-sm font-medium">{t("kyc.cdd.topup.noGate")}</p>
          </div>
        </div>

        <KycCddFields form={form} errors={errors} onChange={onChange} />

        <Button type="submit" disabled={submitting} className="w-full brand-gradient text-white">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("kyc.cdd.topup.saving")}
            </>
          ) : (
            t("kyc.cdd.topup.submit")
          )}
        </Button>
      </fieldset>
    </form>
  );
}
