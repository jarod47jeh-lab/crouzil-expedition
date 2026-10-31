"use client";
import { AlertTriangle } from "lucide-react";
import { EntityForm } from "@/components/ui/entity-form";
import { LEAVE_TYPES } from "@/lib/domain/constants";
import { overlaps, requestDays } from "@/lib/domain/conges";
import { iso, today } from "@/lib/domain/dates";
import type { Employee, LeaveRequest } from "@/lib/types";

export function LeaveForm({
  open, onClose, row, employees, requests, defaultEmployee, defaultDate,
}: {
  open: boolean; onClose: () => void; row: LeaveRequest | null; employees: Employee[]; requests: LeaveRequest[]; defaultEmployee?: string; defaultDate?: string;
}) {
  const d = defaultDate || iso(today());
  return (
    <EntityForm
      open={open}
      onClose={onClose}
      title={row ? "Modifier la demande" : "Nouvelle demande de congé"}
      table="leave_requests"
      id={row?.id}
      initial={row ? { ...row } : { employee_id: defaultEmployee || "", type: "CP", start_date: d, end_date: d, status: "pending", comment: "" }}
      validate={(v) => (String(v.end_date) < String(v.start_date) ? "La date de fin est avant la date de début." : null)}
      fields={[
        { name: "employee_id", label: "Collaborateur", type: "select", required: true, full: true, options: employees.filter((e) => !e.freelance && (e.active || e.id === row?.employee_id)).map((e) => [e.id, e.name]) },
        { name: "type", label: "Motif", type: "select", required: true, options: LEAVE_TYPES.map((t) => [t.k, t.label]) },
        { name: "status", label: "Statut", type: "select", required: true, options: [["pending", "En attente"], ["approved", "Validé"], ["rejected", "Refusé"]] },
        { name: "start_date", label: "Du", type: "date", required: true },
        { name: "end_date", label: "Au (inclus)", type: "date", required: true },
        { name: "comment", label: "Commentaire", type: "textarea" },
      ]}
      extra={(v) => {
        if (!v.employee_id || !v.start_date || !v.end_date || String(v.end_date) < String(v.start_date)) return null;
        const n = requestDays({ start_date: String(v.start_date), end_date: String(v.end_date) });
        const ov = overlaps({ employee_id: String(v.employee_id), start_date: String(v.start_date), end_date: String(v.end_date) }, requests, row?.id);
        return (
          <div className="grid gap-2 text-sm">
            <p className="rounded-xl bg-surface-2 px-3 py-2">
              <b>{n}</b> jour{n > 1 ? "s" : ""} ouvré{n > 1 ? "s" : ""} (week-ends et jours fériés exclus).
              {v.type === "REC" && " La récupération ne décompte pas les congés payés."}
            </p>
            {ov.length > 0 && (
              <p className="flex items-center gap-2 rounded-xl bg-warn/12 px-3 py-2 text-warn">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Chevauche {ov.length} autre{ov.length > 1 ? "s" : ""} demande{ov.length > 1 ? "s" : ""} de ce collaborateur.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
