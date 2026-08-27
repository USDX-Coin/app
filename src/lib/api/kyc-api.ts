// KYC API (USDX-150). Routes to the real backend (/api/v2/kyc, /api/v2/storage)
// or the mock layer based on `env.useMock`. The rich KYC form UI lands in USDX-152;
// this module is the wiring it builds on.

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { KycMyStatus } from "@/types";
import type {
  SubmitKycRequest,
  SubmitKycCddRequest,
  PresignedUploadRequest,
  PresignedUploadResult,
} from "./types";
import {
  mockGetMyKycStatus,
  mockSubmitKyc,
  mockSubmitKycCdd,
  mockPresignedUpload,
} from "./mock-api";

export async function getMyKycStatus(): Promise<KycMyStatus> {
  if (env.useMock) return mockGetMyKycStatus();
  return apiFetch<KycMyStatus>("/api/v2/kyc/me", { method: "GET" });
}

export async function submitKyc(req: SubmitKycRequest): Promise<KycMyStatus> {
  if (env.useMock) return mockSubmitKyc(req);
  return apiFetch<KycMyStatus>("/api/v2/kyc", { method: "POST", body: req });
}

/**
 * CDD-only top-up for an already-VERIFIED customer (USDX-545). A DIFFERENT
 * endpoint from `submitKyc` on purpose: this one must leave `kyc.status`,
 * `users.kyc_status` and `submission_count` untouched. Routing it through
 * `POST /api/v2/kyc` would set the customer back to PENDING.
 *
 * AWAITING BACKEND: `PATCH /api/v2/kyc/cdd` does not exist yet.
 */
export async function submitKycCdd(req: SubmitKycCddRequest): Promise<KycMyStatus> {
  if (env.useMock) return mockSubmitKycCdd(req);
  return apiFetch<KycMyStatus>("/api/v2/kyc/cdd", { method: "PATCH", body: req });
}

export async function requestPresignedUpload(
  req: PresignedUploadRequest,
): Promise<PresignedUploadResult> {
  if (env.useMock) return mockPresignedUpload(req);
  return apiFetch<PresignedUploadResult>("/api/v2/storage/presigned-upload", {
    method: "POST",
    body: req,
  });
}

// Upload a file directly to the presigned PUT URL (Railway Bucket). Not an
// `apiFetch` call — it hits the bucket origin, not our API, and carries no envelope.
export async function uploadToPresignedUrl(
  result: PresignedUploadResult,
  file: File,
): Promise<void> {
  if (env.useMock) return;
  const response = await fetch(result.uploadUrl, {
    method: "PUT",
    headers: result.headers ?? { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}
