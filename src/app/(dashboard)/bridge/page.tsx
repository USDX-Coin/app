import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

// Gated until a real bridge backend exists — the previous UI faked success
// locally (bridge_<timestamp>, no API call) against real balances and KYC,
// which could convince a verified user their funds actually moved.
//
// The Figma board also offers a second button here ("Alamat kontrak"), left out
// on purpose: `lib/chains.ts` still carries placeholder addresses
// (`0x5678...USDX`), so the link would open a 404 on the explorer.
export default function BridgePage() {
  return (
    <ComingSoonPage
      crumbs={["crumb.transaction", "nav.bridge"]}
      titleKey="nav.bridge"
      headlineKey="soon.bridge.headline"
      descKey="soon.bridge.desc"
      meanwhileKey="soon.bridge.meanwhile"
      primary={{ labelKey: "soon.toMint", href: "/mint" }}
    />
  );
}
