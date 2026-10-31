import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Announcement, Asset, AuditEntry, Client, DayMark, DeliveryError, Employee, FreelanceCall, JournalEntry, Justification, LeaveRequest, Member, Repair, Settings,
} from "@/lib/types";

type SB = Awaited<ReturnType<typeof createClient>>;
interface Ranged {
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

/** Lit toutes les lignes (Supabase limite à 1000 par requête) */
async function all<T>(build: () => Ranged): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function db() {
  return createClient();
}

export async function getSettings(sb?: SB): Promise<Settings> {
  sb ||= await createClient();
  const { data } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  return (data as Settings) || { id: 1, max_abs: 4, max_abs_prep: 2, conformity_target: 98, repair_contact_name: "Nicolas", repair_contact_email: null, signature: "Le service expédition" };
}

export async function getEmployees(sb?: SB, withInactive = true) {
  sb ||= await createClient();
  const rows = await all<Employee>(() => sb!.from("employees").select("*").is("deleted_at", null).order("sort_order").order("name"));
  return withInactive ? rows : rows.filter((e) => e.active);
}

export async function getLeaves(sb?: SB, from?: string, to?: string) {
  sb ||= await createClient();
  return all<LeaveRequest>(() => {
    let q = sb!.from("leave_requests").select("*").is("deleted_at", null);
    if (to) q = q.lte("start_date", to);
    if (from) q = q.gte("end_date", from);
    return q.order("start_date", { ascending: false });
  });
}

export async function getMarks(sb?: SB, from?: string, to?: string) {
  sb ||= await createClient();
  return all<DayMark>(() => {
    let q = sb!.from("day_marks").select("id,employee_id,date,type");
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    return q.order("date");
  });
}

export async function getCalls(sb?: SB, from?: string, to?: string) {
  sb ||= await createClient();
  return all<FreelanceCall>(() => {
    let q = sb!.from("freelance_calls").select("id,employee_id,date,triggered");
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    return q;
  });
}

export async function getAssets(sb?: SB) {
  sb ||= await createClient();
  return all<Asset>(() => sb!.from("assets").select("*").is("deleted_at", null).order("kind").order("name"));
}

export async function getRepairs(sb?: SB) {
  sb ||= await createClient();
  return all<Repair>(() => sb!.from("repairs").select("*").is("deleted_at", null).order("observed_on", { ascending: false }));
}

export async function getClients(sb?: SB) {
  sb ||= await createClient();
  return all<Client>(() => sb!.from("clients").select("*").is("deleted_at", null).order("name"));
}

export async function getErrors(sb?: SB) {
  sb ||= await createClient();
  return all<DeliveryError>(() => sb!.from("delivery_errors").select("*").is("deleted_at", null).order("date", { ascending: false }));
}

export async function getVolumes(sb?: SB) {
  sb ||= await createClient();
  const rows = await all<{ date: string; deliveries: number }>(() => sb!.from("delivery_volumes").select("date,deliveries").order("date"));
  return Object.fromEntries(rows.map((r) => [r.date, r.deliveries])) as Record<string, number>;
}

export async function getJustifications(sb?: SB) {
  sb ||= await createClient();
  return all<Justification>(() => sb!.from("error_justifications").select("*"));
}

export async function getJournal(sb?: SB) {
  sb ||= await createClient();
  return all<JournalEntry>(() => sb!.from("journal_entries").select("*").is("deleted_at", null).order("entry_date", { ascending: false }).order("created_at", { ascending: false }));
}

export async function getAnnouncements(sb?: SB) {
  sb ||= await createClient();
  return all<Announcement>(() => sb!.from("announcements").select("*").is("deleted_at", null).order("created_at", { ascending: false }));
}

export async function getMembers(sb?: SB) {
  sb ||= await createClient();
  const { data } = await sb.from("members").select("*").order("created_at");
  return (data || []) as Member[];
}

export async function getAudit(sb?: SB, opts: { table?: string; rowId?: string; limit?: number } = {}) {
  sb ||= await createClient();
  let q = sb.from("audit_log").select("id,at,actor_email,table_name,row_id,action,label,old_data,new_data").order("at", { ascending: false }).limit(opts.limit || 200);
  if (opts.table) q = q.eq("table_name", opts.table);
  if (opts.rowId) q = q.eq("row_id", opts.rowId);
  const { data } = await q;
  return (data || []) as AuditEntry[];
}
