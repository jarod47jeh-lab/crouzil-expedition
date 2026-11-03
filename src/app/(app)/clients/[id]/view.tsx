"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { useMemo } from "react";
import { Bars } from "@/components/charts/charts";
import { HistoryCardClient } from "@/components/app/history-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { JUSTIF_CONCLUSIONS, MONTHS_SHORT } from "@/lib/domain/constants-ext";
import { daysBetween, fmtDate } from "@/lib/domain/dates";
import type { AuditEntry, Client, DeliveryError, DeliveryNote, Justification } from "@/lib/types";
import { isActive } from "@/lib/domain/notes";
import { NoteCard } from "../../remontees/note-card";
import { CLIENT_FIELDS } from "../fields";

export function ClientDetail({ client: c, errors, audit, justifs, notes }: { client: Client; errors: DeliveryError[]; audit: AuditEntry[]; justifs: Justification[]; notes: DeliveryNote[] }) {
  const perms = usePerms();
  const activeNotes = notes.filter((n) => isActive(n));
  const ed = useEditor<Client>();
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { m: MONTHS_SHORT[d.getMonth()], n: errors.filter((e) => e.date.startsWith(k)).length };
    });
  }, [errors]);
  const types = useMemo(() => {
    const m = new Map<string, number>();
    errors.forEach((e) => e.error_type && m.set(e.error_type, (m.get(e.error_type) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [errors]);
  const last = errors[0]?.date;
  return (
    <>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>
      <PageHeader
        title={c.name}
        subtitle={[c.contact_name, c.route && `Tournée ${c.route}`].filter(Boolean).join(" · ") || "Fiche client"}
        actions={
          <>
            {c.phone && (
              <a href={`tel:${c.phone}`}>
                <Button variant="outline"><Phone className="h-4 w-4" /> Appeler</Button>
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`}>
                <Button variant="outline"><Mail className="h-4 w-4" /> E-mail</Button>
              </a>
            )}
            <CanWrite module="clients">
              <Button onClick={() => ed.edit(c)}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </CanWrite>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Erreurs au total" value={errors.length} tone={errors.length ? "warn" : "ok"} />
        <Kpi index={1} label="90 derniers jours" value={errors.filter((e) => daysBetween(e.date) <= 90).length} tone="brand" />
        <Kpi index={2} label="Erreur la plus fréquente" value={types[0]?.[1] ?? 0} sub={types[0]?.[0] || "–"} tone="info" />
        <Kpi index={3} label="Dernière erreur" value={last ? daysBetween(last) : null} suffix=" j" sub={last ? `le ${fmtDate(last)}` : "aucune"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-6">
          {perms.read("remontees") && (
            <Card className={activeNotes.some((n) => n.level === "attention") ? "border-warn/40" : ""}>
              <CardHeader
                title="Remontées et consignes de livraison"
                subtitle={`${activeNotes.length} en cours · ${notes.length} au total`}
                actions={
                  perms.contribute && (
                    <Link href={`/remontees?client=${c.id}`}>
                      <Button size="sm" variant="secondary">
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                      </Button>
                    </Link>
                  )
                }
              />
              {activeNotes.length ? (
                <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
                  {activeNotes.map((n, i) => (
                    <NoteCard key={n.id} n={n} i={i} compact />
                  ))}
                </div>
              ) : (
                <Empty title="Aucune remontée en cours pour ce client" />
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Erreurs sur 12 mois" />
            <div className="px-3 pb-4">
              <Bars data={monthly} x="m" series={[{ key: "n", label: "Erreurs", color: "var(--brand)" }]} height={200} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Historique des erreurs" subtitle={`${errors.length} erreur(s)`} />
            {errors.length ? (
              <ul className="divide-y divide-line">
                {errors.map((e) => {
                  const j = justifs.find((x) => x.error_id === e.id);
                  return (
                    <li key={e.id} className="grid gap-1 px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular font-semibold">{fmtDate(e.date)}</span>
                        <Badge tone="warn">{e.error_type}</Badge>
                        {e.route && <span className="text-xs text-muted">Tournée {e.route}</span>}
                        {j && <Badge tone={JUSTIF_CONCLUSIONS[j.conclusion || ""].tone}>{JUSTIF_CONCLUSIONS[j.conclusion || ""].label}</Badge>}
                      </div>
                      <p className="text-muted">
                        {[e.qty && `${e.qty}`, e.packaging, e.goods].filter(Boolean).join(" ")}
                        {e.comment && ` · ${e.comment}`}
                      </p>
                      <p className="text-xs text-muted">{[e.origin, e.picker, e.driver].filter(Boolean).join(" · ")}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="Aucune erreur pour ce client" />
            )}
          </Card>
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader title="Coordonnées et consignes" />
            <div className="grid gap-3 px-5 pb-5 text-sm">
              {c.address && (
                <a className="flex items-start gap-2 hover:text-brand" href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span className="whitespace-pre-wrap">{c.address}</span>
                </a>
              )}
              {c.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted" />{c.phone}</p>}
              {c.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" />{c.email}</p>}
              {c.notes ? <p className="rounded-xl bg-surface-2 p-3 whitespace-pre-wrap">{c.notes}</p> : <p className="text-muted">Pas de consigne renseignée.</p>}
            </div>
          </Card>
          <HistoryCardClient entries={audit} />
        </div>
      </div>
      <EntityForm open={ed.open} onClose={ed.close} title={`Modifier ${c.name}`} table="clients" id={c.id} initial={{ ...c }} fields={CLIENT_FIELDS} />
    </>
  );
}
