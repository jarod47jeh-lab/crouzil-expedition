import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getQualifications } from "@/lib/data";
import { QualificationsView } from "./view";

export const metadata = { title: "Qualifications et formations" };

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireModule("equipe");
  const sp = await searchParams;
  const sb = await createClient();
  const [employees, q] = await Promise.all([getEmployees(sb, false), getQualifications(sb)]);
  const tab = (["tableau", "echeances", "catalogue"].includes(sp.tab || "") ? sp.tab : "tableau") as "tableau" | "echeances" | "catalogue";
  return <QualificationsView tab={tab} employees={employees.filter((e) => e.active)} types={q.types} quals={q.quals} />;
}
