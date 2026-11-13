"use client";
import { useRouter } from "next/navigation";
import { CircleCheckBig, History, MessageSquarePlus, RotateCcw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { addTaskUpdate, setTaskDone } from "@/lib/actions/crud";
import { fmtDateTime, fmtShort } from "@/lib/domain/dates";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [0, 10, 25, 50, 75, 90];

/** Barre d'avancement d'une tâche */
export function ProgressBar({ value, done, className }: { value: number; done?: boolean; className?: string }) {
  const v = done ? 100 : Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
      <div className={cn("h-full rounded-full transition-[width] duration-500", done ? "bg-ok" : v >= 75 ? "bg-ok/80" : v >= 25 ? "bg-info" : "bg-warn")} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Suivi d'une tâche : points d'étape, avancement, puis clôture avec un mot de clôture obligatoire */
export function TaskFollowUp({ task, open, mode, onClose, canEdit }: { task: Task | null; open: boolean; mode: "follow" | "close"; onClose: () => void; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pct, setPct] = useState(0);
  const [closing, setClosing] = useState(mode === "close");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open || !task) return;
    setText("");
    setNote("");
    setClosing(mode === "close");
    setPct(Math.min(90, task.progress || 0));
  }, [open, task, mode]);
  if (!task) return null;
  const updates = (task.updates || []).slice().reverse();
  const progress = task.done ? 100 : task.progress || 0;

  const addStep = () =>
    start(async () => {
      const r = await addTaskUpdate(task.id, text, pct);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Point d'étape ajouté", { description: `${task.title} · ${pct} %` });
      setText("");
      router.refresh();
    });
  const close = () =>
    start(async () => {
      const r = await setTaskDone([task.id], true, note);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tâche clôturée", { description: task.title });
      router.refresh();
      onClose();
    });
  const reopen = () =>
    start(async () => {
      const r = await setTaskDone([task.id], false);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tâche rouverte", { description: task.title });
      router.refresh();
      onClose();
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          {task.section}
          {task.assignee && <Badge tone="info">{task.assignee}</Badge>}
          {task.due_date && <Badge tone="muted">Échéance {fmtShort(task.due_date)}</Badge>}
          {task.done && <Badge tone="ok">Clôturée</Badge>}
        </span>
      }
      footer={
        !canEdit ? (
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        ) : task.done ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="outline" onClick={reopen} loading={pending}>
              <RotateCcw className="h-4 w-4" /> Rouvrir
            </Button>
          </>
        ) : closing ? (
          <>
            <Button variant="outline" onClick={() => setClosing(false)}>
              Retour au suivi
            </Button>
            <Button onClick={close} loading={pending} disabled={!note.trim()}>
              <CircleCheckBig className="h-4 w-4" /> Clôturer la tâche
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setClosing(true)}>
              <CircleCheckBig className="h-4 w-4" /> Clôturer…
            </Button>
            <Button onClick={addStep} loading={pending} disabled={!text.trim()}>
              <MessageSquarePlus className="h-4 w-4" /> Ajouter le point d&apos;étape
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold">Avancement</span>
            <span className="font-bold tabular-nums">{progress} %</span>
          </div>
          <ProgressBar value={progress} done={task.done} className="h-2.5" />
        </div>
        {task.notes && <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm whitespace-pre-wrap text-muted">{task.notes}</p>}

        {canEdit && !task.done && !closing && (
          <div className="grid gap-3 rounded-2xl border border-line p-3.5">
            <p className="text-[13px] font-semibold">Nouveau point d&apos;étape</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="Ce qui a été fait, ce qui bloque, la prochaine étape…" className="field min-h-[84px] py-2" aria-label="Point d'étape" />
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold">Avancement après ce point</span>
                <span className="font-bold tabular-nums">{pct} %</span>
              </div>
              <input type="range" min={0} max={90} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-label="Avancement en pourcentage" />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STEPS.map((s) => (
                  <button key={s} type="button" onClick={() => setPct(s)} aria-pressed={pct === s} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", pct === s ? "border-brand bg-brand text-brand-ink" : "border-line")}>
                    {s} %
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Les 100 % sont atteints à la clôture.</p>
            </div>
          </div>
        )}

        {canEdit && !task.done && closing && (
          <div className="grid gap-2 rounded-2xl border border-ok/40 bg-ok/5 p-3.5">
            <p className="text-[13px] font-semibold">Mot de clôture</p>
            <p className="text-xs text-muted">Obligatoire : comment la tâche a été menée à bien, le résultat, ce qu&apos;il faut retenir.</p>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Ex. : Inventaire fait, 2 téléphones manquants signalés à la direction." className="field min-h-[84px] py-2" aria-label="Mot de clôture" />
            {!updates.length && <p className="text-xs text-warn">Aucun point d&apos;étape n&apos;a été noté : pensez à résumer le suivi dans ce mot.</p>}
          </div>
        )}

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <History className="h-3.5 w-3.5 text-muted" /> Suivi {updates.length ? `(${updates.length})` : ""}
          </p>
          {task.done && task.closure_note && (
            <div className="mb-2 rounded-xl border border-ok/40 bg-ok/5 px-3 py-2">
              <p className="text-xs font-semibold text-ok">Clôture{task.done_at ? ` · ${fmtDateTime(task.done_at)}` : ""}</p>
              <p className="text-sm whitespace-pre-wrap">{task.closure_note}</p>
            </div>
          )}
          {updates.length ? (
            <ol className="relative grid gap-3 border-l-2 border-line pl-4">
              {updates.map((u, i) => (
                <li key={u.at + i} className="relative">
                  <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-info" />
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-semibold text-ink">{u.name || "Quelqu'un"}</span>
                    <span>{fmtDateTime(u.at)}</span>
                    <Badge tone="muted">{u.progress} %</Badge>
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{u.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Pas encore de point d&apos;étape.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
