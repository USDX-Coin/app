import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

export default function SupportPage() {
  return (
    <ComingSoonPage
      crumbs={["sidebar.more", "nav.support"]}
      titleKey="nav.support"
      headlineKey="soon.support.headline"
      descKey="soon.support.desc"
      meanwhileKey="soon.support.meanwhile"
      primary={{ labelKey: "soon.toHistory", href: "/history" }}
    />
  );
}
