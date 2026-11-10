import { ZONE_IDS, type DepotSummary, type DepotVehicle, type DepotZoneInfo, type ZoneId } from "./summary";

/** Résumé de base : chaque zone vide, complété ensuite par la page */
export function minimalSummary(vehicles: DepotVehicle[] = [], alerts: Partial<Record<ZoneId, number>> = {}, extra: Partial<Record<ZoneId, Partial<DepotZoneInfo>>> = {}): DepotSummary {
  const zones = Object.fromEntries(ZONE_IDS.map((id) => [id, { id, alerts: alerts[id] || 0, lines: [], ...extra[id] }])) as Record<ZoneId, DepotZoneInfo>;
  return { vehicles, teams: [], zones };
}
