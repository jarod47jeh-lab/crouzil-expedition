/**
 * Reprise des données de l'artefact « Espace Expédition » vers Supabase.
 *
 * Usage :
 *   npm run import:artifact -- ./export
 *
 * Le dossier ./export contient un sous-dossier par collection de l'artefact
 * (team, requests, days, calls, settings, fleet, repairs, errors, justifs, journal, board),
 * avec un fichier JSON par document (<id>.json).
 *
 * Le script peut être relancé sans créer de doublons : chaque ligne garde l'identifiant
 * d'origine (legacy_id, import_key) et est mise à jour si elle existe déjà.
 * Variables nécessaires (.env.local) : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { errorKeys } from "../src/lib/domain/errors";

config({ path: ".env.local" });
config();

const dir = process.argv[2] || "./export";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires (fichier .env.local).");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Doc = Record<string, unknown> & { _id: string };
const load = (col: string): Doc[] => {
  const p = join(dir, col);
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ ...JSON.parse(readFileSync(join(p, f), "utf8")), _id: f.replace(/\.json$/, "") }));
};
const s = (v: unknown) => (v == null || v === "" ? null : String(v));
const n = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const d = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(`${label} : ${error.message}`);
  return data;
}
async function chunks<T>(rows: T[], size: number, fn: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  console.log(`Import depuis ${dir}\n`);

  // ---- Réglages
  const settings = load("settings").find((x) => x._id === "main");
  if (settings) {
    await must("settings", sb.from("settings").update({ max_abs: n(settings.maxAbs) ?? 4, max_abs_prep: n(settings.maxAbsPrep) ?? 2 }).eq("id", 1));
    console.log("✓ Réglages");
  }

  // ---- Équipe
  const team = load("team");
  const empRows = team.map((t) => ({
    legacy_id: t._id,
    name: String(t.name || t._id),
    job_title: s(t.role) ?? (t.group === "prep" ? "Préparateur de commandes" : t.freelance ? "Chauffeur-livreur (freelance)" : "Chauffeur-livreur"),
    team: t.group === "prep" ? "prep" : "chauf",
    freelance: !!t.freelance,
    cp_annual: n(t.cp) ?? 25,
    cp_carryover: n(t.report) ?? 0,
    rtt_annual: n(t.rtt) ?? 10,
    rec_due: n(t.rec) ?? 0,
    sort_order: n(t.order) ?? 0,
  }));
  const emps = await must("employees", sb.from("employees").upsert(empRows, { onConflict: "legacy_id" }).select("id,legacy_id"));
  const emp = new Map((emps || []).map((e) => [e.legacy_id as string, e.id as string]));
  console.log(`✓ Équipe : ${emps?.length} collaborateurs`);

  // ---- Demandes de congés
  const ST: Record<string, string> = { Validé: "approved", "En attente": "pending", Refusé: "rejected" };
  const reqs = load("requests")
    .filter((r) => emp.has(String(r.who)) && d(r.start) && d(r.end))
    .map((r) => ({
      legacy_id: r._id,
      employee_id: emp.get(String(r.who))!,
      type: String(r.type),
      start_date: d(r.start)!,
      end_date: d(r.end)! < d(r.start)! ? d(r.start)! : d(r.end)!,
      status: ST[String(r.status)] || "pending",
      comment: s(r.comment),
      created_at: d(r.created) ? `${d(r.created)}T08:00:00Z` : new Date().toISOString(),
    }));
  if (reqs.length) await must("leave_requests", sb.from("leave_requests").upsert(reqs, { onConflict: "legacy_id" }));
  console.log(`✓ Congés : ${reqs.length} demandes`);

  // ---- Saisie jour par jour
  const marks = load("days")
    .filter((x) => emp.has(String(x.who)) && d(x.date))
    .map((x) => ({ employee_id: emp.get(String(x.who))!, date: d(x.date)!, type: String(x.type) }));
  if (marks.length) await must("day_marks", sb.from("day_marks").upsert(marks, { onConflict: "employee_id,date" }));
  console.log(`✓ Planning : ${marks.length} jours saisis`);

  // ---- Freelances déclenchés
  const calls = load("calls")
    .filter((x) => x.state === "DEC" && emp.has(String(x.who)) && d(x.date))
    .map((x) => ({ employee_id: emp.get(String(x.who))!, date: d(x.date)!, triggered: true }));
  if (calls.length) await must("freelance_calls", sb.from("freelance_calls").upsert(calls, { onConflict: "employee_id,date" }));
  console.log(`✓ Freelances : ${calls.length} jours déclenchés`);

  // ---- Parc
  const fleet = load("fleet").map((f) => ({
    legacy_id: f._id,
    kind: ["VEH", "TRP", "DIA", "MAN"].includes(String(f.kind)) ? String(f.kind) : "MAN",
    name: String(f.name || f._id),
    ref: s(f.ref),
    designation: s(f.designation),
    brand: s(f.marque),
    model: s(f.modele),
    tonnage: s(f.tonnage),
    pallets: n(f.palettes),
    assigned_to: s(f.affecte),
    note: s(f.note),
  }));
  const assets = fleet.length ? await must("assets", sb.from("assets").upsert(fleet, { onConflict: "legacy_id" }).select("id,legacy_id")) : [];
  const asset = new Map((assets || []).map((a) => [a.legacy_id as string, a.id as string]));
  console.log(`✓ Parc : ${fleet.length} véhicules et matériels`);

  // ---- Réparations (+ photos)
  const repDocs = load("repairs");
  const reps = repDocs.map((r) => ({
    legacy_id: r._id,
    asset_id: r.fleetId ? asset.get(String(r.fleetId)) || null : null,
    kind: ["VEH", "TRP", "DIA", "MAN"].includes(String(r.kind)) ? String(r.kind) : "MAN",
    label: String(r.label || "Sans nom"),
    category: ["Panne", "Casse", "Usure", "Sécurité", "Entretien", "Autre"].includes(String(r.cat)) ? String(r.cat) : "Autre",
    urgency: ["Bloquant", "Urgent", "Normal"].includes(String(r.urg)) ? String(r.urg) : "Normal",
    immobilized: !!r.imm,
    status: ["A", "T", "V", "R", "F", "X"].includes(String(r.status)) ? String(r.status) : "A",
    observed_on: d(r.date) || d(r.created) || new Date().toISOString().slice(0, 10),
    expected_back: d(r.back),
    mileage: s(r.km),
    description: s(r.desc),
    note: s(r.note),
    created_at: d(r.created) ? `${d(r.created)}T08:00:00Z` : new Date().toISOString(),
  }));
  const repIds = reps.length ? await must("repairs", sb.from("repairs").upsert(reps, { onConflict: "legacy_id" }).select("id,legacy_id")) : [];
  const repair = new Map((repIds || []).map((r) => [r.legacy_id as string, r.id as string]));
  let photos = 0;
  for (const r of repDocs) {
    const id = repair.get(r._id);
    const list = Array.isArray(r.photos) ? (r.photos as { id?: string; src?: string }[]) : [];
    for (const [i, p] of list.entries()) {
      const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(p.src || "");
      if (!id || !m) continue;
      const path = `${id}/legacy-${p.id || i}.${m[1].split("/")[1].replace("jpeg", "jpg")}`;
      const { error } = await sb.storage.from("repair-photos").upload(path, Buffer.from(m[2], "base64"), { contentType: m[1], upsert: true });
      if (error) {
        console.warn(`  ! photo ${path} : ${error.message}`);
        continue;
      }
      const { data: exists } = await sb.from("repair_photos").select("id").eq("path", path).maybeSingle();
      if (!exists) await must("repair_photos", sb.from("repair_photos").insert({ repair_id: id, path }));
      photos++;
    }
  }
  console.log(`✓ Réparations : ${reps.length} demandes, ${photos} photo(s)`);

  // ---- Erreurs de livraison, clients, volumes
  const errDoc = load("errors").find((x) => x._id === "all");
  if (errDoc) {
    type Raw = { date: string; client?: string; tournee?: string; chauffeur?: string; marchandise?: string; qte?: number; cond?: string; type?: string; origine?: string; prep?: string; autre?: string; commentaire?: string };
    const rows = ((errDoc.rows as Raw[]) || []).filter((r) => d(r.date));
    const mapped = rows.map((r) => ({
      date: d(r.date)!,
      client_name: String(r.client || "").trim(),
      route: String(r.tournee || ""),
      driver: String(r.chauffeur || ""),
      goods: String(r.marchandise || ""),
      qty: Number(r.qte) || 0,
      packaging: String(r.cond || ""),
      error_type: String(r.type || ""),
      origin: String(r.origine || ""),
      picker: String(r.prep || ""),
      other_resp: String(r.autre || ""),
      comment: String(r.commentaire || ""),
    }));
    const keys = errorKeys(mapped);

    const existing = await must("clients", sb.from("clients").select("id,name"));
    const byName = new Map((existing || []).map((c) => [String(c.name).toUpperCase(), c.id as string]));
    const missing = [...new Set(mapped.map((r) => r.client_name).filter(Boolean))].filter((c) => !byName.has(c.toUpperCase()));
    if (missing.length) {
      const created = await must("clients", sb.from("clients").insert(missing.map((name) => ({ name }))).select("id,name"));
      (created || []).forEach((c) => byName.set(String(c.name).toUpperCase(), c.id as string));
    }
    const payload = mapped.map((r, i) => ({ ...r, import_key: keys[i], client_id: byName.get(r.client_name.toUpperCase()) || null, source: s(errDoc.source) || "artefact" }));
    await chunks(payload, 500, (part) => must("delivery_errors", sb.from("delivery_errors").upsert(part, { onConflict: "import_key" })));
    const liv = Object.entries((errDoc.liv as Record<string, number>) || {})
      .filter(([k, v]) => d(k) && Number(v) > 0)
      .map(([date, v]) => ({ date, deliveries: Number(v) }));
    if (liv.length) await must("delivery_volumes", sb.from("delivery_volumes").upsert(liv, { onConflict: "date" }));
    console.log(`✓ Erreurs : ${payload.length} erreurs, ${missing.length} clients créés, ${liv.length} jours de volumes`);

    // Justifications (clé identique à l'artefact)
    const just = load("justifs");
    if (just.length) {
      const errs = await must("delivery_errors ids", sb.from("delivery_errors").select("id,import_key").in("import_key", just.map((j) => j._id)));
      const byKey = new Map((errs || []).map((e) => [e.import_key as string, e.id as string]));
      const jr = just
        .filter((j) => byKey.has(j._id))
        .map((j) => ({
          error_id: byKey.get(j._id)!,
          q_ordre: s(j.ordre), q_accord: s(j.accord), q_double: s(j.double), q_bon: s(j.bon), q_rupture: s(j.rupture), q_consigne: s(j.consigne),
          employee_account: s(j.circ), evidence: s(j.preuve), manager_notes: s(j.obs), conclusion: s(j.conclusion) ?? "", collected_on: d(j.le),
        }));
      if (jr.length) await must("error_justifications", sb.from("error_justifications").upsert(jr, { onConflict: "error_id" }));
      console.log(`✓ Justifications : ${jr.length}`);
    }
  }

  // ---- Journal de bord
  const journal = load("journal").map((j) => ({
    legacy_id: j._id,
    entry_date: d(j.date) || new Date(Number(j.ts) || Date.now()).toISOString().slice(0, 10),
    category: ["evt", "rem", "note", "inc"].includes(String(j.cat)) ? String(j.cat) : "note",
    body: String(j.text || ""),
    author: s(j.author),
    created_at: j.ts ? new Date(Number(j.ts)).toISOString() : new Date().toISOString(),
  }));
  if (journal.length) await must("journal_entries", sb.from("journal_entries").upsert(journal, { onConflict: "legacy_id" }));
  console.log(`✓ Journal : ${journal.length} entrées`);

  // ---- À la une
  const board = load("board");
  if (board.length) {
    const { count } = await sb.from("announcements").select("id", { count: "exact", head: true });
    if (!count) {
      await must(
        "announcements",
        sb.from("announcements").insert(
          board.map((b) => ({ kind: ["prio", "new", "info"].includes(String(b.type)) ? String(b.type) : "info", tool: s(b.tool), body: String(b.text || ""), created_at: b.ts ? new Date(Number(b.ts)).toISOString() : new Date().toISOString() })),
        ),
      );
    }
    console.log(`✓ À la une : ${board.length} message(s)`);
  }

  console.log("\nImport terminé.");
}

main().catch((e) => {
  console.error("\n✗ " + (e instanceof Error ? e.message : e));
  process.exit(1);
});
