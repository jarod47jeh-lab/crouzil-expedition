"use client";
import Link from "next/link";
import { CalendarClock, Forklift, Plus, Siren, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { ASSET_KINDS, REPAIR_OPEN } from "@/lib/domain/constants";
import { daysBetween, fmtDate } from "@/lib/domain/dates";
import type { Asset, Repair } from "@/lib/types";
import { ASSET_FIELDS, assetInitial, nextDue } from "./fields";

export function DueBadge({ d }: { d: string | null }) {
  if (!d) return <span className="text-muted">–</span>;
  const left = -daysBetween(d);
  const tone = left < 0 ? "bad" : left <= 30 ? "warn" : "muted";
  return <Badge tone={tone}>{left < 0 ? `Dépassé (${fmtDate(d)})` : left <= 30 ? `Dans ${left} j` : fmtDate(d)}</Badge>;
}

export function ParcView({ assets, repairs }: { assets: Asset[]; repairs: Repair[] }) {
  const ed = useEditor<Asset>();
  const open = repairs.filter((r) => REPAIR_OPEN.includes(r.status));
  const openOf = (a: Asset) => open.filter((r) => r.asset_id === a.id);
  const immo = assets.filter((a) => openOf(a).some((r) => r.immobilized));
  const dueSoon = assets.filter((a) => {
    const n = nextDue(a);
    return n && -daysBetween(n.d) <= 30;
  });
  return (
    <>
      <PageHeader
        title="Parc et matériel"
        icon={<Truck className="h-6 w-6" />}
        subtitle="Véhicules, transpalettes, diables et autre matériel"
        actions={
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Véhicules" value={assets.filter((a) => a.kind === "VEH" && a.active).length} icon={<Truck className="h-5 w-5" />} tone="info" />
        <Kpi index={1} label="Matériel" value={assets.filter((a) => a.kind !== "VEH" && a.active).length} icon={<Forklift className="h-5 w-5" />} tone="violet" />
        <Kpi index={2} label="Immobilisés" value={immo.length} icon={<Siren className="h-5 w-5" />} tone={immo.length ? "bad" : "ok"} sub={immo.map((a) => a.name).join(", ") || "aucun"} />
        <Kpi index={3} label="Échéances à 30 jours" value={dueSoon.length} icon={<CalendarClock className="h-5 w-5" />} tone={dueSoon.length ? "warn" : "ok"} sub="CT, entretien, assurance" />
      </div>
      <DataTable
        rows={assets}
        table="assets"
        exportName="parc"
        onEdit={ed.edit}
        rowHref={(a) => `/parc/${a.id}`}
        searchText={(a) => `${a.name} ${a.ref || ""} ${a.designation || ""} ${a.brand || ""} ${a.model || ""} ${a.assigned_to || ""}`}
        initialSort={{ key: "kind", dir: "asc" }}
        filters={[
          { key: "kind", label: "Type", options: Object.entries(ASSET_KINDS).map(([k, v]) => [k, v.plural]), value: (a) => a.kind },
          { key: "st", label: "État", options: [["rep", "Réparation en cours"], ["off", "Hors service"]], value: (a) => [...(openOf(a).length ? ["rep"] : []), ...(!a.active ? ["off"] : [])] },
        ]}
        columns={[
          { key: "name", header: "Nom", sort: (a) => a.name, cell: (a) => <Link href={`/parc/${a.id}`} className="font-semibold hover:text-brand">{a.name}</Link> },
          { key: "kind", header: "Type", sort: (a) => "VTDM".indexOf(a.kind[0]) + a.name, exportValue: (a) => ASSET_KINDS[a.kind].label, cell: (a) => <Badge tone={a.kind === "VEH" ? "info" : "violet"}>{ASSET_KINDS[a.kind].label}</Badge> },
          { key: "ref", header: "Immat. / réf.", sort: (a) => a.ref, cell: (a) => <span className="tabular font-mono text-[13px]">{a.ref || "–"}</span> },
          { key: "des", header: "Désignation", hideOnMobile: true, sort: (a) => [a.designation, a.brand, a.model].filter(Boolean).join(" "), cell: (a) => <span className="text-muted">{[a.designation, a.brand, a.model, a.tonnage].filter(Boolean).join(" · ")}</span> },
          { key: "due", header: "Prochaine échéance", hideOnMobile: true, sort: (a) => nextDue(a)?.d || "9999", exportValue: (a) => { const n = nextDue(a); return n ? `${n.k} ${fmtDate(n.d)}` : ""; }, cell: (a) => { const n = nextDue(a); return n ? <span className="flex items-center gap-2 text-xs"><span className="text-muted">{n.k}</span><DueBadge d={n.d} /></span> : <span className="text-muted">–</span>; } },
          {
            key: "rep",
            header: "Réparations",
            sort: (a) => openOf(a).length,
            cell: (a) => {
              const o = openOf(a);
              return o.length ? <Badge tone={o.some((r) => r.immobilized) ? "bad" : "warn"} dot>{o.length} en cours</Badge> : !a.active ? <Badge>Hors service</Badge> : <Badge tone="ok" dot>OK</Badge>;
            },
          },
        ]}
      />
      <EntityForm open={ed.open} onClose={ed.close} title={ed.row ? `Modifier ${ed.row.name}` : "Ajouter au parc"} table="assets" id={ed.row?.id} initial={assetInitial(ed.row)} fields={ASSET_FIELDS} />
    </>
  );
}
