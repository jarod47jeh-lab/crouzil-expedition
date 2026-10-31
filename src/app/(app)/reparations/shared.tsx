"use client";
import { EntityForm } from "@/components/ui/entity-form";
import { ASSET_KINDS, REPAIR_CATS, REPAIR_STATUS, URGENCIES } from "@/lib/domain/constants";
import { iso, today } from "@/lib/domain/dates";
import type { Asset, Repair } from "@/lib/types";

export const assetLabel = (a: Asset) => {
  const main = [a.name, a.designation].filter(Boolean).join(" ");
  return a.ref ? `${main} (${a.ref})` : main;
};

export function RepairForm({ open, onClose, row, assets, defaultAsset, onSaved }: { open: boolean; onClose: () => void; row: Repair | null; assets: Asset[]; defaultAsset?: string; onSaved?: (id: string) => void }) {
  const opts = (["VEH", "TRP", "DIA", "MAN"] as const).flatMap((k) =>
    assets.filter((a) => a.kind === k && (a.active || a.id === row?.asset_id)).map((a) => [a.id, `${ASSET_KINDS[k].label} · ${assetLabel(a)}`] as [string, string]),
  );
  return (
    <EntityForm
      open={open}
      onClose={onClose}
      onSaved={onSaved}
      title={row ? "Modifier la demande de réparation" : "Nouvelle demande de réparation"}
      table="repairs"
      id={row?.id}
      initial={
        row
          ? { ...row }
          : { asset_id: defaultAsset || "", category: "Panne", urgency: "Normal", immobilized: false, status: "A", observed_on: iso(today()), kind: "VEH", label: "" }
      }
      transform={(v) => {
        const a = assets.find((x) => x.id === v.asset_id);
        return { ...v, kind: a ? a.kind : v.kind || "MAN", label: a && (!v.label || !row) ? assetLabel(a) : v.label };
      }}
      validate={(v) => (!v.asset_id && !String(v.label || "").trim() ? "Choisissez un véhicule ou un matériel, ou donnez un libellé." : null)}
      fields={[
        { name: "asset_id", label: "Véhicule ou matériel", type: "select", full: true, options: opts, hint: "Laissez vide pour un matériel hors parc, puis donnez un libellé." },
        { name: "label", label: "Libellé", full: true, when: (v) => !v.asset_id, placeholder: "Ex. Hayon arrière quai 2" },
        { name: "category", label: "Type de problème", type: "select", required: true, options: REPAIR_CATS },
        { name: "urgency", label: "Urgence", type: "select", required: true, options: URGENCIES },
        { name: "immobilized", label: "Immobilisé (ne peut plus être utilisé)", type: "checkbox", full: true },
        { name: "description", label: "Description du problème", type: "textarea", required: true },
        { name: "observed_on", label: "Constaté le", type: "date", required: true },
        { name: "status", label: "Statut", type: "select", required: true, options: Object.entries(REPAIR_STATUS).map(([k, v]) => [k, v.label]) },
        { name: "mileage", label: "Kilométrage", placeholder: "Ex. 182 500" },
        { name: "expected_back", label: "Retour prévu le", type: "date" },
        { name: "cost", label: "Coût (€ HT)", type: "number", step: "0.01" },
        { name: "closed_on", label: "Clôturé le", type: "date", when: (v) => v.status === "F" || v.status === "X" },
        { name: "note", label: "Suivi / note interne", type: "textarea" },
      ]}
    />
  );
}
