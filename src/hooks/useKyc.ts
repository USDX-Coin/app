"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyKycStatus,
  submitKyc,
  submitKycCdd,
  requestPresignedUpload,
  uploadToPresignedUrl,
} from "@/lib/api/kyc-api";
import type { SubmitKycRequest, PresignedDocKind } from "@/lib/api/types";
import { toCddPayload } from "@/lib/kyc/cdd";

// Shared with useKycGate so the gate and the /kyc page read the same cache entry.
export const KYC_STATUS_KEY = ["kyc", "me"] as const;

// Client-side mirror of conventions.md § File Constraints — the backend re-verifies
// after upload; these checks just save the user a wasted round-trip.
export const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const KYC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"];

export type KycDocError = "type" | "size" | "upload" | null;

export interface KycDocState {
  fileName: string | null;
  previewUrl: string | null;
  objectKey: string | null;
  uploading: boolean;
  error: KycDocError;
}

const EMPTY_DOC: KycDocState = {
  fileName: null,
  previewUrl: null,
  objectKey: null,
  uploading: false,
  error: null,
};

export interface KycSubmitInput {
  firstName: string;
  lastName: string;
  dob: string;
  birthPlace: string;
  identityNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  // CDD block (USDX-545) — already narrowed + normalised by `toCddPayload`, so the
  // hook only forwards it. Kept as one nested object rather than seven loose
  // params so the caller cannot forward a half-validated CDD form.
  cdd: CddPayload;
}

export type CddPayload = ReturnType<typeof toCddPayload>;

// KYC status + submission flow (USDX-152). Files upload EAGERLY on selection
// (presign → PUT to bucket → keep objectKey in state, per the ticket's per-file
// loading/preview UX); submit then POSTs the PII + the two stored objectKeys
// (sot/phase-2/week1.md § Consumer App Flow).
export function useKyc() {
  const queryClient = useQueryClient();
  const [docs, setDocs] = useState<Record<PresignedDocKind, KycDocState>>({
    ktp: EMPTY_DOC,
    selfie: EMPTY_DOC,
  });

  const statusQuery = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getMyKycStatus,
    staleTime: 30_000,
    retry: false,
  });

  function patchDoc(kind: PresignedDocKind, patch: Partial<KycDocState>) {
    setDocs((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }

  // Select-and-upload: validates locally, then presigns + PUTs immediately.
  async function selectDoc(kind: PresignedDocKind, file: File | null) {
    const previous = docs[kind].previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    if (!file) {
      setDocs((prev) => ({ ...prev, [kind]: EMPTY_DOC }));
      return;
    }
    if (!KYC_ALLOWED_TYPES.includes(file.type)) {
      setDocs((prev) => ({ ...prev, [kind]: { ...EMPTY_DOC, fileName: file.name, error: "type" } }));
      return;
    }
    if (file.size > KYC_MAX_FILE_BYTES) {
      setDocs((prev) => ({ ...prev, [kind]: { ...EMPTY_DOC, fileName: file.name, error: "size" } }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setDocs((prev) => ({
      ...prev,
      [kind]: { fileName: file.name, previewUrl, objectKey: null, uploading: true, error: null },
    }));
    try {
      const presigned = await requestPresignedUpload({
        docKind: kind,
        fileType: file.type,
        sizeBytes: file.size,
      });
      await uploadToPresignedUrl(presigned, file);
      patchDoc(kind, { objectKey: presigned.objectKey, uploading: false });
    } catch {
      patchDoc(kind, { uploading: false, error: "upload" });
    }
  }

  // Backend rejected the stored object keys (KYC_FILE_NOT_FOUND / KYC_FILE_INVALID)
  // — drop both so the user re-uploads fresh files.
  function clearUploads() {
    for (const url of [docs.ktp.previewUrl, docs.selfie.previewUrl]) {
      if (url) URL.revokeObjectURL(url);
    }
    setDocs({ ktp: EMPTY_DOC, selfie: EMPTY_DOC });
  }

  function refreshStatus() {
    queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
  }

  const submitMutation = useMutation({
    mutationFn: async (input: KycSubmitInput) => {
      const payload: SubmitKycRequest = {
        firstName: input.firstName,
        lastName: input.lastName,
        dob: input.dob,
        birthPlace: input.birthPlace,
        identityType: "KTP",
        identityNumber: input.identityNumber,
        country: "ID",
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        ktpObjectKey: docs.ktp.objectKey!,
        selfieObjectKey: docs.selfie.objectKey!,
        // CDD (USDX-545). Spread, not re-listed field by field: the payload
        // builder is the only place allowed to decide the wire keys, so a rename
        // there cannot silently leave a stale duplicate here.
        ...input.cdd,
      };
      return submitKyc(payload);
    },
    onSuccess: () => {
      refreshStatus();
      // KYC submit changes users.kyc_status — refresh the session user too.
      queryClient.invalidateQueries({ queryKey: ["session", "me"] });
    },
  });

  // CDD-only top-up for an already-VERIFIED customer (USDX-545). Separate
  // mutation, separate endpoint — see submitKycCdd. Deliberately does NOT
  // invalidate ["session","me"]: that query exists to re-read `users.kyc_status`,
  // and this call must not change it. Invalidating it would only invite the
  // assumption that it might.
  const submitCddMutation = useMutation({
    mutationFn: (cdd: CddPayload) => submitKycCdd(cdd),
    onSuccess: () => refreshStatus(),
  });

  const uploadsReady = !!docs.ktp.objectKey && !!docs.selfie.objectKey;
  const uploadsBusy = docs.ktp.uploading || docs.selfie.uploading;

  return {
    status: statusQuery.data,
    statusLoading: statusQuery.isLoading,
    refreshStatus,
    docs,
    selectDoc,
    clearUploads,
    uploadsReady,
    uploadsBusy,
    submit: submitMutation.mutateAsync,
    submitting: submitMutation.isPending,
    submitError: submitMutation.error,
    submitCdd: submitCddMutation.mutateAsync,
    submittingCdd: submitCddMutation.isPending,
  };
}
