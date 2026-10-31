import type { FieldDef } from "@/components/ui/entity-form";
import type { Asset } from "@/lib/types";

export const ASSET_FIELDS: FieldDef[] = [
  { name: "kind", label: "Type", type: "select", required: true, options: [["VEH", "Véhicule"], ["TRP", "Transpalette"], ["DIA", "Diable"], ["MAN", "Autre matériel"]] },
  { name: "name", label: "Nom / numéro", required: true, placeholder: "C15, Transpalette T206…" },
  { name: "ref", label: "Immatriculation ou référence", placeholder: "AB-123-CD" },
  { name: "designation", label: "Désignation", placeholder: "Heineken, Blanc…" },
  { name: "brand", label: "Marque" },
  { name: "model", label: "Modèle" },
  { name: "tonnage", label: "Tonnage", placeholder: "19T", when: (v) => v.kind === "VEH" },
  { name: "pallets", label: "Palettes", type: "number", when: (v) => v.kind === "VEH" },
  { name: "mileage", label: "Kilométrage actuel", type: "number", when: (v) => v.kind === "VEH" },
  { name: "assigned_to", label: "Affecté à" },
  { name: "ct_due", label: "Prochain contrôle technique", type: "date", when: (v) => v.kind === "VEH" },
  { name: "service_due", label: "Prochain entretien", type: "date" },
  { name: "insurance_due", label: "Échéance assurance", type: "date", when: (v) => v.kind === "VEH" },
  { name: "active", label: "En service", type: "checkbox" },
  { name: "note", label: "Note", type: "textarea" },
];

export const assetInitial = (a: Asset | null): Record<string, unknown> => (a ? { ...a } : { kind: "VEH", active: true });

/** Prochaine échéance (contrôle technique, entretien, assurance) */
export function nextDue(a: Asset) {
  const items = [
    { k: "Contrôle technique", d: a.ct_due },
    { k: "Entretien", d: a.service_due },
    { k: "Assurance", d: a.insurance_due },
  ].filter((x): x is { k: string; d: string } => !!x.d);
  items.sort((x, y) => x.d.localeCompare(y.d));
  return items[0] || null;
}
