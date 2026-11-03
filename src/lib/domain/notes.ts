import type { DeliveryNote } from "@/lib/types";
import { addDays, iso, today } from "./dates";

/** Remontée encore utile (non close, pas dépassée) */
export function isActive(n: DeliveryNote, ref = today()) {
  if (n.status === "done" || n.deleted_at) return false;
  const k = iso(ref);
  if (n.permanent) return !n.until_date || n.until_date >= k;
  return true;
}

export type Bucket = "late" | "today" | "tomorrow" | "week" | "later" | "nodate" | "permanent";
export const BUCKETS: Record<Bucket, string> = {
  late: "Date passée, non close",
  today: "Aujourd'hui",
  tomorrow: "Demain",
  week: "Dans les 7 jours",
  later: "Plus tard",
  nodate: "Sans date précise",
  permanent: "Consignes permanentes",
};

export function bucketOf(n: DeliveryNote, ref = today()): Bucket {
  if (n.permanent) return "permanent";
  if (!n.due_date) return "nodate";
  const k = iso(ref);
  if (n.due_date < k) return "late";
  if (n.due_date === k) return "today";
  if (n.due_date === iso(addDays(ref, 1))) return "tomorrow";
  if (n.due_date <= iso(addDays(ref, 7))) return "week";
  return "later";
}

/** Remontées à afficher sur le tableau de bord : échues, aujourd'hui, demain, et permanentes « Attention » */
export function forDashboard(notes: DeliveryNote[], ref = today()) {
  return notes
    .filter((n) => isActive(n, ref))
    .filter((n) => {
      const b = bucketOf(n, ref);
      return b === "late" || b === "today" || b === "tomorrow" || b === "nodate" || (b === "permanent" && n.level === "attention");
    })
    .sort((a, b) => order(a, ref) - order(b, ref));
}

const ORDER: Bucket[] = ["late", "today", "tomorrow", "week", "nodate", "later", "permanent"];
export const order = (n: DeliveryNote, ref = today()) => ORDER.indexOf(bucketOf(n, ref)) * 10 + (n.level === "attention" ? 0 : 1);
