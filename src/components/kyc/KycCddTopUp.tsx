"use client";

import { Alert } from "@/components/ui/alert";
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
      {/* Tanpa `disabled:opacity-60` — alasan sama dengan form penuh (papan `40`
          B3-5): varian disabled tiap kontrol sudah menggambar keadaannya, dan
          60 % di atas 50 % menghasilkan 30 %. */}
      <fieldset disabled={submitting} className="flex flex-col gap-4">
        {/* `role="status"` overrides the Alert default `role="alert"`: this notice
            is present from the first paint, and an assertive role would make a
            screen reader interrupt itself on page load over an invitation. */}
        <Alert tone="info" role="status" title={t("kyc.cdd.topup.title")}>
          <span className="block">{t("kyc.cdd.topup.body")}</span>
          {/* Load-bearing sentence, not decoration: it is the difference between
              an invitation and an ultimatum. Asserted by kyc-cdd-topup.spec.ts. */}
          <span className="mt-2 block font-medium">{t("kyc.cdd.topup.noGate")}</span>
        </Alert>

        <KycCddFields form={form} errors={errors} onChange={onChange} />

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={submitting}
          loadingLabel={t("kyc.cdd.topup.saving")}
        >
          {t("kyc.cdd.topup.submit")}
        </Button>
      </fieldset>
    </form>
  );
}
