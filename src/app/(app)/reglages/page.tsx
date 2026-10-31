import { getSettings } from "@/lib/data";
import { SettingsView } from "./view";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  return <SettingsView settings={await getSettings()} />;
}
