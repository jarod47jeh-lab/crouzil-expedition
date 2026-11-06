"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, CircleCheckBig, FolderPlus, ListTodo, Pencil, Plus, Siren, Trash2, User } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePerms } from "@/components/app/perms-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { renameSection, saveRow, setTaskDone, trashRows } from "@/lib/actions/crud";
import { daysBetween, fmtShort } from "@/lib/domain/dates";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Échéance : en retard, aujourd'hui, à venir */
function DueBadge({ date, done }: { date: string | null; done: boolean }) {
  if (!date) return null;
  const late = daysBetween(date); // > 0 : passée
  const tone = done ? "muted" : late > 0 ? "bad" : late === 0 ? "warn" : "muted";
  const text = done ? fmtShort(date) : late > 0 ? `En retard · ${fmtShort(date)}` : late === 0 ? "Aujourd'hui" : late === -1 ? "Demain" : fmtShort(date);
  return (
    <Badge tone={tone}>
      <CalendarClock className="h-3 w-3" /> {text}
    </Badge>
  );
}

function TaskRow({ t, canEdit, onToggle, onEdit, onDelete }: { t: Task; canEdit: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      className="group flex items-start gap-3 px-5 py-2.5"
    >
      <button
        onClick={onToggle}
        disabled={!canEdit}
        aria-label={t.done ? `Rouvrir : ${t.title}` : `Marquer comme fait : ${t.title}`}
        className={cn(
          "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors disabled:cursor-default",
          t.done ? "border-ok bg-ok text-white" : "border-line hover:border-ok hover:bg-ok/10",
        )}
      >
        <AnimatePresence>
          {t.done && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] leading-snug", t.done && "text-muted line-through decoration-muted/60")}>{t.title}</p>
        {(t.due_date || t.assignee || t.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <DueBadge date={t.due_date} done={t.done} />
            {t.assignee && (
              <Badge tone="info">
                <User className="h-3 w-3" /> {t.assignee}
              </Badge>
            )}
            {t.notes && <span className="line-clamp-2 basis-full text-xs whitespace-pre-wrap text-muted">{t.notes}</span>}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2 hover:text-brand" aria-label={`Modifier : ${t.title}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-bad/10 hover:text-bad" aria-label={`Supprimer : ${t.title}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.li>
  );
}

function SectionCard({
  name, tasks, index, canEdit, onToggle, onEdit, onDelete, onAdd, onRename, hideDone,
}: {
  name: string; tasks: Task[]; index: number; canEdit: boolean; hideDone: boolean;
  onToggle: (t: Task) => void; onEdit: (t: Task) => void; onDelete: (t: Task) => void;
  onAdd: (section: string, title: string) => Promise<boolean>; onRename: (from: string, to: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const late = open.filter((t) => t.due_date && daysBetween(t.due_date) >= 0).length;
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const add = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    const ok = await onAdd(name, title);
    setBusy(false);
    if (ok) setDraft("");
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.05, type: "spring", stiffness: 260, damping: 30 }}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          {renaming != null ? (
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (renaming.trim() && renaming.trim() !== name) onRename(name, renaming);
                setRenaming(null);
              }}
            >
              <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} onBlur={() => setRenaming(null)} className="field h-9 min-h-0 flex-1" aria-label="Nom de la rubrique" />
            </form>
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold">
              {name}
              {canEdit && tasks.length > 0 && (
                <button onClick={() => setRenaming(name)} className="ml-1.5 inline-grid h-6 w-6 place-items-center rounded-md align-middle text-muted hover:bg-surface-2 hover:text-brand" aria-label={`Renommer la rubrique ${name}`}>
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </h2>
          )}
          {late > 0 && <Badge tone="bad">{late} à faire en urgence</Badge>}
          <Badge tone={open.length ? "muted" : "ok"}>{open.length ? `${open.length} à faire` : "Tout est fait"}</Badge>
        </div>
        <div className="mx-5 mb-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-ok" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <ul className="divide-y divide-line/70">
          <AnimatePresence initial={false}>
            {open.map((t) => (
              <TaskRow key={t.id} t={t} canEdit={canEdit} onToggle={() => onToggle(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
            ))}
          </AnimatePresence>
        </ul>
        {canEdit && (
          <form
            className="flex items-center gap-2 border-t border-line/70 px-5 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Plus className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ajouter une tâche… (Entrée)"
              aria-label={`Ajouter une tâche dans ${name}`}
              className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-muted"
            />
            {draft.trim() && (
              <Button type="submit" size="sm" loading={busy}>
                Ajouter
              </Button>
            )}
          </form>
        )}
        {done.length > 0 && !hideDone && (
          <div className="border-t border-line/70 bg-surface-2/40">
            <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm font-semibold text-muted hover:text-ink" aria-expanded={showDone}>
              <CircleCheckBig className="h-4 w-4 text-ok" /> Fait ({done.length})
              <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", showDone && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <AnimatePresence initial={false}>
                    {done.map((t) => (
                      <TaskRow key={t.id} t={t} canEdit={canEdit} onToggle={() => onToggle(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export function TasksView({ tasks: initial, people }: { tasks: Task[]; people: string[] }) {
  const router = useRouter();
  const perms = usePerms();
  const canEdit = perms.write("taches");
  const ed = useEditor<Task>();
  const [, start] = useTransition();
  // état local pour cocher sans attendre le serveur
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const [newSection, setNewSection] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);

  const tasks = useMemo(
    () => initial.filter((t) => !hidden.has(t.id)).map((t) => (t.id in overrides ? { ...t, done: overrides[t.id] } : t)),
    [initial, overrides, hidden],
  );
  const sections = useMemo(() => {
    const order: string[] = [];
    for (const t of tasks) if (!order.includes(t.section)) order.push(t.section);
    for (const s of extraSections) if (!order.includes(s)) order.push(s);
    return order.map((s) => ({ name: s, tasks: tasks.filter((t) => t.section === s) }));
  }, [tasks, extraSections]);

  const open = tasks.filter((t) => !t.done);
  const urgent = open.filter((t) => t.due_date && daysBetween(t.due_date) >= 0).length;
  const doneWeek = tasks.filter((t) => t.done && t.done_at && daysBetween(t.done_at.slice(0, 10)) <= 7).length;

  const toggle = (t: Task) => {
    const next = !t.done;
    setOverrides((o) => ({ ...o, [t.id]: next }));
    start(async () => {
      const r = await setTaskDone([t.id], next);
      if (!r.ok) {
        setOverrides((o) => ({ ...o, [t.id]: t.done }));
        return void toast.error(r.error);
      }
      if (next) toast.success("Tâche faite", { description: t.title, action: { label: "Annuler", onClick: () => toggle({ ...t, done: true }) } });
      router.refresh();
    });
  };
  const remove = (t: Task) => {
    setHidden((h) => new Set(h).add(t.id));
    start(async () => {
      const r = await trashRows("tasks", [t.id]);
      if (!r.ok) {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(t.id);
          return n;
        });
        return void toast.error(r.error);
      }
      toast.success("Tâche supprimée", { description: "Récupérable 30 jours dans la corbeille." });
      router.refresh();
    });
  };
  const add = async (section: string, title: string) => {
    const pos = Math.max(0, ...initial.filter((t) => t.section === section).map((t) => t.position)) + 1;
    const r = await saveRow("tasks", null, { title, section, position: pos });
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    setExtraSections((s) => s.filter((x) => x !== section));
    router.refresh();
    return true;
  };
  const rename = (from: string, to: string) =>
    start(async () => {
      const r = await renameSection(from, to);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Rubrique renommée en « ${to.trim()} »`);
      router.refresh();
    });

  return (
    <>
      <PageHeader
        title="To do list"
        icon={<ListTodo className="h-6 w-6" />}
        subtitle="Les actions à mener, par rubrique. Cochez quand c'est fait."
        actions={
          canEdit && (
            <>
              <Button variant="outline" onClick={() => setNewSection("")}>
                <FolderPlus className="h-4 w-4" /> Nouvelle rubrique
              </Button>
              <Button onClick={ed.create}>
                <Plus className="h-4 w-4" /> Nouvelle tâche
              </Button>
            </>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="À faire" value={open.length} icon={<ListTodo className="h-5 w-5" />} sub={`dans ${sections.filter((s) => s.tasks.some((t) => !t.done)).length} rubrique(s)`} />
        <Kpi index={1} label="En retard ou pour aujourd'hui" value={urgent} tone={urgent ? "bad" : "ok"} icon={<Siren className="h-5 w-5" />} sub="selon l'échéance" />
        <Kpi index={2} label="Faites cette semaine" value={doneWeek} tone="ok" icon={<CircleCheckBig className="h-5 w-5" />} sub="7 derniers jours" />
        <Kpi index={3} label="Avancement" value={tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 0} suffix=" %" tone="violet" sub={`${tasks.length - open.length} sur ${tasks.length} tâches`} />
      </div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setHideDone((v) => !v)}
          className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", hideDone ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink")}
        >
          Masquer les tâches faites
        </button>
      </div>

      <AnimatePresence>
        {newSection != null && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              const n = newSection.trim();
              if (!n) return;
              if (sections.some((s) => s.name.toLowerCase() === n.toLowerCase())) return void toast.error("Cette rubrique existe déjà.");
              setExtraSections((s) => [...s, n]);
              setNewSection(null);
            }}
          >
            <Card className="flex flex-wrap items-center gap-2 p-3">
              <FolderPlus className="h-4 w-4 text-muted" />
              <input autoFocus value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Nom de la rubrique, ex. : D'ici fin décembre" aria-label="Nom de la nouvelle rubrique" className="field h-9 min-h-0 min-w-0 flex-1" />
              <Button type="submit" size="sm">
                Créer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setNewSection(null)}>
                Annuler
              </Button>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {sections.length ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {sections.map((s, i) => (
            <SectionCard
              key={s.name}
              name={s.name}
              tasks={s.tasks}
              index={i}
              canEdit={canEdit}
              hideDone={hideDone}
              onToggle={toggle}
              onEdit={ed.edit}
              onDelete={remove}
              onAdd={add}
              onRename={rename}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<ListTodo className="h-5 w-5" />} title="Aucune tâche pour l'instant">
            Créez une rubrique (par exemple « Cette semaine ») puis ajoutez-y vos tâches.
          </Empty>
        </Card>
      )}

      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? "Modifier la tâche" : "Nouvelle tâche"}
        table="tasks"
        id={ed.row?.id}
        initial={ed.row ? { ...ed.row } : { section: sections[0]?.name || "Cette semaine", due_date: "", assignee: "" }}
        transform={(v) => {
          const section = String(v.section || "").trim() || "À faire";
          if (ed.row && ed.row.section === section) return { ...v, section };
          return { ...v, section, position: Math.max(0, ...initial.filter((t) => t.section === section).map((t) => t.position)) + 1 };
        }}
        fields={[
          { name: "title", label: "Tâche", type: "textarea", required: true, placeholder: "Ex. : Faire l'inventaire des téléphones" },
          { name: "section", label: "Rubrique", required: true, suggestions: sections.map((s) => s.name), placeholder: "Cette semaine" },
          { name: "due_date", label: "Échéance (facultatif)", type: "date" },
          { name: "assignee", label: "Pour qui (facultatif)", suggestions: people, placeholder: "Ex. : Christophe" },
          { name: "notes", label: "Précisions (facultatif)", type: "textarea" },
        ]}
      />
    </>
  );
}
