import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { ASSET_KINDS, LEAVE_LABEL, LEAVE_STATUS, REPAIR_STATUS, TABLE_LABELS } from "@/lib/domain/constants";
import { fmtDateTime } from "@/lib/domain/dates";
import type { AuditEntry } from "@/lib/types";

const META = new Set(["id", "created_at", "created_by", "updated_at", "updated_by", "legacy_id", "import_key"]);
const FIELD: Record<string, string> = {
  name: "Nom", job_title: "Fonction", team: "Équipe", freelance: "Freelance", cp_annual: "CP annuels", cp_carryover: "Report", rtt_annual: "RTT", rec_due: "Récup.",
  phone: "Téléphone", email: "E-mail", notes: "Notes", active: "Actif", type: "Type", start_date: "Début", end_date: "Fin", status: "Statut", comment: "Commentaire",
  label: "Libellé", category: "Catégorie", urgency: "Urgence", immobilized: "Immobilisé", observed_on: "Constaté le", expected_back: "Retour prévu", description: "Description",
  note: "Note", cost: "Coût", ref: "Référence", designation: "Désignation", brand: "Marque", model: "Modèle", mileage: "Kilométrage", ct_due: "Contrôle technique",
  service_due: "Entretien", insurance_due: "Assurance", assigned_to: "Affecté à", client_name: "Client", error_type: "Erreur", origin: "Origine", picker: "Préparateur",
  driver: "Chauffeur", goods: "Marchandise", qty: "Quantité", body: "Texte", entry_date: "Date", deleted_at: "Corbeille", date: "Date", deliveries: "Livraisons",
  max_abs: "Seuil absents", max_abs_prep: "Seuil préparateurs", conformity_target: "Objectif conformité", conclusion: "Appréciation",
};
const ACTION = {
  create: { label: "Création", tone: "ok" as const },
  update: { label: "Modification", tone: "info" as const },
  trash: { label: "Corbeille", tone: "warn" as const },
  restore: { label: "Restauration", tone: "violet" as const },
  delete: { label: "Suppression", tone: "bad" as const },
};

const show = (v: unknown) => (v == null || v === "" ? "∅" : typeof v === "boolean" ? (v ? "oui" : "non") : String(v).slice(0, 80));

/** Traduit les codes internes (statuts, types) en libellés lisibles */
function pretty(table: string, field: string, v: unknown) {
  const k = String(v ?? "");
  if (field === "status" && table === "repairs") return REPAIR_STATUS[k as keyof typeof REPAIR_STATUS]?.label ?? show(v);
  if (field === "status" && table === "leave_requests") return LEAVE_STATUS[k as keyof typeof LEAVE_STATUS]?.label ?? show(v);
  if (field === "type" && (table === "leave_requests" || table === "day_marks")) return LEAVE_LABEL[k as keyof typeof LEAVE_LABEL] ?? (k === "PRES" ? "Présent" : show(v));
  if (field === "kind" && (table === "assets" || table === "repairs")) return ASSET_KINDS[k as keyof typeof ASSET_KINDS]?.label ?? show(v);
  if (field === "team") return k === "prep" ? "Préparateurs" : k === "chauf" ? "Chauffeurs" : show(v);
  if (field === "deleted_at") return v ? "oui" : "non";
  return show(v);
}

export function changes(e: AuditEntry) {
  if (e.action !== "update" || !e.old_data || !e.new_data) return [];
  return Object.keys(e.new_data)
    .filter((k) => !META.has(k) && JSON.stringify(e.old_data![k]) !== JSON.stringify(e.new_data![k]))
    .map((k) => ({ field: FIELD[k] || k, from: pretty(e.table_name, k, e.old_data![k]), to: pretty(e.table_name, k, e.new_data![k]) }));
}

export function AuditItem({ e, showTable }: { e: AuditEntry; showTable?: boolean }) {
  const a = ACTION[e.action];
  const ch = changes(e);
  return (
    <li className="relative min-w-0 pl-6">
      <span className="absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand ring-2 ring-brand/20" />
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <Badge tone={a.tone}>{a.label}</Badge>
        {showTable && <span className="font-semibold">{TABLE_LABELS[e.table_name] || e.table_name}</span>}
        {showTable && e.label && <span className="block w-full min-w-0 truncate text-ink/80">« {e.label} »</span>}
      </div>
      <p className="mt-1 text-xs text-muted">
        {fmtDateTime(e.at)} · {e.actor_email || "système / import"}
      </p>
      {ch.length > 0 && (
        <ul className="mt-1.5 grid min-w-0 gap-0.5 text-[13px] break-words">
          {ch.slice(0, 6).map((c) => (
            <li key={c.field}>
              <span className="text-muted">{c.field} :</span> <span className="line-through decoration-bad/50">{c.from}</span> → <b>{c.to}</b>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function HistoryCard({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardHeader title="Historique" subtitle="Qui a modifié quoi, et quand" />
      {entries.length ? (
        <ul className="grid gap-4 border-l border-line px-5 pb-5 [margin-left:calc(1.25rem+4px)]">
          {entries.map((e) => (
            <AuditItem key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <Empty icon={<History className="h-5 w-5" />} title="Aucune modification enregistrée" />
      )}
    </Card>
  );
}
