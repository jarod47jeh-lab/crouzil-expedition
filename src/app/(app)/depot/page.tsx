import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getEmployees, getLeaves, getMarks, getNotes, getRepairs } from "@/lib/data";
import { iso, today } from "@/lib/domain/dates";
import { DepotView } from "./view";

export const metadata = { title: "Plan du dépôt" };

export default async function DepotPage() {
  await requireModule("parc");
  const sb = await createClient();
  const d = iso(today());
  const [assets, repairs, notes, employees, leaves, marks] = await Promise.all([getAssets(sb), getRepairs(sb), getNotes(sb), getEmployees(sb, false), getLeaves(sb, d, d), getMarks(sb, d, d)]);
  return <DepotView assets={assets} repairs={repairs} notes={notes} employees={employees} leaves={leaves} marks={marks} />;
}
