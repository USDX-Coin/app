// Own-hosted mint checkout (USDX-202). Refresh-safe — all state comes from
// GET /v2/mint/{id} via CheckoutContent (client).

import { CheckoutContent } from "@/components/mint/CheckoutContent";

export default function MintCheckoutPage() {
  return <CheckoutContent />;
}
