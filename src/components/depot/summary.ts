import type { Asset, DeliveryNote, Repair } from "@/lib/types";

/** Zones du dépôt d'Ayguesvives, d'après le plan annoté */
export const ZONE_IDS = ["vide", "verres", "futs", "patio", "depose", "bureau", "soft", "vins", "sirop", "alcool", "quais", "parking"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Ce que la vue du dépôt affiche, calculé à partir des données de l'appli */
export interface DepotVehicle {
  id: string;
  name: string;
  plate: string | null;
  kind: string;
  driver: string | null;
  state: "ok" | "warn" | "bad";
  note: string;
}
export interface DepotZoneInfo {
  id: ZoneId;
  alerts: number;
  lines: { text: string; sub?: string; tone: "ok" | "warn" | "bad" }[];
  stat?: string;
}
export interface DepotSummary {
  vehicles: DepotVehicle[];
  zones: Record<DepotZoneInfo["id"], DepotZoneInfo>;
  teams: { key: string; label: string; present: number; total: number }[];
}

export function buildVehicles(assets: Asset[], repairs: Repair[], today: string): DepotVehicle[] {
  const open = repairs.filter((r) => ["A", "T", "V", "R"].includes(r.status) && !r.deleted_at);
  return assets
    .filter((a) => a.kind === "VEH" && a.active !== false && !a.deleted_at)
    .map((a) => {
      const rs = open.filter((r) => r.asset_id === a.id);
      const down = rs.find((r) => r.immobilized || r.urgency === "Bloquant");
      const dues = [
        ["CT", a.ct_due],
        ["Entretien", a.service_due],
        ["Assurance", a.insurance_due],
      ].filter((d): d is [string, string] => !!d[1]);
      const soon = dues.filter(([, d]) => (new Date(d).getTime() - new Date(today).getTime()) / 864e5 <= 30).sort((x, y) => x[1].localeCompare(y[1]))[0];
      const state: DepotVehicle["state"] = down ? "bad" : soon || rs.length ? "warn" : "ok";
      const note = down
        ? `Immobilisé : ${down.label}`
        : soon
          ? `${soon[0]} le ${new Date(soon[1]).toLocaleDateString("fr-FR")}`
          : rs.length
            ? `${rs.length} réparation(s) en cours`
            : "Disponible";
      return { id: a.id, name: a.name, plate: a.ref, kind: [a.designation, a.tonnage].filter(Boolean).join(" · ") || "Véhicule", driver: a.assigned_to, state, note };
    });
}

export function noteLine(n: DeliveryNote) {
  return { text: `${n.client_name ? n.client_name + " : " : ""}${n.body}`, sub: n.route || undefined, tone: (n.level === "attention" ? "bad" : "warn") as "bad" | "warn" };
}
