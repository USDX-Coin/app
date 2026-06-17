import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { ApiError } from "@/lib/api/client";

// Mock the API client layer so these tests exercise the hook wiring (query +
// mutation + invalidation), not the network. address-book-api.test.ts already
// covers the request shapes.
const listMock = vi.fn();
const addMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api/address-book-api", () => ({
  listAddressBook: () => listMock(),
  addAddressBookEntry: (req: unknown) => addMock(req),
  deleteAddressBookEntry: (id: string) => deleteMock(id),
}));

import {
  useAddressBook,
  useAddAddressBook,
  useDeleteAddressBook,
} from "@/hooks/useAddressBook";

const ENTRY = {
  id: "a1",
  address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  label: "John Doe",
  createdAt: "2026-06-17T00:00:00Z",
};

// All three hooks must share one QueryClient so the mutation's invalidation
// reaches the list query — render them together under a single wrapper.
function useAddressBookSuite() {
  return {
    list: useAddressBook(),
    add: useAddAddressBook(),
    del: useDeleteAddressBook(),
  };
}

beforeEach(() => {
  listMock.mockReset();
  addMock.mockReset();
  deleteMock.mockReset();
});

describe("useAddAddressBook", () => {
  describe("positive", () => {
    test("invalidates the list so it refetches with the new entry", async () => {
      listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([ENTRY]);
      addMock.mockResolvedValueOnce(ENTRY);

      const { result } = renderHook(() => useAddressBookSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.data).toEqual([]));

      await act(async () => {
        await result.current.add.mutateAsync({ address: ENTRY.address, label: ENTRY.label });
      });

      expect(addMock).toHaveBeenCalledWith({ address: ENTRY.address, label: ENTRY.label });
      await waitFor(() => expect(result.current.list.data).toEqual([ENTRY]));
      expect(listMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("negative", () => {
    test("propagates 409 ADDRESS_ALREADY_EXISTS to the caller", async () => {
      listMock.mockResolvedValue([]);
      addMock.mockRejectedValueOnce(new ApiError(409, "ADDRESS_ALREADY_EXISTS", "dup"));

      const { result } = renderHook(() => useAddressBookSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.add.mutateAsync({ address: ENTRY.address, label: "X" });
        } catch (e) {
          caught = e;
        }
      });
      expect(caught).toMatchObject({ status: 409, code: "ADDRESS_ALREADY_EXISTS" });
    });
  });
});

describe("useDeleteAddressBook", () => {
  describe("positive", () => {
    test("invalidates the list so it refetches without the deleted entry", async () => {
      listMock.mockResolvedValueOnce([ENTRY]).mockResolvedValueOnce([]);
      deleteMock.mockResolvedValueOnce({ id: ENTRY.id });

      const { result } = renderHook(() => useAddressBookSuite(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.list.data).toEqual([ENTRY]));

      await act(async () => {
        await result.current.del.mutateAsync(ENTRY.id);
      });

      expect(deleteMock).toHaveBeenCalledWith(ENTRY.id);
      await waitFor(() => expect(result.current.list.data).toEqual([]));
    });
  });
});
