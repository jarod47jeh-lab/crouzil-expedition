"use client";
import dynamic from "next/dynamic";
import { buildVehicles } from "@/components/depot/summary";
import { CanWrite } from "@/components/app/perms-context";
import Link from "next/link";
import { ArrowLeft, Camera, Pencil, Plus } from "lucide-react";
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
import { nf, plural } from "@/lib/utils";
import { RepairCard } from "../../reparations/view";
import { RepairForm } from "../../reparations/shared";
import { ASSET_FIELDS, assetInitial } from "../fields";
import { DueBadge } from "../view";
import { TruckArt } from "@/components/ui/truck-art";

const VehicleModel = dynamic(() => import("@/components/depot/vehicle-model"), { ssr: false });

export function AssetDetail({ asset: a, repairs, audit, assets }: { asset: Asset; repairs: Repair[]; audit: AuditEntry[]; assets: Asset[] }) {
  const ed = useEditor<Asset>();
  const rep = useEditor<Repair>();
  const open = repairs.filter((r) => REPAIR_OPEN.includes(r.status));
  const vehicle = buildVehicles([{ ...a, active: true }], repairs, new Date().toISOString().slice(0, 10))[0];
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
            <CanWrite module="reparations">
              <Link href={`/signaler?asset=${a.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold hover:bg-line/70">
                <Camera className="h-4 w-4" /> Signaler avec une photo
              </Link>
              <Button variant="outline" onClick={rep.create}>
                <Plus className="h-4 w-4" /> Réparation
              </Button>
            </CanWrite>
            <CanWrite module="parc">
              <Button onClick={() => ed.edit(a)}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </CanWrite>
          </>
        }
      />
      {/* en haut : le véhicule et sa fiche, côte à côte */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="relative h-[300px] bg-gradient-to-b from-surface-2/70 to-surface sm:h-[360px]">
            {a.kind === "VEH" ? (
              <VehicleModel v={vehicle} />
            ) : (
              <div className="grid h-full place-items-center">
                <TruckArt state={vehicle.state} small className="w-3/4 max-w-[360px] opacity-90" />
              </div>
            )}
            <span className="absolute top-3 left-4 rounded-md border-2 border-ink bg-surface px-2 font-mono text-base font-semibold">{a.ref || a.name}</span>
            <span className="absolute top-3 right-4">
              <Badge tone={vehicle.state === "bad" ? "bad" : vehicle.state === "warn" ? "warn" : "ok"}>{vehicle.state === "bad" ? "Immobilisé" : vehicle.state === "warn" ? "À surveiller" : "Disponible"}</Badge>
            </span>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-sm text-muted">{vehicle.note}</p>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Fiche du véhicule" subtitle={ASSET_KINDS[a.kind].label} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4 text-sm">
            {[
              ["Immatriculation", a.ref],
              ["Désignation", a.designation],
              ["Marque", a.brand],
              ["Modèle", a.model],
              ["Tonnage", a.tonnage],
              ["Palettes", a.pallets],
              ["Kilométrage", a.mileage ? `${nf(a.mileage)} km` : null],
              ["Chauffeur attitré", a.assigned_to],
            ].map(([k, v]) => (
              <div key={String(k)} className="min-w-0">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="truncate font-semibold">{v || "–"}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-2 border-t border-line px-5 py-4 text-sm">
            <p className="text-xs font-medium text-muted">Échéances</p>
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
          {a.note && <p className="mt-auto border-t border-line px-5 py-4 text-sm whitespace-pre-wrap">{a.note}</p>}
        </Card>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Réparations en cours" value={open.length} tone={open.some((r) => r.immobilized) ? "bad" : open.length ? "warn" : "ok"} />
        <Kpi index={1} label="Total des demandes" value={repairs.length} tone="info" />
        <Kpi index={2} label="Jours d'immobilisation" value={immoDays} tone="violet" sub="cumul estimé" />
        <Kpi index={3} label="Coût cumulé" value={cost} suffix=" €" sub="HT, montants saisis" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Historique des réparations" subtitle={`${plural(repairs.length, "demande")} · ${open.length} en cours`} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 2xl:grid-cols-3">
            {repairs.length ? repairs.map((r, i) => <RepairCard key={r.id} r={r} i={i} />) : <Empty title="Aucune réparation enregistrée" />}
          </div>
        </Card>
        <HistoryCardClient entries={audit} />
      </div>
      <EntityForm open={ed.open} onClose={ed.close} title={`Modifier ${a.name}`} table="assets" id={a.id} initial={assetInitial(a)} fields={ASSET_FIELDS} />
      <RepairForm open={rep.open} onClose={rep.close} row={null} assets={assets} defaultAsset={a.id} />
    </>
  );
}
