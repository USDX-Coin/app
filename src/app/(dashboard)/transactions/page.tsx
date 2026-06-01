import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionList } from "@/components/transactions/TransactionList";

export default function TransactionsPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader crumbs={["More", "Transaction"]} title="Transaction History" />
      <TransactionList />
    </div>
  );
}
