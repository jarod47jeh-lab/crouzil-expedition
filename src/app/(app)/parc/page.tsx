import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getEmployees, getRepairs } from "@/lib/data";
import { ParcView } from "./view";

export const metadata = { title: "Parc et matériel" };

export default async function ParcPage() {
  await requireModule("parc");
  const sb = await createClient();
  const [assets, repairs, employees] = await Promise.all([getAssets(sb), getRepairs(sb), getEmployees(sb, false)]);
  return <ParcView assets={assets} repairs={repairs} employees={employees} />;
}
