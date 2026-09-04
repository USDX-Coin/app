import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      crumbs={["sidebar.more", "nav.settings"]}
      titleKey="nav.settings"
      headlineKey="soon.settings.headline"
      descKey="soon.settings.desc"
      meanwhileKey="soon.settings.meanwhile"
      primary={{ labelKey: "soon.toProfile", href: "/profile" }}
    />
  );
}
