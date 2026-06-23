import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { ApiError } from "@/lib/api/client";

// Mock the API client layer so these tests exercise the hook wiring (query +
// mutation + invalidation), not the network. bank-accounts-api.test.ts already
// covers the request shapes.
const listMock = vi.fn();
const addMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api/bank-accounts-api", () => ({
  listBankAccounts: () => listMock(),
  addBankAccount: (req: unknown) => addMock(req),
  deleteBankAccount: (id: string) => deleteMock(id),
}));

import {
  useBankAccounts,
  useAddBankAccount,
  useDeleteBankAccount,
} from "@/hooks/useBankAccounts";

const ENTRY = {
  id: "b1",
  bankCode: "014",
  accountNumberMasked: "••••••3210",
  accountName: "SINGGIH BRILIAN TARA",
  label: "BCA utama",
  createdAt: "2026-06-17T00:00:00Z",
};

const ADD_REQ = {
  bankCode: "014",
  accountNumber: "1234563210",
  accountName: "SINGGIH BRILIAN TARA",
  label: "BCA utama",
};

// All three hooks must share one QueryClient so the mutation's invalidation
// reaches the list query — render them together under a single wrapper.
function useBankAccountsSuite() {
  return {
    list: useBankAccounts(),
    add: useAddBankAccount(),
    del: useDeleteBankAccount(),
  };
}

beforeEach(() => {
  listMock.mockReset();
  addMock.mockReset();
  deleteMock.mockReset();
});

describe("useAddBankAccount", () => {
  describe("positive", () => {
    test("invalidates the list so it refetches with the new entry", async () => {
      listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([ENTRY]);
      addMock.mockResolvedValueOnce(ENTRY);

      const { result } = renderHook(() => useBankAccountsSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.data).toEqual([]));

      await act(async () => {
        await result.current.add.mutateAsync(ADD_REQ);
      });

      expect(addMock).toHaveBeenCalledWith(ADD_REQ);
      await waitFor(() => expect(result.current.list.data).toEqual([ENTRY]));
      expect(listMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("negative", () => {
    test("propagates 409 BANK_ACCOUNT_ALREADY_EXISTS to the caller", async () => {
      listMock.mockResolvedValue([]);
      addMock.mockRejectedValueOnce(new ApiError(409, "BANK_ACCOUNT_ALREADY_EXISTS", "dup"));

      const { result } = renderHook(() => useBankAccountsSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.add.mutateAsync(ADD_REQ);
        } catch (e) {
          caught = e;
        }
      });
      expect(caught).toMatchObject({ status: 409, code: "BANK_ACCOUNT_ALREADY_EXISTS" });
    });
  });
});

describe("useDeleteBankAccount", () => {
  describe("positive", () => {
    test("invalidates the list so it refetches without the deleted entry", async () => {
      listMock.mockResolvedValueOnce([ENTRY]).mockResolvedValueOnce([]);
      deleteMock.mockResolvedValueOnce({ id: ENTRY.id });

      const { result } = renderHook(() => useBankAccountsSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.data).toEqual([ENTRY]));

      await act(async () => {
        await result.current.del.mutateAsync(ENTRY.id);
      });

      expect(deleteMock).toHaveBeenCalledWith(ENTRY.id);
      await waitFor(() => expect(result.current.list.data).toEqual([]));
    });
  });
});
