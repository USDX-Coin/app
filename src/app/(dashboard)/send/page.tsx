import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

// Gated until a real send backend exists — the previous UI faked success
// locally (send_<timestamp>, no API call), which could convince a verified
// user their funds actually moved.
//
// Figma's primary here is "Buka buku alamat"; the address book has no route of
// its own (it is a dialog inside the Mint form), so the button points at Mint
// rather than at nothing.
export default function SendPage() {
  return (
    <ComingSoonPage
      crumbs={["crumb.transaction", "nav.send"]}
      titleKey="nav.send"
      headlineKey="soon.send.headline"
      descKey="soon.send.desc"
      meanwhileKey="soon.send.meanwhile"
      primary={{ labelKey: "soon.toMint", href: "/mint" }}
    />
  );
}
