"use server";
/* Temps de travail : seules les écritures de l'administrateur passent.
   Le contrôle est fait deux fois : ici (message clair) et surtout dans la base
   (règles RLS des tables worktime_settings et worktime_templates, public.is_admin()). */
import { revalidatePath } from "next/cache";
import { getPerms } from "@/lib/guard";
import { isAdmin } from "@/lib/perms";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PARAMS, DEFAULT_RULES, type Rule, type RuleKey, type WorkParams } from "@/lib/domain/worktime";

type Result = { ok: true } | { ok: false; error: string };
const REFUS = "Seul l'administrateur peut modifier le menu Temps de travail.";

async function adminOnly(): Promise<Result | null> {
  const p = await getPerms();
  return isAdmin(p) ? null : { ok: false, error: REFUS };
}
const fr = (msg: string) => (/row-level security|permission denied/i.test(msg) ? REFUS : msg);

export async function saveWorktimeSettings(params: Partial<WorkParams>, rules: Partial<Record<RuleKey, Partial<Rule>>>, verifiedOn: string): Promise<Result> {
  const refused = await adminOnly();
  if (refused) return refused;
  // on ne garde que des clés connues, des nombres positifs et des textes
  const p: Partial<WorkParams> = {};
  for (const k of Object.keys(DEFAULT_PARAMS) as (keyof WorkParams)[]) {
    const v = params[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 20000) p[k] = Math.round(v);
  }
  const r: Partial<Record<RuleKey, Partial<Rule>>> = {};
  for (const k of Object.keys(DEFAULT_RULES) as RuleKey[]) {
    const v = rules[k];
    if (!v) continue;
    const o: Partial<Rule> = {};
    for (const f of ["title", "text", "ref"] as const) if (typeof v[f] === "string" && v[f]!.trim()) o[f] = v[f]!.trim().slice(0, 600);
    if (Object.keys(o).length) r[k] = o;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn)) return { ok: false, error: "Date de vérification invalide." };
  const sb = await createClient();
  const { error } = await sb.from("worktime_settings").upsert({ id: 1, params: p, rules: r, verified_on: verifiedOn });
  if (error) return { ok: false, error: fr(error.message) };
  revalidatePath("/temps-de-travail");
  return { ok: true };
}

export async function saveWorktimeTemplate(name: string, kind: "controle" | "simulation", data: Record<string, unknown>): Promise<Result> {
  const refused = await adminOnly();
  if (refused) return refused;
  if (!name.trim()) return { ok: false, error: "Donnez un nom au modèle." };
  if (kind !== "controle" && kind !== "simulation") return { ok: false, error: "Type de modèle inconnu." };
  const sb = await createClient();
  const { error } = await sb.from("worktime_templates").insert({ name: name.trim().slice(0, 120), kind, data });
  if (error) return { ok: false, error: fr(error.message) };
  revalidatePath("/temps-de-travail");
  return { ok: true };
}

export async function deleteWorktimeTemplate(id: string): Promise<Result> {
  const refused = await adminOnly();
  if (refused) return refused;
  const sb = await createClient();
  const { error } = await sb.from("worktime_templates").delete().eq("id", id);
  if (error) return { ok: false, error: fr(error.message) };
  revalidatePath("/temps-de-travail");
  return { ok: true };
}
