"use server";

import { getEmployees, getEquipment, getLeaves, getMarks } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { TeamExportData } from "@/lib/exports/team";

/** Données de l'export « Équipes, collaborateurs, tenues et équipements ».
    Les règles d'accès de la base s'appliquent : on ne reçoit que ce qu'on a le droit de lire. */
export async function loadTeamExport(year: number): Promise<{ ok: true; data: TeamExportData } | { ok: false; error: string }> {
  try {
    const sb = await createClient();
    const [employees, eq, leaves, marks] = await Promise.all([getEmployees(sb), getEquipment(sb), getLeaves(sb, `${year}-01-01`, `${year}-12-31`), getMarks(sb, `${year}-01-01`, `${year}-12-31`)]);
    return { ok: true, data: { employees, items: eq.items, issues: eq.issues, leaves, marks, year } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chargement impossible" };
  }
}
