import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getRepairs } from "@/lib/data";
import { ParcView } from "./view";

export const metadata = { title: "Parc et matériel" };

export default async function ParcPage() {
  await requireModule("parc");
  const sb = await createClient();
  const [assets, repairs] = await Promise.all([getAssets(sb), getRepairs(sb)]);
  return <ParcView assets={assets} repairs={repairs} />;
}
