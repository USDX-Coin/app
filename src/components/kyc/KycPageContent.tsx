"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";
import { PAGE_HEADING_STICKY } from "@/components/shared/PageHeader";
import { KycStatusBanner } from "./KycStatusBanner";
import { KycCddFields } from "./KycCddFields";
import { KycCddTopUp } from "./KycCddTopUp";
import { KycPageSkeleton } from "./KycPageSkeleton";
import { useSessionUser } from "@/hooks/useSession";
import { useKyc, type KycDocState } from "@/hooks/useKyc";
import { useLang } from "@/providers/LanguageProvider";
import { emailVerificationGate } from "@/lib/auth/guards";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import type { PresignedDocKind } from "@/lib/api/types";
import {
  EMPTY_CDD_FORM,
  toCddPayload,
  validateCdd,
  type CddErrorField,
  type CddFormState,
} from "@/lib/kyc/cdd";
import { kycFormMode } from "@/lib/kyc/form-mode";
import { toast } from "sonner";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  dob: "",
  birthPlace: "",
  identityNumber: "",
  addressLine1: "",
  addressLine2: "",
};

// /kyc (USDX-152): status banner per state, eager per-file presigned upload with
// preview + loading, submit disabled until every field and both photos are in,
// REJECTED → "Submit Ulang" reactivates the form (unlimited resubmit per
// sot/phase-2/week1.md § Status Flow).
//
// USDX-545 adds the CDD block (occupation, source of funds, annual income,
// transaction purpose, PEP, NPWP) as a SECTION of this same single-step form.
//
// RESOLVED 27 Aug 2026 (Wisnu): a customer who is ALREADY VERIFIED but has no CDD
// on record is notified and allowed to complete it — not gated at transaction
// time, not left alone. They get `KycCddTopUp`: the seven CDD fields only, submitted
// through a separate endpoint that leaves their VERIFIED status alone. Which of the
// two forms (if either) a customer sees lives in `lib/kyc/form-mode.ts` — the rule
// "VERIFIED never gets the full form" is load-bearing, because the full form's
// submit sets status back to PENDING.
export function KycPageContent() {
  // The dashboard layout runs the /api/v2/auth/me fetch; this just reads it, plus
  // whether the answer is still on its way.
  const { user } = useSessionUser();
  const { t } = useLang();
  const {
    status,
    statusLoading,
    refreshStatus,
    docs,
    selectDoc,
    clearUploads,
    uploadsReady,
    uploadsBusy,
    submit,
    submitting,
    submitCdd,
    submittingCdd,
  } = useKyc();

  const [form, setForm] = useState(EMPTY_FORM);
  // CDD half of the same form. Separate state object because it has its own
  // value types (enums + boolean), not just strings.
  const [cdd, setCdd] = useState<CddFormState>(EMPTY_CDD_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // REJECTED state renders the banner only until the user opts into resubmitting.
  const [resubmitting, setResubmitting] = useState(false);

  const [gateBefore, gateAfter] = t("kyc.gate.body").split("{link}");

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setCddField<K extends keyof CddFormState>(key: K, value: CddFormState[K]) {
    setCdd((prev) => ({ ...prev, [key]: value }));
  }

  // Each CDD key maps to its OWN message naming that field ("Pekerjaan wajib
  // dipilih"), never one generic "please complete the form" — USDX-545 AC. Shared
  // by both submit paths so the two can never disagree about what is required.
  function cddErrorMessages(): Record<CddErrorField, string | undefined> {
    const cddErrors = validateCdd(cdd);
    return {
      occupation: cddErrors.occupation && t(cddErrors.occupation),
      sourceOfFunds: cddErrors.sourceOfFunds && t(cddErrors.sourceOfFunds),
      annualIncomeRange: cddErrors.annualIncomeRange && t(cddErrors.annualIncomeRange),
      transactionPurpose: cddErrors.transactionPurpose && t(cddErrors.transactionPurpose),
      pepRelation: cddErrors.pepRelation && t(cddErrors.pepRelation),
    };
  }

  // CDD-only top-up (already-VERIFIED customer). Calls `submitCdd`, NEVER
  // `submit` — the latter would move a verified customer back to PENDING.
  async function handleCddTopUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = cddErrorMessages();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    try {
      await submitCdd(toCddPayload(cdd));
      setCdd(EMPTY_CDD_FORM);
      toast.success(t("kyc.cdd.topup.saved"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("kyc.cdd.topup.failed")));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string | undefined> = {
      firstName: form.firstName.trim() ? undefined : t("kyc.err.firstName"),
      lastName: form.lastName.trim() ? undefined : t("kyc.err.lastName"),
      dob: form.dob ? undefined : t("kyc.err.dob"),
      birthPlace: form.birthPlace.trim() ? undefined : t("kyc.err.birthPlace"),
      identityNumber: /^\d{16}$/.test(form.identityNumber) ? undefined : t("kyc.err.nik"),
      addressLine1: form.addressLine1.trim() ? undefined : t("kyc.err.address"),
      ktp: docs.ktp.objectKey ? undefined : t("kyc.err.ktp"),
      selfie: docs.selfie.objectKey ? undefined : t("kyc.err.selfie"),
      ...cddErrorMessages(),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    try {
      await submit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        birthPlace: form.birthPlace.trim(),
        identityNumber: form.identityNumber,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || null,
        cdd: toCddPayload(cdd),
      });
      setResubmitting(false);
      setForm(EMPTY_FORM);
      setCdd(EMPTY_CDD_FORM);
      clearUploads();
      toast.success(t("kyc.submitted"));
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "KYC_IDENTITY_NUMBER_INVALID") {
          setErrors((prev) => ({ ...prev, identityNumber: t("kyc.err.nik") }));
          return;
        }
        if (err.code === "KYC_FILE_NOT_FOUND" || err.code === "KYC_FILE_INVALID") {
          clearUploads();
          toast.error(t("kyc.err.uploadFailed"));
          return;
        }
        if (err.status === 409) {
          // Race: already PENDING / VERIFIED (e.g. another tab) — re-sync the banner.
          refreshStatus();
          return;
        }
      }
      toast.error(getErrorMessage(err, t("kyc.failed")));
    }
  }

  // requireEmailVerified — Phase 1 users migrate via Forgot password.
  // Three-way on purpose: "unknown" means /auth/me has not answered yet, and a
  // verified customer must never see this gate just because their data is late.
  const emailGate = emailVerificationGate(user);

  if (emailGate === "blocked") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className={cn(PAGE_HEADING_STICKY, "text-2xl font-semibold text-foreground")}>
          {t("kyc.title")}
        </h1>
        <div
          role="alert"
          data-testid="kyc-email-gate"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {gateBefore}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            {t("kyc.gate.link")}
          </Link>
          {gateAfter}
        </div>
      </div>
    );
  }

  if (emailGate === "unknown" || statusLoading || !status) {
    return <KycPageSkeleton />;
  }

  // Form visibility per state (USDX-152 + USDX-545): UNVERIFIED active; PENDING
  // visible but disabled; REJECTED hidden until "Submit Ulang"; VERIFIED gets the
  // CDD-only top-up while its CDD is missing, and nothing once it is complete.
  const formDisabled = status.status === "PENDING" || submitting;
  const formMode = kycFormMode(status, resubmitting);
  const showForm = formMode === "full";

  // Unchanged from USDX-152: the identity block + both photos gate the button.
  // The CDD block is deliberately NOT part of this gate — a disabled button can
  // only say "something is missing", and USDX-545 requires an error that NAMES the
  // missing field. CDD is therefore checked on submit, where it can produce one
  // message per field.
  const allFilled =
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.dob !== "" &&
    form.birthPlace.trim() !== "" &&
    form.identityNumber.trim() !== "" &&
    form.addressLine1.trim() !== "" &&
    uploadsReady;

  return (
    // `w-full`: flex item of the dashboard scroll wrapper — `mx-auto` cancels the
    // default stretch, so the column would otherwise shrink to its content width.
    <div className="mx-auto w-full max-w-xl space-y-6">
      {/* Sticky so the long KYC form scrolls under its own title. */}
      <div className={PAGE_HEADING_STICKY}>
        <h1 className="text-2xl font-semibold text-foreground">{t("kyc.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("kyc.subtitle")}</p>
      </div>

      <KycStatusBanner
        status={status}
        onResubmit={() => setResubmitting(true)}
        resubmitActive={resubmitting}
      />

      {formMode === "cdd-only" && (
        <KycCddTopUp
          form={cdd}
          errors={errors}
          onChange={setCddField}
          onSubmit={handleCddTopUpSubmit}
          submitting={submittingCdd}
        />
      )}

      {showForm && (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={formDisabled} className="space-y-4 disabled:opacity-60">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">{t("kyc.firstName")}</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.firstName}
                />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName">{t("kyc.lastName")}</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.lastName}
                />
                <FieldError message={errors.lastName} />
              </div>
              <div>
                <Label htmlFor="dob">{t("kyc.dob")}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setField("dob", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.dob}
                />
                <FieldError message={errors.dob} />
              </div>
              <div>
                <Label htmlFor="birthPlace">{t("kyc.birthPlace")}</Label>
                <Input
                  id="birthPlace"
                  value={form.birthPlace}
                  onChange={(e) => setField("birthPlace", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.birthPlace}
                />
                <FieldError message={errors.birthPlace} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="identityType">{t("kyc.identityType")}</Label>
                <Input
                  id="identityType"
                  value="KTP"
                  readOnly
                  aria-readonly="true"
                  className="mt-1.5 bg-muted/50 text-muted-foreground"
                />
              </div>
              <div>
                <Label htmlFor="country">{t("kyc.country")}</Label>
                <Input
                  id="country"
                  value="ID"
                  readOnly
                  aria-readonly="true"
                  className="mt-1.5 bg-muted/50 text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="identityNumber">{t("kyc.identityNumber")}</Label>
              <Input
                id="identityNumber"
                inputMode="numeric"
                placeholder={t("kyc.identityNumberPh")}
                value={form.identityNumber}
                onChange={(e) => setField("identityNumber", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.identityNumber}
              />
              <FieldError message={errors.identityNumber} />
            </div>

            <div>
              <Label htmlFor="addressLine1">{t("kyc.address1")}</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => setField("addressLine1", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.addressLine1}
              />
              <FieldError message={errors.addressLine1} />
            </div>

            <div>
              <Label htmlFor="addressLine2">{t("kyc.address2")}</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <KycCddFields form={cdd} errors={errors} onChange={setCddField} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocField
                kind="ktp"
                label={t("kyc.ktpPhoto")}
                doc={docs.ktp}
                requiredError={errors.ktp}
                onSelect={selectDoc}
              />
              <DocField
                kind="selfie"
                label={t("kyc.selfiePhoto")}
                doc={docs.selfie}
                requiredError={errors.selfie}
                onSelect={selectDoc}
              />
            </div>

            <Button
              type="submit"
              disabled={!allFilled || uploadsBusy || submitting || formDisabled}
              className="w-full brand-gradient text-white"
            >
              {submitting
                ? t("kyc.submitting")
                : status.status === "REJECTED"
                  ? t("kyc.resubmit")
                  : t("kyc.submit")}
            </Button>
          </fieldset>
        </form>
      )}
    </div>
  );
}

function DocField({
  kind,
  label,
  doc,
  requiredError,
  onSelect,
}: {
  kind: PresignedDocKind;
  label: string;
  doc: KycDocState;
  requiredError?: string;
  onSelect: (kind: PresignedDocKind, file: File | null) => void;
}) {
  const { t } = useLang();
  const docError =
    doc.error === "type"
      ? t("kyc.err.fileType")
      : doc.error === "size"
        ? t("kyc.err.fileTooLarge")
        : doc.error === "upload"
          ? t("kyc.err.uploadFailed")
          : undefined;

  const showPreview = !!doc.previewUrl && !doc.error;

  return (
    <div>
      <Label htmlFor={`${kind}File`}>{label}</Label>
      {/* One dropzone card per document: placeholder while empty, the photo once
          chosen. Clicking the card (re)opens the file picker — no separate
          input + preview rows. The real input stays in the DOM (sr-only) so
          tests and assistive tech keep targeting #ktpFile / #selfieFile. */}
      <label
        htmlFor={`${kind}File`}
        className={cn(
          "mt-1.5 flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/70 hover:bg-muted",
          showPreview && "border-solid border-border",
          (docError ?? requiredError) && "border-destructive",
        )}
      >
        {showPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.previewUrl ?? undefined}
            alt={label}
            className="size-full object-cover"
            onError={(e) => {
              // HEIC previews aren't renderable in most browsers — hide gracefully;
              // the status row below still confirms the upload state.
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-8 opacity-70" />
            <span className="font-medium">{t("kyc.uploadPlaceholder")}</span>
            <span className="text-xs opacity-75">{t("kyc.uploadHint")}</span>
          </span>
        )}
      </label>
      <input
        id={`${kind}File`}
        type="file"
        accept="image/jpeg,image/png,image/heic"
        onChange={(e) => onSelect(kind, e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-invalid={!!(docError ?? requiredError)}
      />
      {doc.uploading && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t("kyc.uploading")}
        </p>
      )}
      {doc.objectKey && !doc.uploading && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> {t("kyc.uploaded")}
          <span className="text-muted-foreground">· {t("kyc.changePhoto")}</span>
        </p>
      )}
      <FieldError message={docError ?? requiredError} />
    </div>
  );
}
