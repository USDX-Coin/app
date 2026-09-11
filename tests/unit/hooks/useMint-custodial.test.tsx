import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "../../helpers/test-utils";
import { useMint } from "@/hooks/useMint";
import { useMintStore } from "@/stores/mintStore";
import { useAuthStore } from "@/stores/authStore";
import { getAppConfig } from "@/lib/api/config-api";
import { createMintOrder } from "@/lib/api/mint-api";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import type { AppConfig, CustodialWallet, MintOrderCreated, User } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/api/auth-api", () => ({ mintCheckoutCode: vi.fn().mockResolvedValue("code") }));
vi.mock("@/lib/api/config-api", () => ({ getAppConfig: vi.fn() }));
vi.mock("@/lib/api/mint-api", () => ({ createMintOrder: vi.fn() }));
vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn(), createCustodialWallet: vi.fn() }));

const getAppConfigMock = vi.mocked(getAppConfig);
const createMintOrderMock = vi.mocked(createMintOrder);
const getWalletMock = vi.mocked(getCustodialWallet);

const CUSTODIAL = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const MANUAL = "0x1234567890abcdef1234567890abcdef12345678";
const CONFIG: AppConfig = {
  minMintIdr: "20000.00",
  mintFeePct: "1.0",
  pgFeeVaFlat: "4000.00",
  contractAddress: "0x1FF2000000000000000000000000000000000000",
  chain: "polygon",
};
const WALLET: CustodialWallet = {
  address: CUSTODIAL,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "0.00",
  balanceWei: "0",
  balanceAt: "2026-08-28T04:12:31.000Z",
  createdAt: "2026-08-28T04:10:00.000Z",
};
const USER: User = {
  id: "usr_1",
  name: "Demo",
  email: "demo@usdx.com",
  phone: null,
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// Original `window.location` is restored after the handoff tests so the assign
// in `onSuccess` never navigates jsdom.
const originalLocation = window.location;

beforeEach(() => {
  useMintStore.getState().reset();
  getAppConfigMock.mockReset();
  getAppConfigMock.mockResolvedValue(CONFIG);
  createMintOrderMock.mockReset();
  createMintOrderMock.mockResolvedValue({ id: "mint_1" } as MintOrderCreated);
  getWalletMock.mockReset();
  getWalletMock.mockResolvedValue(WALLET);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "http://localhost/mint" },
  });
});

function setCustodialUser(status: CustodialWallet["status"] = "ACTIVE") {
  useAuthStore.setState({
    user: {
      ...USER,
      custodialWallet: { address: status === "PROVISIONING" ? null : CUSTODIAL, status },
    },
    isAuthenticated: true,
    token: "t",
  });
}

// Mint to "my custodial wallet" (USDX-567, custodial-wallet.md §5.2): no new
// field — the custodial address fills `userAddress`, and the "to my custodial
// wallet" marker is a byte-identical address match.
describe("useMint — custodial destination", () => {
  describe("positive", () => {
    test("custodial owner: destination defaults to the custodial address, no typing needed", async () => {
      setCustodialUser();
      useMintStore.getState().setAmount("100");
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isConfigReady).toBe(true));
      expect(result.current.custodialAvailable).toBe(true);
      expect(result.current.destinationSource).toBe("custodial");
      expect(result.current.destinationAddress).toBe(CUSTODIAL);
      expect(result.current.isCustodialDestination).toBe(true);
      expect(result.current.addressError).toBeNull();
      await waitFor(() => expect(result.current.isFormValid).toBe(true));
    });

    test("the order is created with userAddress = the custodial address", async () => {
      setCustodialUser();
      useMintStore.getState().setAmount("100");
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isFormValid).toBe(true));

      await act(async () => {
        await result.current.submitMint();
      });
      expect(createMintOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({ userAddress: CUSTODIAL, chain: "polygon" }),
      );
    });

    test("switching to 'another address' uses the typed address and keeps it when switching back", async () => {
      setCustodialUser();
      const s = useMintStore.getState();
      s.setAmount("100");
      s.setDestinationAddress(MANUAL);
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.custodialAvailable).toBe(true));

      act(() => result.current.setDestinationSource("manual"));
      expect(result.current.destinationAddress).toBe(MANUAL);
      expect(result.current.isCustodialDestination).toBe(false);

      act(() => result.current.setDestinationSource("custodial"));
      expect(result.current.destinationAddress).toBe(CUSTODIAL);
      expect(result.current.manualAddress).toBe(MANUAL); // typed value survives
    });
  });

  describe("negative", () => {
    test("no custodial wallet → the switch is absent and the manual path is unchanged", async () => {
      useAuthStore.setState({ user: { ...USER, custodialWallet: null }, isAuthenticated: true, token: "t" });
      useMintStore.getState().setAmount("100");
      useMintStore.getState().setDestinationAddress(MANUAL);
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });

      expect(result.current.custodialAvailable).toBe(false);
      expect(result.current.destinationSource).toBe("manual");
      expect(result.current.destinationAddress).toBe(MANUAL);
      expect(result.current.isCustodialDestination).toBe(false);
      expect(getWalletMock).not.toHaveBeenCalled();
    });

    test("PROVISIONING wallet is not offered as a destination", () => {
      setCustodialUser("PROVISIONING");
      useMintStore.getState().setAmount("100");
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      expect(result.current.custodialAvailable).toBe(false);
      expect(result.current.destinationAddress).toBe("");
      expect(result.current.isFormValid).toBe(false);
    });
  });

  describe("edge case", () => {
    test("a manually typed address equal to the custodial one is still marked custodial (byte match)", async () => {
      setCustodialUser();
      const s = useMintStore.getState();
      s.setDestinationAddress(CUSTODIAL);
      s.setDestinationSource("manual");
      const { result } = renderHook(() => useMint(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.custodialAvailable).toBe(true));
      expect(result.current.isCustodialDestination).toBe(true);
    });

    test("reset returns the source to custodial", () => {
      useMintStore.getState().setDestinationSource("manual");
      useMintStore.getState().reset();
      expect(useMintStore.getState().destinationSource).toBe("custodial");
    });
  });
});
