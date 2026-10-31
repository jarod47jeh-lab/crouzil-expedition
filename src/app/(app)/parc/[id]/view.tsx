"use client";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { HistoryCardClient } from "@/components/app/history-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { ASSET_KINDS, REPAIR_OPEN } from "@/lib/domain/constants";
import { daysBetween, parse } from "@/lib/domain/dates";
import type { Asset, AuditEntry, Repair } from "@/lib/types";
import { nf } from "@/lib/utils";
import { RepairCard } from "../../reparations/view";
import { RepairForm } from "../../reparations/shared";
import { ASSET_FIELDS, assetInitial } from "../fields";
import { DueBadge } from "../view";

export function AssetDetail({ asset: a, repairs, audit, assets }: { asset: Asset; repairs: Repair[]; audit: AuditEntry[]; assets: Asset[] }) {
  const ed = useEditor<Asset>();
  const rep = useEditor<Repair>();
  const open = repairs.filter((r) => REPAIR_OPEN.includes(r.status));
  const cost = repairs.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const immoDays = repairs.filter((r) => r.immobilized).reduce((s, r) => s + Math.max(1, daysBetween(r.observed_on, r.closed_on ? parse(r.closed_on) : undefined)), 0);
  return (
    <>
      <Link href="/parc" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Parc
      </Link>
      <PageHeader
        title={[a.name, a.designation].filter(Boolean).join(" ")}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {ASSET_KINDS[a.kind].label}
            {a.ref && <span className="font-mono">{a.ref}</span>}
            {!a.active && <Badge>Hors service</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={rep.create}>
              <Plus className="h-4 w-4" /> Signaler un problème
            </Button>
            <Button onClick={() => ed.edit(a)}>
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Réparations en cours" value={open.length} tone={open.some((r) => r.immobilized) ? "bad" : open.length ? "warn" : "ok"} />
        <Kpi index={1} label="Total des demandes" value={repairs.length} tone="info" />
        <Kpi index={2} label="Jours d'immobilisation" value={immoDays} tone="violet" sub="cumul estimé" />
        <Kpi index={3} label="Coût cumulé" value={cost} suffix=" €" sub="HT, montants saisis" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Historique des réparations" subtitle={`${repairs.length} demande(s)`} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            {repairs.length ? repairs.map((r, i) => <RepairCard key={r.id} r={r} i={i} />) : <Empty title="Aucune réparation enregistrée" />}
          </div>
        </Card>
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader title="Caractéristiques" />
            <dl className="grid grid-cols-2 gap-3 px-5 pb-5 text-sm">
              {[
                ["Marque", a.brand],
                ["Modèle", a.model],
                ["Tonnage", a.tonnage],
                ["Palettes", a.pallets],
                ["Kilométrage", a.mileage ? `${nf(a.mileage)} km` : null],
                ["Affecté à", a.assigned_to],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-medium">{v || "–"}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2 border-t border-line px-5 py-4 text-sm">
              {[
                ["Contrôle technique", a.ct_due],
                ["Entretien", a.service_due],
                ["Assurance", a.insurance_due],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{k}</span>
                  <DueBadge d={d} />
                </div>
              ))}
            </div>
            {a.note && <p className="border-t border-line px-5 py-4 text-sm whitespace-pre-wrap">{a.note}</p>}
          </Card>
          <HistoryCardClient entries={audit} />
        </div>
      </div>
      <EntityForm open={ed.open} onClose={ed.close} title={`Modifier ${a.name}`} table="assets" id={a.id} initial={assetInitial(a)} fields={ASSET_FIELDS} />
      <RepairForm open={rep.open} onClose={rep.close} row={null} assets={assets} defaultAsset={a.id} />
    </>
  );
}
