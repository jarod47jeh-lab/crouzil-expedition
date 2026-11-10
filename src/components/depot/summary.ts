import type { Absence } from "@/lib/domain/conges";
import type { Asset, DeliveryNote, Employee, Repair, Team } from "@/lib/types";

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
/** Zone de travail par défaut de chaque équipe */
export const TEAM_ZONE: Record<Team, ZoneId> = { chauf: "quais", prep: "soft", commande: "bureau", bureau: "bureau" };
export const zoneOfEmployee = (e: Pick<Employee, "zone" | "team">): ZoneId => ((ZONE_IDS as readonly string[]).includes(e.zone || "") ? (e.zone as ZoneId) : TEAM_ZONE[e.team]);

export interface DepotStaff {
  id: string;
  name: string;
  team: Team;
  zone: ZoneId;
  avatar: Employee["avatar"];
  present: boolean;
  /** motif d'absence ou « présent » */
  status: string;
}
export interface DepotSummary {
  staff?: DepotStaff[];
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

const ABS_LABEL: Record<string, string> = { CP: "Congés payés", RTT: "RTT", REC: "Récupération", MAL: "Maladie / arrêt", FOR: "Formation", EVT: "Événement familial", CSS: "Congé sans solde", AUI: "Autre absence", RDV: "Rendez-vous", ABS: "Absence" };
/** Le personnel du jour, avec sa zone et sa présence */
export function buildStaff(employees: Employee[], absences: Absence[]): DepotStaff[] {
  return employees
    .filter((e) => e.active && !e.freelance)
    .map((e) => {
      const a = absences.find((x) => x.employee_id === e.id && !x.pending);
      return { id: e.id, name: e.name, team: e.team, zone: zoneOfEmployee(e), avatar: e.avatar, present: !a, status: a ? ABS_LABEL[a.type] || a.type : "Présent" };
    });
}
