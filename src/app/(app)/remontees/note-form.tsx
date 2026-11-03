"use client";
import { EntityForm } from "@/components/ui/entity-form";
import { usePerms } from "@/components/app/perms-context";
import { NOTE_KINDS, NOTE_LEVELS, NOTE_SOURCES, NOTE_STATUS } from "@/lib/domain/constants";
import { iso, nextWorkDay, today } from "@/lib/domain/dates";
import type { DeliveryNote } from "@/lib/types";

export type ClientLite = { id: string; name: string; route: string | null };

export function NoteForm({
  open, onClose, row, clients, defaultClient,
}: {
  open: boolean; onClose: () => void; row: DeliveryNote | null; clients: ClientLite[]; defaultClient?: ClientLite | null;
}) {
  const perms = usePerms();
  const editor = perms.write("remontees");
  return (
    <EntityForm
      open={open}
      onClose={onClose}
      title={row ? "Modifier la remontée" : "Nouvelle remontée livraison"}
      table="delivery_notes"
      id={row?.id}
      initial={
        row
          ? { ...row }
          : {
              level: "attention", kind: "livraison", source: "commercial", status: "todo", permanent: false,
              due_date: iso(nextWorkDay(today())), client_name: defaultClient?.name || "", route: defaultClient?.route || "",
            }
      }
      transform={(v) => {
        const c = clients.find((x) => x.name.toUpperCase() === String(v.client_name || "").trim().toUpperCase());
        return {
          ...v,
          client_id: c?.id || null,
          due_date: v.permanent ? null : v.due_date,
          route: v.route || c?.route || null,
          ...(editor ? {} : { status: row?.status || "todo" }),
        };
      }}
      validate={(v) => (!v.permanent && !v.due_date && !String(v.body || "").trim() ? "Indiquez une date ou cochez « Consigne permanente »." : null)}
      fields={[
        { name: "level", label: "Niveau", type: "select", required: true, options: Object.entries(NOTE_LEVELS).map(([k, x]) => [k, x.label]) },
        { name: "kind", label: "Concerne", type: "select", required: true, options: Object.entries(NOTE_KINDS) },
        { name: "client_name", label: "Client", placeholder: "Commencez à taper…", suggestions: clients.map((c) => c.name), full: true },
        { name: "permanent", label: "Consigne permanente (à chaque livraison)", type: "checkbox", full: true },
        { name: "due_date", label: "Date de livraison / récupération", type: "date", when: (v) => !v.permanent },
        { name: "until_date", label: "Valable jusqu'au (facultatif)", type: "date", when: (v) => !!v.permanent },
        { name: "route", label: "Tournée", placeholder: "TM10" },
        { name: "source", label: "Remontée par", type: "select", required: true, options: Object.entries(NOTE_SOURCES) },
        { name: "source_name", label: "Nom (facultatif)", placeholder: "Ex. : Lucas, le gérant…" },
        { name: "body", label: "Consigne / information", type: "textarea", required: true, placeholder: "Ex. : livrer avant 10 h, accès par la cour arrière, reprendre 6 fûts vides…" },
        ...(editor ? [{ name: "status", label: "Statut", type: "select" as const, required: true, options: Object.entries(NOTE_STATUS).map(([k, x]) => [k, x.label] as [string, string]) }] : []),
      ]}
    />
  );
}
