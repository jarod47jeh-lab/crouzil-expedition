"use client";
import { DepotBanner } from "@/components/depot/banner";
import { buildVehicles } from "@/components/depot/summary";
import { minimalSummary } from "@/components/depot/summary-empty";
import { CanWrite } from "@/components/app/perms-context";
import Link from "next/link";
import { Camera, Forklift, Plus, Truck } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { TruckArt } from "@/components/ui/truck-art";
import { cn, nf } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { PageHeader } from "@/components/ui/page-header";
import { ASSET_KINDS, REPAIR_OPEN } from "@/lib/domain/constants";
import { daysBetween, fmtDate, fmtShort } from "@/lib/domain/dates";
import type { Asset, Employee, Repair } from "@/lib/types";
import { ASSET_FIELDS, assetInitial, nextDue } from "./fields";

export function DueBadge({ d }: { d: string | null }) {
  if (!d) return <span className="text-muted">–</span>;
  const left = -daysBetween(d);
  const tone = left < 0 ? "bad" : left <= 30 ? "warn" : "muted";
  return <Badge tone={tone}>{left < 0 ? `Dépassé (${fmtDate(d)})` : left <= 30 ? `Dans ${left} j` : fmtDate(d)}</Badge>;
}

export function ParcView({ assets, repairs, employees = [] }: { assets: Asset[]; repairs: Repair[]; employees?: Employee[] }) {
  const ed = useEditor<Asset>();
  const [view, setView] = useState<"cartes" | "liste">("cartes");
  const today = new Date().toISOString().slice(0, 10);
  const vehicles = buildVehicles(assets, repairs, today);
  const vOf = (a: Asset) => vehicles.find((v) => v.id === a.id);
  const driver = (a: Asset) => {
    const n = (a.assigned_to || "").trim().toLowerCase();
    if (!n) return null;
    return employees.find((e) => e.name.toLowerCase() === n) || employees.find((e) => e.name.toLowerCase().split(" ")[0] === n.split(" ")[0]) || null;
  };
  const fleet = assets.filter((a) => a.kind === "VEH" && a.active);
  const gear = assets.filter((a) => a.kind !== "VEH" && a.active);
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
        title="Véhicules et matériel"
        icon={<Truck className="h-6 w-6" />}
        subtitle="Véhicules, transpalettes, diables et autre matériel"
        actions={
          <CanWrite module="parc">
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
          </CanWrite>
        }
      />
      <DepotBanner focus="parking" caption="Véhicules" summary={minimalSummary(buildVehicles(assets, repairs, new Date().toISOString().slice(0, 10)))} />
      <div className="mb-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="grid min-w-max grid-flow-col auto-cols-[minmax(140px,1fr)] overflow-hidden rounded-2xl border border-line bg-surface sm:min-w-0">
          {[
            ["Véhicules", fleet.length, "text-ink", `${vehicles.filter((v) => v.state === "ok").length} disponibles`],
            ["Immobilisés", immo.length, immo.length ? "text-bad" : "text-ok", immo.map((a) => a.name).join(", ") || "aucun"],
            ["Échéances à 30 jours", dueSoon.length, dueSoon.length ? "text-warn" : "text-ok", "CT, entretien, assurance"],
            ["Matériel", gear.length, "text-ink", "transpalettes, diables…"],
          ].map(([l, v, c, sub], i) => (
            <div key={l as string} className={cn("px-4 py-3", i && "border-l border-line")}>
              <p className="truncate text-[11px] font-semibold tracking-[0.07em] text-muted uppercase">{l}</p>
              <p className={cn("tabular mt-1 font-display text-[26px] leading-none font-bold", c as string)}>{v}</p>
              <p className="mt-1 truncate text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Flotte</h2>
        <div className="flex rounded-xl border border-line bg-surface p-0.5 text-sm font-semibold">
          {(["cartes", "liste"] as const).map((k) => (
            <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={cn("rounded-lg px-3 py-1.5", view === k ? "bg-ink text-bg" : "text-muted")}>
              {k === "cartes" ? "Cartes" : "Liste"}
            </button>
          ))}
        </div>
      </div>
      {view === "cartes" ? (
        <>
          {fleet.length ? (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fleet.map((a, i) => {
                const v = vOf(a)!;
                const d = driver(a);
                const o = openOf(a);
                const dues = [["CT", a.ct_due], ["Entretien", a.service_due], ["Assurance", a.insurance_due]] as const;
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className="group grid overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-brand/40">
                    <Link href={`/parc/${a.id}`} className="relative block bg-gradient-to-b from-surface-2/70 to-surface px-4 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-md border-2 border-ink bg-surface px-2 font-mono text-sm font-bold">{a.ref || "—"}</span>
                        <Badge tone={v.state === "bad" ? "bad" : v.state === "warn" ? "warn" : "ok"} dot>
                          {v.state === "bad" ? "Immobilisé" : v.state === "warn" ? "À surveiller" : "Disponible"}
                        </Badge>
                      </div>
                      <TruckArt state={v.state} small={/vl|utilitaire|fourgon/i.test(`${a.designation} ${a.name}`)} className="mx-auto -mt-1 h-[92px] w-full transition-transform group-hover:-translate-y-0.5" />
                    </Link>
                    <div className="grid gap-3 px-4 pt-1 pb-4">
                      <div>
                        <Link href={`/parc/${a.id}`} className="font-display text-lg leading-tight font-bold hover:text-brand">{a.name}</Link>
                        <p className="text-xs text-muted">{[a.designation, a.brand, a.model, a.tonnage].filter(Boolean).join(" · ") || "Véhicule"}</p>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 p-2">
                        {d ? <Avatar e={d} size={32} /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-surface text-xs text-muted">?</span>}
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-semibold">{d ? d.name : a.assigned_to || "Pas de chauffeur attitré"}</p>
                          <p className="text-xs text-muted">{a.mileage ? `${nf(a.mileage)} km` : "Kilométrage non saisi"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {dues.map(([k, dd]) => {
                          const left = dd ? -daysBetween(dd) : null;
                          return (
                            <div key={k} className={cn("rounded-lg border px-1 py-1.5", left == null ? "border-dashed border-line text-muted" : left < 0 ? "border-bad/40 bg-bad/8 text-bad" : left <= 30 ? "border-warn/40 bg-warn/10 text-warn" : "border-line")}>
                              <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80">{k}</p>
                              <p className="text-xs font-bold">{dd ? (left! < 0 ? "Dépassé" : left! <= 60 ? `${left} j` : fmtShort(dd)) : "—"}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        {o.length ? <Badge tone={o.some((r) => r.immobilized) ? "bad" : "warn"} dot>{o.length} réparation(s)</Badge> : <span className="text-xs text-muted">Aucune réparation en cours</span>}
                        <CanWrite module="reparations">
                          <Link href={`/signaler?asset=${a.id}`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold hover:border-brand/40 hover:text-brand">
                            <Camera className="h-3.5 w-3.5" /> Signaler
                          </Link>
                        </CanWrite>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="mb-6 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Aucun véhicule. Ajoutez-en avec le bouton « Ajouter ».</p>
          )}
          {gear.length > 0 && (
            <>
              <h2 className="mb-3 text-lg font-bold">Matériel</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gear.map((a) => {
                  const o = openOf(a);
                  return (
                    <Link key={a.id} href={`/parc/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-brand/40">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet/10 text-violet">
                        <Forklift className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{a.name}</span>
                        <span className="text-xs text-muted">{ASSET_KINDS[a.kind].label}{a.ref ? ` · ${a.ref}` : ""}</span>
                      </span>
                      {o.length ? <Badge tone="warn">{o.length}</Badge> : <Badge tone="ok" dot>OK</Badge>}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
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
      )}
      <EntityForm open={ed.open} onClose={ed.close} title={ed.row ? `Modifier ${ed.row.name}` : "Ajouter au parc"} table="assets" id={ed.row?.id} initial={assetInitial(ed.row)} fields={ASSET_FIELDS} />
    </>
  );
}
