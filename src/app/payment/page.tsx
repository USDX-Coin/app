"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMintStore } from "@/stores/mintStore";
import { getChainById } from "@/lib/chains";
import { formatAmount, truncateAddress, parseAmount } from "@/lib/utils";
import { CheckCircle, ArrowLeft } from "lucide-react";

export default function PaymentPage() {
  const router = useRouter();
  const { chainId, amount, destinationAddress, reset } = useMintStore();
  const [paid, setPaid] = useState(false);
  const [processing, setProcessing] = useState(false);
  const chain = getChainById(chainId);
  const parsedAmount = parseAmount(amount);

  // Redirect to /mint if accessed directly without mint data
  useEffect(() => {
    if (!amount || parsedAmount <= 0) {
      router.replace("/mint");
    }
  }, [amount, parsedAmount, router]);

  if (!amount || parsedAmount <= 0) {
    return null;
  }

  async function handlePay() {
    setProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setProcessing(false);
    setPaid(true);
  }

  function handleDone() {
    reset();
    router.push("/mint");
  }

  if (paid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">Payment Successful</h1>
            <p className="text-sm text-muted-foreground">
              Your mint order for {formatAmount(parsedAmount)} USDX on{" "}
              {chain?.shortName} has been submitted. Tokens will be delivered to
              your wallet within 24 hours.
            </p>
            <Button
              onClick={handleDone}
              className="w-full bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
            >
              Back to Mint
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <img src="/image/Logo.svg" alt="USDX" className="h-7 w-7" />
            <span className="text-sm font-semibold text-primary">USDX</span>
          </div>
          <CardTitle className="text-xl">Payment Gateway</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete your payment to mint USDX
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {formatAmount(parsedAmount)} USDX
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium">{chain?.shortName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-medium font-mono text-xs">
                {truncateAddress(destinationAddress)}
              </span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-bold">
                ${formatAmount(parsedAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Payment Method</p>
            <div className="flex gap-2">
              {["Credit Card", "Wire Transfer", "ACH"].map((method) => (
                <button
                  key={method}
                  className="flex-1 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handlePay}
            disabled={processing}
            className="w-full bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 py-6"
          >
            {processing ? "Processing..." : `Pay $${formatAmount(parsedAmount)}`}
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
