"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyKycStatus,
  submitKyc,
  requestPresignedUpload,
  uploadToPresignedUrl,
} from "@/lib/api/kyc-api";
import type { SubmitKycRequest } from "@/lib/api/types";

const KYC_STATUS_KEY = ["kyc", "me"] as const;

export interface KycSubmitInput {
  firstName: string;
  lastName: string;
  dob: string;
  birthPlace: string;
  identityNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  ktpFile: File;
  selfieFile: File;
}

// KYC status + submission flow (USDX-150). Submit is a 3-step pipeline per
// sot/phase-2/week1.md § Consumer App Flow: presign → PUT to bucket → POST /v2/kyc.
// Full form UX (validation, resubmit polish) is refined in USDX-152.
export function useKyc() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getMyKycStatus,
    staleTime: 30_000,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (input: KycSubmitInput) => {
      const [ktp, selfie] = await Promise.all([
        uploadDoc("ktp", input.ktpFile),
        uploadDoc("selfie", input.selfieFile),
      ]);

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
        ktpObjectKey: ktp,
        selfieObjectKey: selfie,
      };
      return submitKyc(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
      // KYC submit changes users.kyc_status — refresh the session user too.
      queryClient.invalidateQueries({ queryKey: ["session", "me"] });
    },
  });

  return {
    status: statusQuery.data,
    statusLoading: statusQuery.isLoading,
    submit: submitMutation.mutateAsync,
    submitting: submitMutation.isPending,
    submitError: submitMutation.error,
  };
}

async function uploadDoc(docKind: "ktp" | "selfie", file: File): Promise<string> {
  const presigned = await requestPresignedUpload({
    docKind,
    fileType: file.type,
    sizeBytes: file.size,
  });
  await uploadToPresignedUrl(presigned, file);
  return presigned.objectKey;
}
