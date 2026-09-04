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
import { isApiError, isPresignedUploadError } from "@/lib/api/errors";
import { toCddPayload } from "@/lib/kyc/cdd";
import { toIdentityPayload } from "@/lib/kyc/identity";

// Shared with useKycGate so the gate and the /kyc page read the same cache entry.
export const KYC_STATUS_KEY = ["kyc", "me"] as const;

// Client-side mirror of conventions.md § File Constraints — the backend re-verifies
// after upload; these checks just save the user a wasted round-trip.
export const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const KYC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"];

// Keadaan error per dokumen. `upload` / `server` / `network` sengaja dipisah:
// ketiganya menuntut tindakan yang berbeda dari nasabah, dan menyatukannya jadi satu
// "upload" pernah membuat kegagalan 5xx tetap menyuruh "unggah ulang foto Anda" —
// nasihat yang tidak akan pernah berhasil (uji manual KYC, 2 September 2026).
export type KycDocError = "type" | "size" | "upload" | "server" | "network" | null;

// Bagian dari `KycDocError` yang bisa dihasilkan sebuah kegagalan unggah. `type` dan
// `size` tidak masuk: keduanya ditolak pemeriksaan lokal sebelum ada permintaan.
type KycUploadError = "upload" | "server" | "network";

// Menerjemahkan error yang dilempar jalur unggah menjadi salah satu keadaan di atas.
// Hanya tiga cabang di bawah yang bisa dibuktikan dari bentuk error yang memang
// dilempar jalur ini; selain itu tetap `upload`, nasihat lama yang aman.
function classifyUploadError(error: unknown): KycUploadError {
  // Balasan POST /api/v2/storage/presigned-upload. 5xx = sistem kita yang bermasalah
  // (mis. bucket menolak kredensial server); 4xx = permintaannya yang ditolak, jadi
  // memilih berkas lagi memang bisa menolong.
  if (isApiError(error)) return error.status >= 500 ? "server" : "upload";

  // PUT langsung ke bucket. 5xx jelas milik bucket; 401/403 berarti URL presigned yang
  // ditandatangani backend kita yang ditolak — dua-duanya bukan urusan berkas nasabah.
  if (isPresignedUploadError(error)) {
    const ours = error.status >= 500 || error.status === 401 || error.status === 403;
    return ours ? "server" : "upload";
  }

  // `fetch` menolak dengan TypeError kalau permintaannya gagal sebelum ada balasan
  // HTTP sama sekali — offline, DNS gagal, koneksi putus, CORS diblokir. Itu satu-
  // satunya penanda jaringan yang dijanjikan spesifikasi fetch, jadi hanya itu yang
  // dipakai; menebak dari teks pesan tidak bisa diandalkan lintas peramban.
  if (error instanceof TypeError) return "network";

  return "upload";
}

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
  // Kedua separuh form sudah disempitkan + dinormalkan builder-nya masing-masing
  // (`toIdentityPayload` / `toCddPayload`), jadi hook tinggal meneruskan. Disimpan
  // sebagai dua objek bersarang, bukan puluhan parameter lepas, supaya pemanggil
  // tidak bisa meneruskan form yang baru setengah divalidasi.
  identity: IdentityPayload;
  cdd: CddPayload;
}

export type CddPayload = ReturnType<typeof toCddPayload>;
export type IdentityPayload = ReturnType<typeof toIdentityPayload>;

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
    } catch (error) {
      // Jangan telan error-nya. Repo ini belum punya jalur pelaporan error, jadi
      // devtools adalah satu-satunya tempat penyebab aslinya masih bisa dilihat dan
      // dilaporkan ke tim. Yang dicatat cuma jenis dokumen + error-nya — berkas dan
      // isinya tidak pernah ikut (data pribadi tidak boleh masuk log).
      console.error(`[useKyc] unggah dokumen ${kind} gagal:`, error);
      patchDoc(kind, { uploading: false, error: classifyUploadError(error) });
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
        // Di-spread, bukan didaftar ulang field per field: builder payload adalah
        // satu-satunya tempat yang boleh memutuskan kunci wire, sehingga penggantian
        // nama di sana tidak bisa diam-diam meninggalkan salinan basi di sini.
        ...input.identity,
        ...input.cdd,
        // `country` tetap "ID" (kyc.yaml: "Phase 2 awal hanya `ID`") dan ditampilkan
        // read-only di form, jadi ia tidak pernah jadi state yang dikirim nasabah.
        // Beda dari `nationality`, yang justru bisa diisi — negara alamat tinggal
        // bukan kewarganegaraan.
        country: "ID",
        ktpObjectKey: docs.ktp.objectKey!,
        selfieObjectKey: docs.selfie.objectKey!,
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
