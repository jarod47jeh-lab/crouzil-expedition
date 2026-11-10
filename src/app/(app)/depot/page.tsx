import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getNotes, getRepairs } from "@/lib/data";
import { DepotView } from "./view";

export const metadata = { title: "Plan du dépôt" };

export default async function DepotPage() {
  await requireModule("parc");
  const sb = await createClient();
  const [assets, repairs, notes] = await Promise.all([getAssets(sb), getRepairs(sb), getNotes(sb)]);
  return <DepotView assets={assets} repairs={repairs} notes={notes} />;
}
