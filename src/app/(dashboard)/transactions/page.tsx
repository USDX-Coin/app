import { TransactionList } from "@/components/transactions/TransactionList";

export default function TransactionsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-4">Transactions</h1>
      <TransactionList />
    </div>
  );
}
