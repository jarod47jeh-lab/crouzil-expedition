import type { DepotSummary, DepotVehicle, DepotZoneInfo } from "./summary";

/** Résumé minimal : pour les bandeaux 3D des pages, sans tout recalculer */
export function minimalSummary(vehicles: DepotVehicle[] = [], alerts: Partial<Record<DepotZoneInfo["id"], number>> = {}): DepotSummary {
  const z = (id: DepotZoneInfo["id"]): DepotZoneInfo => ({ id, alerts: alerts[id] || 0, lines: [] });
  return { vehicles, teams: [], zones: { cour: z("cour"), racks: z("racks"), prepa: z("prepa"), reserve: z("reserve"), quais: z("quais"), bureau: z("bureau"), parking: z("parking") } };
}
