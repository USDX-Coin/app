"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { KycStatusBanner } from "./KycStatusBanner";
import { useSession } from "@/hooks/useSession";
import { useKyc, type KycDocState } from "@/hooks/useKyc";
import { useAuthStore } from "@/stores/authStore";
import { useLang } from "@/providers/LanguageProvider";
import { isEmailVerified } from "@/lib/auth/guards";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import type { PresignedDocKind } from "@/lib/api/types";
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
export function KycPageContent() {
  useSession(); // refresh user (emailVerifiedAt / kycStatus) from /api/v2/auth/me
  const user = useAuthStore((s) => s.user);
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
  } = useKyc();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // REJECTED state renders the banner only until the user opts into resubmitting.
  const [resubmitting, setResubmitting] = useState(false);

  const [gateBefore, gateAfter] = t("kyc.gate.body").split("{link}");

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      });
      setResubmitting(false);
      setForm(EMPTY_FORM);
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
  if (user && !isEmailVerified(user)) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-foreground">{t("kyc.title")}</h1>
        <div
          role="alert"
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

  if (statusLoading || !status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  // Form visibility per state (USDX-152): UNVERIFIED active; PENDING visible but
  // disabled; REJECTED hidden until "Submit Ulang"; VERIFIED hidden.
  const formDisabled = status.status === "PENDING" || submitting;
  const showForm =
    status.status === "UNVERIFIED" ||
    status.status === "PENDING" ||
    (status.status === "REJECTED" && resubmitting);

  const allFilled =
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.dob !== "" &&
    form.birthPlace.trim() !== "" &&
    form.identityNumber.trim() !== "" &&
    form.addressLine1.trim() !== "" &&
    uploadsReady;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("kyc.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("kyc.subtitle")}</p>
      </div>

      <KycStatusBanner
        status={status}
        onResubmit={() => setResubmitting(true)}
        resubmitActive={resubmitting}
      />

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

  return (
    <div>
      <Label htmlFor={`${kind}File`}>{label}</Label>
      <Input
        id={`${kind}File`}
        type="file"
        accept="image/jpeg,image/png,image/heic"
        onChange={(e) => onSelect(kind, e.target.files?.[0] ?? null)}
        className="mt-1.5"
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
        </p>
      )}
      {doc.previewUrl && !doc.error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={doc.previewUrl}
          alt=""
          className="mt-2 h-24 w-full rounded-md border border-border object-cover"
          onError={(e) => {
            // HEIC previews aren't renderable in most browsers — hide gracefully.
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <FieldError message={docError ?? requiredError} />
    </div>
  );
}
