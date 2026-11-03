import { requireModule } from "@/lib/guard";
import { getSettings } from "@/lib/data";
import { SettingsView } from "./view";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  await requireModule("admin");
  return <SettingsView settings={await getSettings()} />;
}
