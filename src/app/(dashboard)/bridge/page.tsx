import { ComingSoon } from "@/components/layout/ComingSoon";

// Gated until a real bridge backend exists — the previous UI faked success
// locally (bridge_<timestamp>, no API call) against real balances and KYC,
// which could convince a verified user their funds actually moved.
export default function BridgePage() {
  return <ComingSoon titleKey="nav.bridge" descKey="soon.bridge" />;
}
