import { createClient } from "@/lib/supabase/server";
import { getAssets, getRepairs, getSettings } from "@/lib/data";
import { RepairsView } from "./view";

export const metadata = { title: "Réparations" };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = ["dash", "list", "send"].includes(sp.tab || "") ? sp.tab! : "dash";
  const sb = await createClient();
  const [repairs, assets, settings] = await Promise.all([getRepairs(sb), getAssets(sb), getSettings(sb)]);
  return <RepairsView tab={tab} repairs={repairs} assets={assets} settings={settings} />;
}
