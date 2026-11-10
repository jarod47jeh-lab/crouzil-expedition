"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import { AnimatePresence, motion } from "motion/react";
import { NotebookPen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";
import { EntityForm, useEditor, useOpenOnNew } from "@/components/ui/entity-form";
import { PageHeader } from "@/components/ui/page-header";
import { restoreRow, trashRows } from "@/lib/actions/crud";
import { JOURNAL_CATS } from "@/lib/domain/constants";
import { fmtLong, iso, parse, today } from "@/lib/domain/dates";
import type { JournalEntry } from "@/lib/types";
import { cn, norm } from "@/lib/utils";

export function JournalView({ entries, me }: { entries: JournalEntry[]; me: string }) {
  const ed = useEditor<JournalEntry>();
  useOpenOnNew(ed.create);
  const canEdit = usePerms().write("journal");
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const list = useMemo(() => entries.filter((e) => (!cat || e.category === cat) && (!q || norm(`${e.body} ${e.author}`).includes(norm(q)))), [entries, q, cat]);
  const byDay = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    list.forEach((e) => m.set(e.entry_date, [...(m.get(e.entry_date) || []), e]));
    return [...m.entries()];
  }, [list]);
  const remove = (e: JournalEntry) =>
    start(async () => {
      const r = await trashRows("journal_entries", [e.id]);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Entrée supprimée", { action: { label: "Annuler", onClick: async () => { await restoreRow("journal_entries", e.id); router.refresh(); } } });
      router.refresh();
    });

  return (
    <>
      <PageHeader
        title="Journal de bord"
        icon={<NotebookPen className="h-6 w-6" />}
        subtitle="Événements, remarques, incidents et notes du quotidien"
        actions={
          <CanWrite module="journal">
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Nouvelle entrée
          </Button>
          </CanWrite>
        }
      />
      <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans le journal…" className="field h-9 min-h-0 pl-9 text-sm" />
        </div>
        {[["", "Tout"], ...Object.entries(JOURNAL_CATS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setCat(k)} className={cn("relative rounded-full px-3 py-1.5 text-sm font-semibold", cat === k ? "text-brand-ink" : "text-muted hover:text-ink")}>
            {cat === k && <motion.span layoutId="jcat" className="absolute inset-0 rounded-full bg-brand" />}
            <span className="relative">{l}</span>
          </button>
        ))}
      </Card>
      {byDay.length ? (
        <div className="grid gap-8">
          {byDay.map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-3 flex items-center gap-3 text-sm font-bold text-muted">
                {fmtLong(parse(day))}
                <span className="h-px flex-1 bg-line" />
              </h2>
              <ul className="grid gap-3">
                <AnimatePresence initial={false}>
                  {items.map((e, i) => {
                    const c = JOURNAL_CATS[e.category];
                    return (
                      <motion.li
                        key={e.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                        exit={{ opacity: 0, x: -30 }}
                        className="group rounded-2xl border border-line bg-surface p-4 shadow-card"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={c.tone} dot>{c.label}</Badge>
                          {e.author && <span className="text-xs text-muted">par {e.author}</span>}
                          {canEdit && <div className="ml-auto flex gap-1 opacity-50 transition-opacity group-hover:opacity-100">
                            <button onClick={() => ed.edit(e)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-brand" aria-label="Modifier">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => remove(e)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-bad" aria-label="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap">{e.body}</p>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<NotebookPen className="h-5 w-5" />} title={entries.length ? "Aucune entrée ne correspond" : "Le journal est vide"} />
        </Card>
      )}
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? "Modifier l'entrée" : "Nouvelle entrée"}
        table="journal_entries"
        id={ed.row?.id}
        initial={ed.row ? { ...ed.row } : { entry_date: iso(today()), category: "note", author: me, body: "" }}
        fields={[
          { name: "entry_date", label: "Date", type: "date", required: true },
          { name: "category", label: "Catégorie", type: "select", required: true, options: Object.entries(JOURNAL_CATS).map(([k, v]) => [k, v.label]) },
          { name: "author", label: "Auteur" },
          { name: "body", label: "Texte", type: "textarea", required: true },
        ]}
      />
    </>
  );
}
