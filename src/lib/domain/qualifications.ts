import type { Employee, Qualification, QualificationCategory, QualificationType, Team } from "@/lib/types";
import type { Tone } from "./constants";

export const QUAL_CATEGORIES: Record<QualificationCategory, { label: string; tone: Tone }> = {
  caces: { label: "CACES", tone: "violet" },
  conduite: { label: "Conduite", tone: "info" },
  secours: { label: "Secourisme", tone: "ok" },
  securite: { label: "Sécurité", tone: "warn" },
  autre: { label: "Autre", tone: "muted" },
};

/** Équipes suivies par défaut : celles qui conduisent des engins et des camions */
export const QUAL_TEAMS: Team[] = ["chauf", "prep"];
/** Une échéance à moins de 60 jours est « à renouveler » */
export const SOON_DAYS = 60;

export type QualState = "valid" | "soon" | "expired" | "missing" | "none";
export const QUAL_STATE: Record<QualState, { label: string; short: string; tone: Tone }> = {
  valid: { label: "Valide", short: "OK", tone: "ok" },
  soon: { label: "À renouveler bientôt", short: "Bientôt", tone: "warn" },
  expired: { label: "Expirée", short: "Expirée", tone: "bad" },
  missing: { label: "Obligatoire, manquante", short: "Manque", tone: "bad" },
  none: { label: "Non détenue", short: "—", tone: "muted" },
};

export const appliesTo = (t: QualificationType, team: Team) => t.active && (!t.teams || t.teams.length === 0 || t.teams.includes(team));

/** Échéance calculée : saisie, sinon date d'obtention + durée de validité */
export function expiryOf(q: Pick<Qualification, "obtained_on" | "expires_on">, t?: Pick<QualificationType, "validity_months">) {
  if (q.expires_on) return q.expires_on;
  if (!q.obtained_on || !t?.validity_months) return null;
  const d = new Date(q.obtained_on);
  d.setMonth(d.getMonth() + t.validity_months);
  return d.toISOString().slice(0, 10);
}

/** Dernière qualification d'un type pour un collaborateur, et son état */
export function qualStatus(t: QualificationType, e: Pick<Employee, "id" | "team">, quals: Qualification[], today: string) {
  const mine = quals.filter((q) => q.type_id === t.id && q.employee_id === e.id).sort((a, b) => (b.obtained_on || "").localeCompare(a.obtained_on || ""));
  const last = mine[0] || null;
  if (!last) return { state: (t.required && appliesTo(t, e.team) ? "missing" : "none") as QualState, last, expires: null as string | null };
  const expires = expiryOf(last, t);
  if (!expires) return { state: "valid" as QualState, last, expires };
  if (expires < today) return { state: "expired" as QualState, last, expires };
  const soon = new Date(today);
  soon.setDate(soon.getDate() + SOON_DAYS);
  return { state: (expires <= soon.toISOString().slice(0, 10) ? "soon" : "valid") as QualState, last, expires };
}
