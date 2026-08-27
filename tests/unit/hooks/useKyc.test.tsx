import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { toCddPayload, EMPTY_CDD_FORM, type CddFormState } from "@/lib/kyc/cdd";

// USDX-545 — the CDD block must actually reach POST /api/v2/kyc. Mocks the API
// layer so this exercises the hook's payload assembly, not the network.
const statusMock = vi.fn();
const submitMock = vi.fn();
const submitCddMock = vi.fn();
const presignMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("@/lib/api/kyc-api", () => ({
  getMyKycStatus: () => statusMock(),
  submitKyc: (req: unknown) => submitMock(req),
  submitKycCdd: (req: unknown) => submitCddMock(req),
  requestPresignedUpload: (req: unknown) => presignMock(req),
  uploadToPresignedUrl: (result: unknown, file: unknown) => uploadMock(result, file),
}));

import { useKyc, type KycSubmitInput } from "@/hooks/useKyc";

const IDENTITY: Omit<KycSubmitInput, "cdd"> = {
  firstName: "Budi",
  lastName: "Santoso",
  dob: "1995-03-15",
  birthPlace: "Jakarta",
  identityNumber: "3171234567890123",
  addressLine1: "Jl. Sudirman No. 1",
  addressLine2: null,
};

const CDD: CddFormState = {
  ...EMPTY_CDD_FORM,
  occupation: "SELF_EMPLOYED",
  sourceOfFunds: "BUSINESS",
  annualIncomeRange: "FROM_500M_TO_1B",
  transactionPurpose: "REMITTANCE",
};

const PENDING = { status: "PENDING" as const };
const VERIFIED_WITH_CDD = { status: "VERIFIED" as const, cddComplete: true };

function pngFile() {
  return new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
}

/** Drive the hook through the eager upload of both documents. */
async function withUploads(result: { current: ReturnType<typeof useKyc> }) {
  await act(async () => {
    await result.current.selectDoc("ktp", pngFile());
  });
  await act(async () => {
    await result.current.selectDoc("selfie", pngFile());
  });
  await waitFor(() => expect(result.current.uploadsReady).toBe(true));
}

beforeEach(() => {
  statusMock.mockReset().mockResolvedValue({ status: "UNVERIFIED" });
  submitMock.mockReset().mockResolvedValue(PENDING);
  submitCddMock.mockReset().mockResolvedValue(VERIFIED_WITH_CDD);
  presignMock
    .mockReset()
    .mockImplementation((req: { docKind: string }) =>
      Promise.resolve({
        uploadUrl: `https://bucket.test/${req.docKind}`,
        objectKey: `kyc/usr_1/${req.docKind}/x.png`,
        expiresAt: "2026-01-01T00:00:00Z",
      }),
    );
  uploadMock.mockReset().mockResolvedValue(undefined);

  // jsdom has no object-URL implementation; the hook builds previews with it.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("useKyc submit", () => {
  describe("positive", () => {
    test("sends the CDD block alongside the identity fields", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({ ...IDENTITY, cdd: toCddPayload(CDD) });
      });

      expect(submitMock).toHaveBeenCalledTimes(1);
      expect(submitMock.mock.calls[0][0]).toMatchObject({
        occupation: "SELF_EMPLOYED",
        sourceOfFunds: "BUSINESS",
        annualIncomeRange: "FROM_500M_TO_1B",
        transactionPurpose: "REMITTANCE",
        pepStatus: false,
        pepRelation: null,
        npwp: null,
      });
    });

    test("regression: the pre-USDX-545 identity payload is unchanged", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({ ...IDENTITY, cdd: toCddPayload(CDD) });
      });

      expect(submitMock.mock.calls[0][0]).toMatchObject({
        firstName: "Budi",
        lastName: "Santoso",
        dob: "1995-03-15",
        birthPlace: "Jakarta",
        identityType: "KTP",
        identityNumber: "3171234567890123",
        country: "ID",
        addressLine1: "Jl. Sudirman No. 1",
        addressLine2: null,
        ktpObjectKey: "kyc/usr_1/ktp/x.png",
        selfieObjectKey: "kyc/usr_1/selfie/x.png",
      });
    });

    test("a declared PEP sends the relation text", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({
          ...IDENTITY,
          cdd: toCddPayload({ ...CDD, pepStatus: true, pepRelation: "Ayah - anggota DPRD" }),
        });
      });

      expect(submitMock.mock.calls[0][0]).toMatchObject({
        pepStatus: true,
        pepRelation: "Ayah - anggota DPRD",
      });
    });
  });

  describe("negative", () => {
    test("a retracted PEP declaration never reaches the request body", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({
          ...IDENTITY,
          // typed, then the checkbox was un-ticked
          cdd: toCddPayload({ ...CDD, pepStatus: false, pepRelation: "Ayah - anggota DPRD" }),
        });
      });

      const body = JSON.stringify(submitMock.mock.calls[0][0]);
      expect(body).not.toContain("anggota DPRD");
    });
  });

  describe("edge cases", () => {
    test("optional NPWP is sent as null, never as an empty string", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({ ...IDENTITY, cdd: toCddPayload({ ...CDD, npwp: "" }) });
      });

      expect(submitMock.mock.calls[0][0]).toHaveProperty("npwp", null);
    });

    test("PII from the submitted CDD is not written to web storage", async () => {
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result);

      await act(async () => {
        await result.current.submit({
          ...IDENTITY,
          cdd: toCddPayload({
            ...CDD,
            pepStatus: true,
            pepRelation: "PEPSENTINEL-relation",
            npwp: "NPWPSENTINEL-1234",
          }),
        });
      });

      const dump = [localStorage, sessionStorage]
        .flatMap((store) => Object.keys(store).map((k) => `${k}=${store.getItem(k)}`))
        .join("|");
      expect(dump).not.toContain("PEPSENTINEL");
      expect(dump).not.toContain("NPWPSENTINEL");
    });
  });
});

// USDX-545, Wisnu 27 Aug 2026 — CDD top-up for an ALREADY-VERIFIED customer. The
// whole risk of this flow is a status regression, so most of these tests assert
// what must NOT happen.
describe("useKyc submitCdd (VERIFIED top-up)", () => {
  describe("positive", () => {
    test("sends exactly the seven CDD fields to the CDD endpoint", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.submitCdd(toCddPayload(CDD));
      });

      expect(submitCddMock).toHaveBeenCalledTimes(1);
      expect(submitCddMock.mock.calls[0][0]).toEqual({
        occupation: "SELF_EMPLOYED",
        sourceOfFunds: "BUSINESS",
        annualIncomeRange: "FROM_500M_TO_1B",
        transactionPurpose: "REMITTANCE",
        pepStatus: false,
        pepRelation: null,
        npwp: null,
      });
    });

    test("needs no document upload — identity was accepted long ago", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      expect(result.current.uploadsReady).toBe(false);

      await act(async () => {
        await result.current.submitCdd(toCddPayload(CDD));
      });

      expect(submitCddMock).toHaveBeenCalledTimes(1);
      expect(presignMock).not.toHaveBeenCalled();
      expect(uploadMock).not.toHaveBeenCalled();
    });

    test("refetches the KYC status so the top-up form disappears once saved", async () => {
      statusMock
        .mockResolvedValueOnce({ status: "VERIFIED", cddComplete: false })
        .mockResolvedValue({ status: "VERIFIED", cddComplete: true });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status?.cddComplete).toBe(false));

      await act(async () => {
        await result.current.submitCdd(toCddPayload(CDD));
      });

      await waitFor(() => expect(result.current.status?.cddComplete).toBe(true));
      expect(result.current.status?.status).toBe("VERIFIED");
    });
  });

  describe("negative", () => {
    test("NEVER calls the full KYC submit — that endpoint sets status to PENDING", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.submitCdd(toCddPayload(CDD));
      });

      expect(submitMock).not.toHaveBeenCalled();
    });

    test("a retracted PEP declaration is not sent on the top-up path either", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.submitCdd(
          toCddPayload({ ...CDD, pepStatus: false, pepRelation: "Ayah - anggota DPRD" }),
        );
      });

      expect(JSON.stringify(submitCddMock.mock.calls[0][0])).not.toContain("anggota DPRD");
    });

    test("a failed top-up surfaces the error and still never touches the full submit", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      submitCddMock.mockRejectedValueOnce(new Error("boom"));
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.submitCdd(toCddPayload(CDD));
        }),
      ).rejects.toThrow("boom");
      expect(submitMock).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("the request body carries no identity field and no object key", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });
      await withUploads(result); // even with documents staged, they must not ride along

      await act(async () => {
        await result.current.submitCdd(toCddPayload(CDD));
      });

      const body = submitCddMock.mock.calls[0][0] as Record<string, unknown>;
      for (const forbidden of [
        "firstName",
        "lastName",
        "dob",
        "birthPlace",
        "identityNumber",
        "identityType",
        "addressLine1",
        "ktpObjectKey",
        "selfieObjectKey",
        "status",
        "submissionCount",
      ]) {
        expect(body, `top-up body must not carry ${forbidden}`).not.toHaveProperty(forbidden);
      }
    });

    test("top-up PII is not written to web storage", async () => {
      statusMock.mockResolvedValue({ status: "VERIFIED", cddComplete: false });
      const { result } = renderHook(() => useKyc(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.submitCdd(
          toCddPayload({
            ...CDD,
            pepStatus: true,
            pepRelation: "PEPSENTINEL-relation",
            npwp: "NPWPSENTINEL-1234",
          }),
        );
      });

      const dump = [localStorage, sessionStorage]
        .flatMap((store) => Object.keys(store).map((k) => `${k}=${store.getItem(k)}`))
        .join("|");
      expect(dump).not.toContain("PEPSENTINEL");
      expect(dump).not.toContain("NPWPSENTINEL");
    });
  });
});
