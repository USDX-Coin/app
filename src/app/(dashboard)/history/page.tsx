import { Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { TransferHistoryLink } from "@/components/transfer/TransferHistoryLink";

// Riwayat terpadu (custodial-wallet.md §5.7, USDX-713): mint, redeem, transfer masuk
// dan keluar. Filter aktif ada di `?type=` — TransactionList membacanya lewat
// `useSearchParams`, jadi ia butuh batas Suspense supaya halaman tetap prerender.
export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader crumbs={["sidebar.more", "nav.history"]} title="title.transactionHistory" />
      <div className="flex justify-end empty:hidden">
        <TransferHistoryLink />
      </div>
      <Suspense fallback={<TransactionListSkeleton />}>
        <TransactionList />
      </Suspense>
    </div>
  );
}
