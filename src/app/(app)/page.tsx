import { createClient } from "@/lib/supabase/server";
import {
  getAnnouncements,
  getAssets,
  getNotes,
  getAudit,
  getCalls,
  getEmployees,
  getErrors,
  getLeaves,
  getMarks,
  getRepairs,
  getSettings,
  getVolumes,
} from "@/lib/data";
import { addDays, iso, today } from "@/lib/domain/dates";
import { Suspense } from "react";
import { RefusedToast } from "@/components/app/refused-toast";
import { HomeView } from "./home";

export const metadata = { title: "Tableau de bord" };

export default async function Home() {
  const sb = await createClient();
  const t = today();
  const to = iso(addDays(t, 30));
  const {
    data: { user },
  } = await sb.auth.getUser();
  const [
    me,
    employees,
    leaves,
    marks,
    calls,
    repairs,
    errors,
    volumes,
    settings,
    announcements,
    assets,
    audit,
  ] = await Promise.all([
    sb
      .from("members")
      .select("full_name,email")
      .eq("id", user!.id)
      .maybeSingle(),
    getEmployees(sb, false),
    getLeaves(sb, iso(addDays(t, -30)), to),
    getMarks(sb, iso(addDays(t, -30)), to),
    getCalls(sb, iso(addDays(t, -7)), to),
    getRepairs(sb),
    getErrors(sb),
    getVolumes(sb),
    getSettings(sb),
    getAnnouncements(sb),
    getAssets(sb),
    getAudit(sb, { limit: 12 }),
  ]);
  const notes = await getNotes(sb);
  const pending = leaves.filter((l) => l.status === "pending");
  return (
    <>
      <Suspense>
        <RefusedToast />
      </Suspense>
      <HomeView
        name={(me.data?.full_name || me.data?.email || "").split(" ")[0]}
        employees={employees}
        leaves={leaves}
        pendingCount={pending.length}
        marks={marks}
        calls={calls}
        repairs={repairs}
        errors={errors.filter((e) => e.date >= iso(addDays(t, -400)))}
        volumes={volumes}
        settings={settings}
        announcements={announcements}
        assets={assets}
        audit={audit}
        notes={notes}
      />
    </>
  );
}
