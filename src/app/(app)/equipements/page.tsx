import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getEquipment } from "@/lib/data";
import { EquipmentView } from "./view";

export const metadata = { title: "Tenues et équipements" };

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ tab?: string; team?: string }> }) {
  await requireModule("equipe");
  const sp = await searchParams;
  const sb = await createClient();
  const [employees, eq] = await Promise.all([getEmployees(sb, false), getEquipment(sb)]);
  const tab = (["tailles", "dotations", "commande", "catalogue"].includes(sp.tab || "") ? sp.tab : "tailles") as "tailles" | "dotations" | "commande" | "catalogue";
  return <EquipmentView tab={tab} team={sp.team || "chauf"} employees={employees.filter((e) => e.active && !e.freelance)} items={eq.items} issues={eq.issues} />;
}
