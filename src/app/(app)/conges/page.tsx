import { createClient } from "@/lib/supabase/server";
import { getCalls, getEmployees, getLeaves, getMarks, getSettings } from "@/lib/data";
import { iso, isWorkDay, nextWorkDay, parse, today } from "@/lib/domain/dates";
import { CongesView } from "./view";

export const metadata = { title: "Présences et congés" };

export default async function CongesPage({ searchParams }: { searchParams: Promise<{ tab?: string; d?: string; m?: string; y?: string }> }) {
  const sp = await searchParams;
  const tab = ["jour", "planning", "demandes", "soldes"].includes(sp.tab || "") ? sp.tab! : "jour";
  const t = today();
  const day = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? parse(sp.d) : isWorkDay(t) ? t : nextWorkDay(t);
  const year = Number(sp.y) || (tab === "jour" ? day.getFullYear() : t.getFullYear());
  const month = sp.m != null && sp.m !== "" ? Math.max(0, Math.min(11, Number(sp.m))) : tab === "jour" ? day.getMonth() : t.getMonth();

  const sb = await createClient();
  const from = `${year - 1}-12-01`, to = `${year + 1}-01-31`;
  const [employees, leaves, marks, calls, settings] = await Promise.all([
    getEmployees(sb),
    getLeaves(sb, from, to),
    getMarks(sb, from, to),
    getCalls(sb, from, to),
    getSettings(sb),
  ]);
  // les demandes en attente hors période restent visibles dans l'onglet Demandes
  const { data: pendingOther } = await sb.from("leave_requests").select("*").eq("status", "pending").is("deleted_at", null).or(`end_date.lt.${from},start_date.gt.${to}`);
  return (
    <CongesView
      tab={tab}
      day={iso(day)}
      year={year}
      month={month}
      employees={employees}
      leaves={[...leaves, ...((pendingOther as typeof leaves) || [])]}
      marks={marks}
      calls={calls}
      settings={settings}
    />
  );
}
