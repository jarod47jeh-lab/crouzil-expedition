"use client";
import { useRouter } from "next/navigation";
import { Eraser, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { setDayMarks, trashRows } from "@/lib/actions/crud";
import { LEAVE_COLOR, LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES } from "@/lib/domain/constants";
import { addDays, fmtDate, fmtLong, isWorkDay, iso, parse } from "@/lib/domain/dates";
import type { DayMark, Employee, LeaveRequest, LeaveType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Case du planning : voir d'où vient la saisie, la changer (un jour ou une plage), la supprimer,
    ou modifier / supprimer la demande d'origine. */
export function CellEditor({
  emp,
  day,
  onClose,
  leaves,
  marks,
  canEdit,
  onEditRequest,
}: {
  emp: Employee | null;
  day: string | null;
  onClose: () => void;
  leaves: LeaveRequest[];
  marks: DayMark[];
  canEdit: boolean;
  onEditRequest: (r: LeaveRequest) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [until, setUntil] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    setUntil(day || "");
    setConfirmDel(false);
  }, [day, emp]);
  if (!emp || !day) return null;

  const mark = marks.find((m) => m.employee_id === emp.id && m.date === day) || null;
  const reqs = leaves.filter((r) => !r.deleted_at && r.employee_id === emp.id && r.start_date <= day && day <= r.end_date && r.status !== "rejected");
  const req = reqs.find((r) => r.status === "approved") || reqs[0] || null;
  const current: { label: string; type: LeaveType | "PRES" | null; origin: string } = mark
    ? { label: mark.type === "PRES" ? "Présent" : LEAVE_LABEL[mark.type], type: mark.type, origin: "Saisie au planning" }
    : req
      ? { label: LEAVE_LABEL[req.type], type: req.type, origin: req.status === "approved" ? "Demande validée" : "Demande en attente" }
      : { label: "Présent", type: null, origin: "Aucune saisie" };

  // jours ouvrés de la plage choisie
  const range = () => {
    const end = until && until >= day ? until : day;
    const out: string[] = [];
    for (let x = parse(day); iso(x) <= end; x = addDays(x, 1)) if (isWorkDay(x)) out.push(iso(x));
    return out;
  };
  const apply = (type: string, what: string) =>
    start(async () => {
      const dates = range();
      if (!dates.length) return void toast.error("Aucun jour ouvré dans cette période.");
      const r = await setDayMarks(emp.id, dates, type);
      if (!r.ok) return void toast.error(r.error);
      toast.success(what, { description: `${emp.name} · ${dates.length > 1 ? `${dates.length} jours, du ${fmtDate(dates[0])} au ${fmtDate(dates[dates.length - 1])}` : fmtDate(dates[0])}` });
      router.refresh();
      onClose();
    });
  const deleteRequest = () =>
    start(async () => {
      if (!req) return;
      const r = await trashRows("leave_requests", [req.id]);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Demande supprimée", { description: "Récupérable 30 jours dans la corbeille." });
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onClose={onClose} title={emp.name} subtitle={fmtLong(parse(day))}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
          <span className="text-sm text-muted">Actuellement :</span>
          <span
            className="rounded-md px-2 py-0.5 text-sm font-bold"
            style={current.type && current.type !== "PRES" ? { background: LEAVE_COLOR[current.type], color: "white" } : { background: "var(--surface)", color: "var(--ink)" }}
          >
            {current.label}
          </span>
          <Badge tone="muted">{current.origin}</Badge>
        </div>

        {req && (
          <div className="grid gap-2 rounded-xl border border-line p-3">
            <p className="text-sm">
              <b>Demande</b> : {LEAVE_LABEL[req.type]} du {fmtDate(req.start_date)} au {fmtDate(req.end_date)} · {LEAVE_STATUS[req.status]?.label}
              {req.comment && <span className="block text-xs text-muted">{req.comment}</span>}
            </p>
            {mark && <p className="text-xs text-muted">La saisie au planning remplace cette demande pour ce jour-là.</p>}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => (onClose(), onEditRequest(req))}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier la demande
                </Button>
                {confirmDel ? (
                  <Button size="sm" variant="danger" onClick={deleteRequest} loading={pending}>
                    <Trash2 className="h-3.5 w-3.5" /> Confirmer la suppression
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmDel(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer la demande
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {canEdit ? (
          <>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Changer la saisie</p>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                Du <b>{fmtDate(day)}</b> au
                <input type="date" value={until} min={day} onChange={(e) => setUntil(e.target.value)} className="field h-9 min-h-0 w-auto" aria-label="Dernier jour de la saisie" />
                <span className="text-xs text-muted">(jours ouvrés seulement)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply("PRES", "Présent enregistré")}
                  className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-bold", current.type === "PRES" ? "border-ink" : "border-line")}
                >
                  Présent
                </button>
                {LEAVE_TYPES.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    disabled={pending}
                    onClick={() => apply(t.k, `${t.label} enregistré`)}
                    title={t.label}
                    className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-bold", current.type === t.k ? "border-ink" : "border-transparent")}
                    style={{ background: `color-mix(in srgb, ${t.color} 22%, transparent)`, color: t.color }}
                  >
                    {t.k} <span className="font-semibold opacity-80">· {t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {mark && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button variant="outline" size="sm" onClick={() => apply("CLEAR", "Saisie supprimée")} loading={pending}>
                  <Eraser className="h-3.5 w-3.5" /> Supprimer la saisie{until && until > day ? " sur la plage" : ""}
                </Button>
                <span className="text-xs text-muted">{req ? "La demande d'origine s'appliquera de nouveau." : "Le jour redevient « présent »."}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Votre rôle permet seulement de consulter le planning.</p>
        )}
      </div>
    </Dialog>
  );
}
