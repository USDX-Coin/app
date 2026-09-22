import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { createWrapper } from "../../helpers/test-utils";
import { TransactionList } from "@/components/transactions/TransactionList";
import { listTransactions } from "@/lib/api/transactions-api";
import { getCustodialWallet } from "@/lib/api/wallet-api";
import { getRedeemOrder } from "@/lib/api/redeem-api";
import { useAuthStore } from "@/stores/authStore";
import type { ConsumerTransaction, CustodialWallet, User } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/api/transactions-api", () => ({ listTransactions: vi.fn() }));
vi.mock("@/lib/api/wallet-api", () => ({ getCustodialWallet: vi.fn(), createCustodialWallet: vi.fn() }));
vi.mock("@/lib/api/redeem-api", () => ({ getRedeemOrder: vi.fn() }));

const listMock = vi.mocked(listTransactions);
const getWalletMock = vi.mocked(getCustodialWallet);
const getRedeemMock = vi.mocked(getRedeemOrder);

const CUSTODIAL = "0x000000C528aE908fB929a0898B65e913623c9aFf";
const MANUAL = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

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

const WALLET: CustodialWallet = {
  address: CUSTODIAL,
  status: "ACTIVE",
  chain: "polygon",
  contractAddress: "0x2702d7043693651BB8A3D2Ec1C296B20692C7426",
  balance: "10.00",
  balanceWei: "10000000",
  balanceAt: "2026-09-22T04:12:31.000Z",
  createdAt: "2026-09-01T04:10:00.000Z",
};

// Distinct amounts so each row can be found by its text.
function tx(
  id: string,
  type: "MINT" | "REDEEM",
  amount: string,
  userAddress: string,
): ConsumerTransaction {
  return {
    id,
    type,
    amount,
    subtotalIdr: type === "MINT" ? "160000" : null,
    grossIdr: type === "REDEEM" ? "160000" : null,
    totalPayIdr: type === "MINT" ? "163000" : null,
    netPayoutIdr: type === "REDEEM" ? "155000" : null,
    effectiveRate: "16000",
    chain: "polygon",
    userAddress,
    paymentStatus: type === "MINT" ? "PAID" : null,
    status: type === "MINT" ? "COMPLETED" : "PAYOUT_COMPLETE",
    txHash: null,
    createdAt: "2026-09-20T09:00:00Z",
    updatedAt: "2026-09-20T09:00:00Z",
  };
}

function serve(rows: ConsumerTransaction[]) {
  listMock.mockResolvedValue({
    data: rows,
    metadata: { page: 1, limit: 10, total: rows.length },
  } as Awaited<ReturnType<typeof listTransactions>>);
}

function setUser(custodialWallet: User["custodialWallet"]) {
  useAuthStore.setState({ user: { ...USER, custodialWallet }, isAuthenticated: true, token: "t" });
}

function renderList() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <LanguageProvider>
        <TransactionList />
      </LanguageProvider>
    </Wrapper>,
  );
}

// The desktop table row holding `amount` (formatted, id locale: "11,00"). The
// mobile cards render the same rows again; the table alone is enough to assert on.
async function row(amount: string) {
  const table = await screen.findByRole("table");
  const found = within(table)
    .getAllByRole("row")
    .find((r) => r.textContent?.includes(amount));
  if (!found) throw new Error(`no row for ${amount}`);
  return found;
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  listMock.mockReset();
  getWalletMock.mockReset();
  getWalletMock.mockResolvedValue(WALLET);
  getRedeemMock.mockReset();
  // Every API module the list touches is mocked, so any real fetch is an extra request.
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// Riwayat: penanda "wallet custodial saya" (USDX-653, custodial-wallet.md §5.2).
describe("TransactionList — custodial wallet marker", () => {
  describe("positive", () => {
    test("marks a mint to and a redeem from the custodial wallet with the mint review's label", async () => {
      setUser({ address: CUSTODIAL, status: "ACTIVE" });
      serve([tx("m1", "MINT", "11", CUSTODIAL), tx("r1", "REDEEM", "12", CUSTODIAL)]);
      renderList();

      expect(within(await row("11,00")).getByTestId("tx-custodial-marker")).toHaveTextContent(
        "Wallet custodial saya",
      );
      expect(within(await row("12,00")).getByTestId("tx-custodial-marker")).toHaveTextContent(
        "Wallet custodial saya",
      );
    });

    test("the mobile cards carry the same marker", async () => {
      setUser({ address: CUSTODIAL, status: "ACTIVE" });
      serve([tx("m1", "MINT", "11", CUSTODIAL)]);
      renderList();

      await screen.findByRole("table");
      // One in the table + one in the card.
      expect(screen.getAllByTestId("tx-custodial-marker")).toHaveLength(2);
    });
  });

  describe("negative", () => {
    test("orders to/from a manual address are not marked", async () => {
      setUser({ address: CUSTODIAL, status: "ACTIVE" });
      serve([tx("m1", "MINT", "11", MANUAL), tx("r1", "REDEEM", "12", MANUAL)]);
      renderList();

      expect(within(await row("11,00")).queryByTestId("tx-custodial-marker")).toBeNull();
      expect(within(await row("12,00")).queryByTestId("tx-custodial-marker")).toBeNull();
    });

    test("a user without a custodial wallet: no marker and no extra request", async () => {
      setUser(null);
      serve([tx("m1", "MINT", "11", CUSTODIAL), tx("r1", "REDEEM", "12", CUSTODIAL)]);
      renderList();

      await row("11,00");
      expect(screen.queryByTestId("tx-custodial-marker")).toBeNull();
      expect(getWalletMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("never loads an order detail per row (no GET /mint/{id} or /redeem/{id})", async () => {
      setUser({ address: CUSTODIAL, status: "ACTIVE" });
      serve([tx("m1", "MINT", "11", CUSTODIAL), tx("r1", "REDEEM", "12", MANUAL)]);
      renderList();

      await waitFor(() => expect(screen.getAllByTestId("tx-custodial-marker").length).toBeGreaterThan(0));
      expect(getRedeemMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("edge case", () => {
    test("the same address stored all lowercase is still marked", async () => {
      setUser({ address: CUSTODIAL, status: "ACTIVE" });
      serve([tx("m1", "MINT", "11", CUSTODIAL.toLowerCase())]);
      renderList();

      expect(within(await row("11,00")).getByTestId("tx-custodial-marker")).toBeInTheDocument();
    });

    test("a wallet still provisioning (no address yet) marks nothing", async () => {
      setUser({ address: null, status: "PROVISIONING" });
      getWalletMock.mockResolvedValue({ ...WALLET, address: null, status: "PROVISIONING", balance: null });
      serve([tx("m1", "MINT", "11", CUSTODIAL)]);
      renderList();

      expect(within(await row("11,00")).queryByTestId("tx-custodial-marker")).toBeNull();
    });
  });
});
