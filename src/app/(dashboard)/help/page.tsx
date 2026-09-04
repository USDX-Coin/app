import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

export default function HelpPage() {
  return (
    <ComingSoonPage
      crumbs={["sidebar.more", "nav.help"]}
      titleKey="nav.help"
      headlineKey="soon.help.headline"
      descKey="soon.help.desc"
      meanwhileKey="soon.help.meanwhile"
      primary={{ labelKey: "soon.toHistory", href: "/history" }}
    />
  );
}
