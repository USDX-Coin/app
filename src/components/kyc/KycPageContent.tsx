"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { KycStatusBanner } from "./KycStatusBanner";
import { useSession } from "@/hooks/useSession";
import { useKyc } from "@/hooks/useKyc";
import { useAuthStore } from "@/stores/authStore";
import { isEmailVerified } from "@/lib/auth/guards";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";

// /kyc page (USDX-150 foundation). Enforces requireEmailVerified, renders the live
// status banner from GET /api/v2/kyc/me, and a minimal submit form wired through the
// presigned-upload flow. The richer form UX + resubmit polish lands in USDX-152.
export function KycPageContent() {
  useSession(); // refresh user (emailVerifiedAt / kycStatus) from /api/v2/auth/me
  const user = useAuthStore((s) => s.user);
  const { status, statusLoading, submit, submitting } = useKyc();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    birthPlace: "",
    identityNumber: "",
    addressLine1: "",
    addressLine2: "",
  });
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string | undefined> = {
      firstName: form.firstName.trim() ? undefined : "First name is required",
      lastName: form.lastName.trim() ? undefined : "Last name is required",
      dob: form.dob ? undefined : "Date of birth is required",
      birthPlace: form.birthPlace.trim() ? undefined : "Birth place is required",
      identityNumber: /^\d{16}$/.test(form.identityNumber)
        ? undefined
        : "KTP number must be 16 digits",
      addressLine1: form.addressLine1.trim() ? undefined : "Address is required",
      ktpFile: ktpFile ? undefined : "KTP photo is required",
      selfieFile: selfieFile ? undefined : "Selfie photo is required",
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
        ktpFile: ktpFile!,
        selfieFile: selfieFile!,
      });
      toast.success("KYC submitted — we'll review your documents shortly.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not submit KYC"));
    }
  }

  // requireEmailVerified — Phase 1 users migrate via Forgot password.
  if (user && !isEmailVerified(user)) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-foreground">Identity Verification</h1>
        <div
          role="alert"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Please verify your email before submitting KYC. If you can&apos;t find the
          email, reset your password via{" "}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            Forgot password
          </Link>{" "}
          to confirm ownership.
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

  const canSubmit = status.status === "UNVERIFIED" || status.status === "REJECTED";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Identity Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity to unlock minting, redeeming, and bridging.
        </p>
      </div>

      <KycStatusBanner status={status} />

      {canSubmit && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
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
              <Label htmlFor="lastName">Last Name</Label>
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
              <Label htmlFor="dob">Date of Birth</Label>
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
              <Label htmlFor="birthPlace">Birth Place</Label>
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

          <div>
            <Label htmlFor="identityNumber">KTP Number</Label>
            <Input
              id="identityNumber"
              inputMode="numeric"
              placeholder="16-digit NIK"
              value={form.identityNumber}
              onChange={(e) => setField("identityNumber", e.target.value)}
              className="mt-1.5"
              aria-invalid={!!errors.identityNumber}
            />
            <FieldError message={errors.identityNumber} />
          </div>

          <div>
            <Label htmlFor="addressLine1">Address</Label>
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
            <Label htmlFor="addressLine2">Address Line 2 (optional)</Label>
            <Input
              id="addressLine2"
              value={form.addressLine2}
              onChange={(e) => setField("addressLine2", e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ktpFile">KTP Photo</Label>
              <Input
                id="ktpFile"
                type="file"
                accept="image/jpeg,image/png,image/heic"
                onChange={(e) => setKtpFile(e.target.files?.[0] ?? null)}
                className="mt-1.5"
                aria-invalid={!!errors.ktpFile}
              />
              <FieldError message={errors.ktpFile} />
            </div>
            <div>
              <Label htmlFor="selfieFile">Selfie with KTP</Label>
              <Input
                id="selfieFile"
                type="file"
                accept="image/jpeg,image/png,image/heic"
                onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                className="mt-1.5"
                aria-invalid={!!errors.selfieFile}
              />
              <FieldError message={errors.selfieFile} />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full brand-gradient text-white">
            {submitting
              ? "Submitting..."
              : status.status === "REJECTED"
                ? "Resubmit"
                : "Submit for Verification"}
          </Button>
        </form>
      )}
    </div>
  );
}
