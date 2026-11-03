"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Kind = "text" | "num" | "int" | "bool" | "date" | "uuid";

/** Tables modifiables depuis l'interface et colonnes autorisées (avec leur type). */
const SCHEMA: Record<string, Record<string, Kind>> = {
  employees: {
    name: "text", job_title: "text", team: "text", freelance: "bool", cp_annual: "num", cp_carryover: "num", rtt_annual: "num",
    rec_due: "num", sort_order: "int", phone: "text", email: "text", hired_on: "date", notes: "text", active: "bool",
  },
  leave_requests: { employee_id: "uuid", type: "text", start_date: "date", end_date: "date", status: "text", comment: "text" },
  assets: {
    kind: "text", name: "text", ref: "text", designation: "text", brand: "text", model: "text", tonnage: "text", pallets: "int",
    assigned_to: "text", mileage: "int", ct_due: "date", service_due: "date", insurance_due: "date", note: "text", active: "bool",
  },
  repairs: {
    asset_id: "uuid", kind: "text", label: "text", category: "text", urgency: "text", immobilized: "bool", status: "text",
    observed_on: "date", expected_back: "date", mileage: "text", description: "text", note: "text", cost: "num", closed_on: "date",
  },
  clients: { name: "text", contact_name: "text", phone: "text", email: "text", address: "text", route: "text", notes: "text" },
  delivery_errors: {
    date: "date", client_id: "uuid", client_name: "text", route: "text", driver: "text", goods: "text", qty: "num", packaging: "text",
    error_type: "text", origin: "text", picker: "text", other_resp: "text", comment: "text",
  },
  journal_entries: { entry_date: "date", category: "text", body: "text", author: "text" },
  announcements: { kind: "text", tool: "text", body: "text", expires_on: "date" },
  delivery_notes: {
    level: "text", kind: "text", client_id: "uuid", client_name: "text", due_date: "date", until_date: "date", permanent: "bool",
    route: "text", source: "text", source_name: "text", body: "text", status: "text",
  },
};

/** Pages à rafraîchir après une écriture sur chaque table */
const PATHS: Record<string, string[]> = {
  employees: ["/equipe", "/conges", "/"],
  leave_requests: ["/conges", "/equipe", "/"],
  day_marks: ["/conges", "/"],
  freelance_calls: ["/conges", "/"],
  assets: ["/parc", "/reparations"],
  repairs: ["/reparations", "/parc", "/"],
  clients: ["/clients", "/erreurs"],
  delivery_errors: ["/erreurs", "/clients", "/"],
  delivery_volumes: ["/erreurs", "/"],
  error_justifications: ["/erreurs"],
  journal_entries: ["/journal", "/"],
  announcements: ["/"],
  delivery_notes: ["/remontees", "/clients", "/"],
  settings: ["/reglages", "/conges", "/reparations", "/erreurs", "/"],
};

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function revalidate(table: string) {
  for (const p of PATHS[table] || ["/"]) revalidatePath(p, p === "/" ? "page" : "layout");
  revalidatePath("/historique");
  revalidatePath("/corbeille");
}

function coerce(kind: Kind, v: unknown) {
  if (v === undefined) return undefined;
  if (kind === "bool") return v === true || v === "true" || v === "on" || v === "1";
  if (v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  if (kind === "num") {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (kind === "int") {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
  return s;
}

function clean(table: string, values: Record<string, unknown>) {
  const cols = SCHEMA[table];
  if (!cols) throw new Error("Table non autorisée");
  const out: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(cols)) {
    if (k in values) out[k] = coerce(kind, values[k]);
  }
  return out;
}

function frError(message: string) {
  if (/duplicate key|unique/i.test(message)) return "Cet élément existe déjà.";
  if (/row-level security|permission denied|0 rows|no rows|coerce the result|multiple \(or no\) rows/i.test(message))
    return "Action non autorisée : votre rôle ou vos menus ne permettent pas de modifier ici.";
  if (/violates check constraint/i.test(message)) return "Une valeur n'est pas valide.";
  if (/null value/i.test(message)) return "Un champ obligatoire est vide.";
  return message;
}

export async function saveRow(table: string, id: string | null, values: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const data = clean(table, values);
    if (table === "repairs" && (data.status === "F" || data.status === "X") && !data.closed_on) data.closed_on = new Date().toISOString().slice(0, 10);
    const q = id ? supabase.from(table).update(data).eq("id", id).select("id").single() : supabase.from(table).insert(data).select("id").single();
    const { data: row, error } = await q;
    if (error) return { ok: false, error: frError(error.message) };
    revalidate(table);
    return { ok: true, data: { id: row.id as string } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function patchRows(table: string, ids: string[], values: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const data = clean(table, values);
  const { data: rows, error } = await supabase.from(table).update(data).in("id", ids).select("id");
  if (error) return { ok: false, error: frError(error.message) };
  if (!rows?.length) return { ok: false, error: frError("0 rows") };
  revalidate(table);
  return { ok: true };
}

/** Mise à la corbeille (restaurable 30 jours) */
export async function trashRows(table: string, ids: string[]): Promise<ActionResult> {
  if (!SCHEMA[table]) return { ok: false, error: "Table non autorisée" };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).in("id", ids).select("id");
  if (error) return { ok: false, error: frError(error.message) };
  if (!rows?.length) return { ok: false, error: frError("0 rows") };
  revalidate(table);
  return { ok: true };
}

export async function restoreRow(table: string, id: string): Promise<ActionResult> {
  if (!SCHEMA[table]) return { ok: false, error: "Table non autorisée" };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id).select("id");
  if (error) return { ok: false, error: frError(error.message) };
  if (!rows?.length) return { ok: false, error: frError("0 rows") };
  revalidate(table);
  return { ok: true };
}

export async function destroyRow(table: string, id: string): Promise<ActionResult> {
  if (!SCHEMA[table]) return { ok: false, error: "Table non autorisée" };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id).not("deleted_at", "is", null);
  if (error) return { ok: false, error: frError(error.message) };
  revalidate(table);
  return { ok: true };
}

export async function purgeTrash(): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_trash", { days: 30 });
  if (error) return { ok: false, error: frError(error.message) };
  revalidatePath("/corbeille");
  return { ok: true, data: data as number };
}

// ---------------------------------------------------------------------
// Actions spécifiques
// ---------------------------------------------------------------------

export async function decideLeave(id: string, status: "approved" | "rejected" | "pending"): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status, decided_at: status === "pending" ? null : new Date().toISOString(), decided_by: status === "pending" ? null : user?.id })
    .eq("id", id);
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("leave_requests");
  return { ok: true };
}

/** Saisie rapide du planning : un type par jour (PRES = présent, efface l'absence) */
export async function setDayMarks(employeeId: string, dates: string[], type: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (type === "CLEAR") {
    const { error } = await supabase.from("day_marks").delete().eq("employee_id", employeeId).in("date", dates);
    if (error) return { ok: false, error: frError(error.message) };
  } else {
    const rows = dates.map((date) => ({ employee_id: employeeId, date, type }));
    const { error } = await supabase.from("day_marks").upsert(rows, { onConflict: "employee_id,date" });
    if (error) return { ok: false, error: frError(error.message) };
  }
  revalidate("day_marks");
  return { ok: true };
}

export async function setFreelanceCall(employeeId: string, date: string, triggered: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = triggered
    ? await supabase.from("freelance_calls").upsert({ employee_id: employeeId, date, triggered: true }, { onConflict: "employee_id,date" })
    : await supabase.from("freelance_calls").delete().eq("employee_id", employeeId).eq("date", date);
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("freelance_calls");
  return { ok: true };
}

export async function saveSettings(values: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const kinds: Record<string, Kind> = {
    max_abs: "int", max_abs_prep: "int", conformity_target: "num", repair_contact_name: "text", repair_contact_email: "text", signature: "text",
  };
  const data: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(kinds)) if (k in values) data[k] = coerce(kind, values[k]);
  const { error } = await supabase.from("settings").update(data).eq("id", 1);
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("settings");
  return { ok: true };
}

export async function saveJustification(errorId: string, values: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const keys = ["q_ordre", "q_accord", "q_double", "q_bon", "q_rupture", "q_consigne", "employee_account", "evidence", "manager_notes", "conclusion", "collected_on"];
  const data: Record<string, unknown> = { error_id: errorId };
  for (const k of keys) data[k] = k === "collected_on" ? coerce("date", values[k]) : values[k] == null ? null : String(values[k]);
  if (data.conclusion == null) data.conclusion = "";
  const { error } = await supabase.from("error_justifications").upsert(data, { onConflict: "error_id" });
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("error_justifications");
  return { ok: true };
}

export async function deleteJustification(errorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("error_justifications").delete().eq("error_id", errorId);
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("error_justifications");
  return { ok: true };
}

export async function saveVolume(date: string, deliveries: number | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } =
    deliveries == null
      ? await supabase.from("delivery_volumes").delete().eq("date", date)
      : await supabase.from("delivery_volumes").upsert({ date, deliveries }, { onConflict: "date" });
  if (error) return { ok: false, error: frError(error.message) };
  revalidate("delivery_volumes");
  return { ok: true };
}

export interface ImportedError {
  import_key: string;
  date: string;
  client_name: string;
  route: string;
  driver: string;
  goods: string;
  qty: number;
  packaging: string;
  error_type: string;
  origin: string;
  picker: string;
  other_resp: string;
  comment: string;
}

/** Import du fichier Suivi_Erreurs.xlsx (lu dans le navigateur) : ajoute ou met à jour, sans doublon. */
export async function importErrors(rows: ImportedError[], volumes: Record<string, number>, source: string): Promise<ActionResult<{ errors: number; clients: number; volumes: number }>> {
  const supabase = await createClient();
  // 1. Clients manquants
  const names = [...new Set(rows.map((r) => r.client_name.trim()).filter(Boolean))];
  const { data: existing, error: e1 } = await supabase.from("clients").select("id,name");
  if (e1) return { ok: false, error: frError(e1.message) };
  const byName = new Map((existing || []).map((c) => [String(c.name).toUpperCase(), c.id as string]));
  const missing = names.filter((n) => !byName.has(n.toUpperCase()));
  if (missing.length) {
    const { data: created, error: e2 } = await supabase.from("clients").insert(missing.map((name) => ({ name }))).select("id,name");
    if (e2) return { ok: false, error: frError(e2.message) };
    (created || []).forEach((c) => byName.set(String(c.name).toUpperCase(), c.id as string));
  }
  // 2. Erreurs (par paquets)
  const payload = rows.map((r) => ({ ...r, client_id: byName.get(r.client_name.trim().toUpperCase()) || null, source }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase.from("delivery_errors").upsert(payload.slice(i, i + 500), { onConflict: "import_key" });
    if (error) return { ok: false, error: frError(error.message) };
  }
  // 3. Volumes livrés
  const vol = Object.entries(volumes).map(([date, deliveries]) => ({ date, deliveries }));
  if (vol.length) {
    const { error } = await supabase.from("delivery_volumes").upsert(vol, { onConflict: "date" });
    if (error) return { ok: false, error: frError(error.message) };
  }
  revalidate("delivery_errors");
  revalidate("clients");
  return { ok: true, data: { errors: rows.length, clients: missing.length, volumes: vol.length } };
}

export async function addRepairPhoto(repairId: string, path: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("repair_photos").insert({ repair_id: repairId, path });
  if (error) return { ok: false, error: frError(error.message) };
  revalidatePath(`/reparations/${repairId}`);
  return { ok: true };
}

export async function removeRepairPhoto(id: string, path: string, repairId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.storage.from("repair-photos").remove([path]);
  const { error } = await supabase.from("repair_photos").delete().eq("id", id);
  if (error) return { ok: false, error: frError(error.message) };
  revalidatePath(`/reparations/${repairId}`);
  return { ok: true };
}

export async function setNoteStatus(ids: string[], status: "todo" | "ack" | "done"): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("delivery_notes")
    .update({ status, handled_at: status === "todo" ? null : new Date().toISOString(), handled_by: status === "todo" ? null : user?.id })
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: frError(error.message) };
  if (!data?.length) return { ok: false, error: frError("0 rows") };
  revalidate("delivery_notes");
  return { ok: true };
}
