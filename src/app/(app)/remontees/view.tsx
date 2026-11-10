"use client";
import { DepotBanner } from "@/components/depot/banner";
import { minimalSummary } from "@/components/depot/summary-empty";
import { Archive, Megaphone, Plus, Repeat, Siren, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePerms } from "@/components/app/perms-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useEditor, useOpenOnNew } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { NOTE_KINDS, NOTE_LEVELS, NOTE_SOURCES, NOTE_STATUS } from "@/lib/domain/constants";
import { fmtDate } from "@/lib/domain/dates";
import { BUCKETS, bucketOf, isActive, order, type Bucket } from "@/lib/domain/notes";
import type { DeliveryNote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NoteCard } from "./note-card";
import { NoteForm, type ClientLite } from "./note-form";

export function NotesView({
  tab, notes, clients, authors, me, newForClient,
}: {
  tab: "avenir" | "toutes" | "archives"; notes: DeliveryNote[]; clients: ClientLite[]; authors: Record<string, string>; me: string; newForClient?: string;
}) {
  const perms = usePerms();
  const ed = useEditor<DeliveryNote>();
  useOpenOnNew(ed.create);
  const [formClient, setFormClient] = useState<ClientLite | null>(null);
  const [onlyAttn, setOnlyAttn] = useState(false);
  const preset = useMemo(() => clients.find((c) => c.id === newForClient) || null, [clients, newForClient]);
  useEffect(() => {
    if (preset && perms.contribute) {
      setFormClient(preset);
      ed.create();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const active = notes.filter((n) => isActive(n)).filter((n) => !onlyAttn || n.level === "attention");
  const groups = useMemo(() => {
    const g = new Map<Bucket, DeliveryNote[]>();
    for (const n of [...active].sort((a, b) => order(a) - order(b) || String(a.due_date).localeCompare(String(b.due_date)))) {
      const b = bucketOf(n);
      g.set(b, [...(g.get(b) || []), n]);
    }
    return [...g.entries()];
  }, [active]);

  const archived = useMemo(() => notes.filter((n) => n.status === "done").sort((a, b) => String(b.handled_at || b.updated_at || "").localeCompare(String(a.handled_at || a.updated_at || ""))), [notes]);
  const archiveGroups = useMemo(() => {
    const g = new Map<string, DeliveryNote[]>();
    archived.forEach((n) => {
      const d = n.handled_at || n.updated_at || n.created_at;
      const k = new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      g.set(k, [...(g.get(k) || []), n]);
    });
    return [...g.entries()];
  }, [archived]);
  const todo = notes.filter((n) => n.status === "todo").length;
  const soon = notes.filter((n) => isActive(n) && ["late", "today", "tomorrow"].includes(bucketOf(n))).length;
  const permanent = notes.filter((n) => isActive(n) && n.permanent).length;
  const late = notes.filter((n) => isActive(n) && bucketOf(n) === "late").length;

  return (
    <>
      <PageHeader
        title="Remontées livraison"
        icon={<Megaphone className="h-6 w-6" />}
        subtitle="Particularités des prochaines livraisons et récupérations, remontées par les commerciaux, clients, direction, livreurs et préparateurs"
        actions={
          perms.contribute && (
            <Button
              onClick={() => {
                setFormClient(null);
                ed.create();
              }}
            >
              <Plus className="h-4 w-4" /> Nouvelle remontée
            </Button>
          )
        }
      />
      <DepotBanner focus="quais" caption="Quais" summary={minimalSummary([], { quais: notes.filter((n) => n.status === "todo" && n.level === "attention").length })} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="À traiter" value={todo} tone={todo ? "bad" : "ok"} icon={<Siren className="h-5 w-5" />} sub="pas encore prises en compte" />
        <Kpi index={1} label="Aujourd'hui et demain" value={soon} tone={soon ? "warn" : "ok"} icon={<CalendarDays className="h-5 w-5" />} sub="y compris les échues non closes" />
        <Kpi index={2} label="Consignes permanentes" value={permanent} tone="violet" icon={<Repeat className="h-5 w-5" />} sub="à chaque livraison" />
        <Kpi index={3} label="Échues non closes" value={late} tone={late ? "bad" : "ok"} sub="date passée, à clore" />
      </div>
      <Tabs
        id="notes-tabs"
        active={tab}
        tabs={[
          { key: "avenir", label: "En cours", href: "/remontees", count: active.length },
          { key: "toutes", label: "Toutes les remontées", href: "/remontees?tab=toutes" },
          { key: "archives", label: "Archives", href: "/remontees?tab=archives", count: archived.length },
        ]}
      />
      {tab === "archives" ? (
        archived.length ? (
          <div className="grid gap-8">
            {archiveGroups.map(([month, list]) => (
              <section key={month}>
                <h2 className="mb-3 flex items-center gap-3 text-sm font-bold text-muted capitalize">
                  {month}
                  <Badge tone="muted">{list.length}</Badge>
                  <span className="h-px flex-1 bg-line" />
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((n, i) => (
                    <NoteCard key={n.id} n={n} i={i} author={n.created_by ? authors[n.created_by] : undefined} closer={n.handled_by ? authors[n.handled_by] : undefined} me={me} />
                  ))}
                </div>
              </section>
            ))}
            <p className="text-xs text-muted">Les remontées closes restent archivées. Seul un administrateur peut les supprimer.</p>
          </div>
        ) : (
          <Card>
            <Empty icon={<Archive className="h-5 w-5" />} title="Aucune remontée archivée">
              Quand vous closez une remontée, elle arrive ici avec la date, votre nom et le mot de clôture.
            </Empty>
          </Card>
        )
      ) : tab === "avenir" ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setOnlyAttn((v) => !v)}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", onlyAttn ? "border-warn bg-warn/12 text-warn" : "border-line text-muted hover:text-ink")}
            >
              Seulement « Attention »
            </button>
          </div>
          {groups.length ? (
            <div className="grid gap-8">
              {groups.map(([b, list]) => (
                <section key={b}>
                  <h2 className={cn("mb-3 flex items-center gap-3 text-sm font-bold", b === "late" ? "text-bad" : "text-muted")}>
                    {BUCKETS[b]}
                    <Badge tone={b === "late" ? "bad" : "muted"}>{list.length}</Badge>
                    <span className="h-px flex-1 bg-line" />
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((n, i) => (
                      <NoteCard key={n.id} n={n} i={i} author={n.created_by ? authors[n.created_by] : undefined} me={me} onEdit={ed.edit} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Card>
              <Empty icon={<Megaphone className="h-5 w-5" />} title="Aucune remontée en cours">
                Notez ici les demandes des clients, commerciaux ou livreurs pour les prochaines livraisons ou récupérations.
              </Empty>
            </Card>
          )}
        </>
      ) : (
        <DataTable
          rows={notes}
          table="delivery_notes"
          exportName="remontees-livraison"
          onEdit={ed.edit}
          searchText={(n) => `${n.client_name} ${n.body} ${n.source_name} ${n.route}`}
          initialSort={{ key: "date", dir: "desc" }}
          filters={[
            { key: "st", label: "Statut", options: Object.entries(NOTE_STATUS).map(([k, v]) => [k, v.label]), value: (n) => n.status },
            { key: "lv", label: "Niveau", options: Object.entries(NOTE_LEVELS).map(([k, v]) => [k, v.label]), value: (n) => n.level },
            { key: "kd", label: "Concerne", options: Object.entries(NOTE_KINDS), value: (n) => n.kind },
            { key: "src", label: "Provenance", options: Object.entries(NOTE_SOURCES), value: (n) => n.source },
          ]}
          columns={[
            { key: "date", header: "Date", sort: (n) => (n.permanent ? "9999" : n.due_date || ""), exportValue: (n) => (n.permanent ? "Permanente" : fmtDate(n.due_date)), cell: (n) => (n.permanent ? <Badge tone="violet">Permanente</Badge> : <span className="tabular">{fmtDate(n.due_date) || "–"}</span>) },
            { key: "lv", header: "Niveau", sort: (n) => n.level, exportValue: (n) => NOTE_LEVELS[n.level].label, cell: (n) => <Badge tone={NOTE_LEVELS[n.level].tone}>{NOTE_LEVELS[n.level].label}</Badge> },
            { key: "client", header: "Client", sort: (n) => n.client_name, cell: (n) => <b>{n.client_name || "–"}</b> },
            { key: "kind", header: "Concerne", hideOnMobile: true, sort: (n) => n.kind, exportValue: (n) => NOTE_KINDS[n.kind], cell: (n) => NOTE_KINDS[n.kind] },
            { key: "body", header: "Consigne", exportValue: (n) => n.body, cell: (n) => <span className="line-clamp-2 max-w-[360px] text-sm">{n.body}</span> },
            { key: "src", header: "Provenance", hideOnMobile: true, sort: (n) => n.source, exportValue: (n) => [NOTE_SOURCES[n.source], n.source_name].filter(Boolean).join(" · "), cell: (n) => <span className="text-muted">{[NOTE_SOURCES[n.source], n.source_name].filter(Boolean).join(" · ")}</span> },
            { key: "st", header: "Statut", sort: (n) => "todo,ack,done".indexOf(n.status), exportValue: (n) => NOTE_STATUS[n.status].label, cell: (n) => <Badge tone={NOTE_STATUS[n.status].tone} dot>{NOTE_STATUS[n.status].label}</Badge> },
          ]}
        />
      )}
      <NoteForm open={ed.open} onClose={ed.close} row={ed.row} clients={clients} defaultClient={formClient} />
    </>
  );
}
