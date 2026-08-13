import { ComingSoon } from "@/components/layout/ComingSoon";

// Gated until a real send backend exists — the previous UI faked success
// locally (send_<timestamp>, no API call), which could convince a verified
// user their funds actually moved.
export default function SendPage() {
  return <ComingSoon titleKey="nav.send" descKey="soon.send" />;
}
