import type { DeliveryError } from "@/lib/types";
import { isDriverOrigin, isPickerOrigin } from "./constants";

/** Clé stable d'une ligne du fichier Excel, pour réimporter sans créer de doublons. */
export function errorKeys(rows: { date: string; client_name: string; error_type: string; goods: string; qty: number | string; picker: string; driver: string; other_resp: string; comment: string }[]) {
  const seen: Record<string, number> = {};
  return rows.map((r) => {
    const s = [r.date, r.client_name, r.error_type, r.goods, r.qty, r.picker, r.driver, r.other_resp, (r.comment || "").slice(0, 60)].join("|");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const b = `${r.date}_${(h >>> 0).toString(36)}`;
    seen[b] = (seen[b] || 0) + 1;
    return seen[b] > 1 ? `${b}-${seen[b]}` : b;
  });
}

export type Scope = "global" | "prep" | "liv";
export const scopeOf = (e: Pick<DeliveryError, "origin">): Scope[] => ["global", ...(isPickerOrigin(e.origin) ? (["prep"] as Scope[]) : []), ...(isDriverOrigin(e.origin) ? (["liv"] as Scope[]) : [])];

/** Taux de conformité sur les jours où le nombre de livraisons est connu. */
export function conformity(errors: DeliveryError[], volumes: Record<string, number>, inPeriod: (d: string) => boolean) {
  const days = Object.keys(volumes).filter((d) => volumes[d] > 0 && inPeriod(d));
  const deliveries = days.reduce((s, d) => s + volumes[d], 0);
  if (!deliveries) return null;
  const set = new Set(days);
  const e = errors.filter((x) => set.has(x.date));
  const rate = (n: number) => 100 - (n / deliveries) * 100;
  return {
    deliveries,
    days: days.length,
    global: rate(e.length),
    prep: rate(e.filter((x) => isPickerOrigin(x.origin)).length),
    liv: rate(e.filter((x) => isDriverOrigin(x.origin)).length),
    errors: e.length,
  };
}

export const originGroup = (o?: string | null) => (isPickerOrigin(o) ? "Préparation" : isDriverOrigin(o) ? "Livraison" : !o || o === "Inconnu" ? "Inconnu" : "Autre");
