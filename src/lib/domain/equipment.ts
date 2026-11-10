import type { Employee, EquipmentIssue, EquipmentItem, SizeKind, Team } from "@/lib/types";
import type { Tone } from "./constants";

export const SIZE_KINDS: { k: SizeKind; label: string; col: keyof Employee; options: string[] }[] = [
  { k: "top", label: "Haut", col: "size_top", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] },
  { k: "bottom", label: "Pantalon", col: "size_bottom", options: ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60", "62"] },
  { k: "shoe", label: "Pointure", col: "size_shoe", options: Array.from({ length: 16 }, (_, i) => String(35 + i)) },
  { k: "gloves", label: "Gants", col: "size_gloves", options: ["6 (XS)", "7 (S)", "8 (M)", "9 (L)", "10 (XL)", "11 (XXL)", "12 (3XL)"] },
];
export const sizeOf = (e: Employee, k: SizeKind | null) => (k ? ((e[SIZE_KINDS.find((s) => s.k === k)!.col] as string | null) ?? null) : null);

export const CATEGORIES: Record<EquipmentItem["category"], { label: string; tone: Tone }> = {
  tenue: { label: "Tenue", tone: "info" },
  epi: { label: "EPI", tone: "warn" },
  outil: { label: "Matériel", tone: "violet" },
  acces: { label: "Accès", tone: "muted" },
};

export const applies = (it: EquipmentItem, team: Team) => it.active && (!it.teams || it.teams.length === 0 || it.teams.includes(team));

export type IssueState = "none" | "ok" | "unsigned" | "renew" | "returned";
export const ISSUE_STATE: Record<IssueState, { label: string; tone: Tone; short: string }> = {
  none: { label: "Non remis", tone: "muted", short: "—" },
  ok: { label: "Remis et émargé", tone: "ok", short: "OK" },
  unsigned: { label: "Remis, émargement à faire", tone: "warn", short: "À signer" },
  renew: { label: "À renouveler", tone: "bad", short: "À renouv." },
  returned: { label: "Restitué", tone: "muted", short: "Rendu" },
};

/** Dernière dotation d'un article pour un collaborateur, et son état */
export function issueStatus(it: EquipmentItem, empId: string, issues: EquipmentIssue[], today: string) {
  const mine = issues.filter((i) => i.item_id === it.id && i.employee_id === empId).sort((a, b) => b.issued_on.localeCompare(a.issued_on));
  const last = mine[0] || null;
  if (!last) return { state: "none" as IssueState, last, due: null as string | null };
  if (last.returned_on) return { state: "returned" as IssueState, last, due: null };
  let due: string | null = null;
  if (it.renewal_months) {
    const d = new Date(last.issued_on);
    d.setMonth(d.getMonth() + it.renewal_months);
    due = d.toISOString().slice(0, 10);
  }
  if (due && due <= today) return { state: "renew" as IssueState, last, due };
  return { state: (last.signed ? "ok" : "unsigned") as IssueState, last, due };
}
