"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Copy, Mail, Plus, Send, Siren, Timer, Wrench } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bars, Donut, Legend, RankBars } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useEditor, useOpenOnNew } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { patchRows } from "@/lib/actions/crud";
import { ASSET_KINDS, REPAIR_CATS, REPAIR_OPEN, REPAIR_STATUS, URGENCIES, URGENCY_TONE } from "@/lib/domain/constants";
import { daysBetween, fmtDate, parse } from "@/lib/domain/dates";
import { sortRepairs } from "@/lib/domain/repairs";
import type { Asset, Repair, Settings } from "@/lib/types";
import { cn, nf } from "@/lib/utils";
import { RepairForm } from "./shared";

const ST_COLOR: Record<string, string> = { A: "#C26A00", T: "#2F6FDE", V: "#1F8A43", R: "#CE0013", F: "#8B8285", X: "#B5ABAD" };
const CAT_COLOR = ["#CE0013", "#E8590C", "#B7791F", "#6B4FC8", "#2F6FDE", "#6B7588"];

export function RepairsView({ tab, repairs, assets, settings }: { tab: string; repairs: Repair[]; assets: Asset[]; settings: Settings }) {
  const ed = useEditor<Repair>();
  useOpenOnNew(ed.create);
  const router = useRouter();
  const open = repairs.filter((r) => REPAIR_OPEN.includes(r.status));
  const toSend = open.filter((r) => r.status === "A");
  return (
    <>
      <PageHeader
        title="Réparations"
        icon={<Wrench className="h-6 w-6" />}
        subtitle="Pannes et casses des véhicules et du matériel"
        actions={
          <CanWrite module="reparations">
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Button>
          </CanWrite>
        }
      />
      <Tabs
        id="rep-tabs"
        active={tab}
        tabs={[
          { key: "dash", label: "Tableau de bord", href: "/reparations?tab=dash" },
          { key: "list", label: "Toutes les demandes", href: "/reparations?tab=list", count: open.length },
          { key: "send", label: `À transmettre à ${settings.repair_contact_name}`, href: "/reparations?tab=send", count: toSend.length },
        ]}
      />
      {tab === "dash" && <Dashboard repairs={repairs} assets={assets} />}
      {tab === "list" && <List repairs={repairs} onEdit={ed.edit} />}
      {tab === "send" && <ToSend repairs={toSend} settings={settings} />}
      <RepairForm open={ed.open} onClose={ed.close} row={ed.row} assets={assets} onSaved={(id) => !ed.row && router.push(`/reparations/${id}`)} />
    </>
  );
}

export function RepairCard({ r, i = 0 }: { r: Repair; i?: number }) {
  const age = daysBetween(r.observed_on);
  const k = r.immobilized || r.urgency === "Bloquant" ? "var(--bad)" : r.urgency === "Urgent" ? "var(--warn)" : "var(--line)";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} whileHover={{ y: -2 }}>
      <Link href={`/reparations/${r.id}`} className="block h-full rounded-2xl border border-line border-l-[5px] bg-surface p-4 shadow-card transition-colors hover:border-brand/40" style={{ borderLeftColor: k }}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-display leading-tight font-bold">{r.label}</p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: ST_COLOR[r.status] }}>
            {REPAIR_STATUS[r.status].label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {r.immobilized && <Badge tone="bad">Immobilisé</Badge>}
          {r.urgency !== "Normal" && <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge>}
          <span className="text-xs text-muted">{r.category}</span>
        </div>
        {r.description && <p className="mt-2 line-clamp-2 text-sm text-ink/85">{r.description}</p>}
        <p className="mt-2 text-xs text-muted">
          Constaté le {fmtDate(r.observed_on)} <b className={cn(age > 7 ? "text-bad" : "text-ink")}>({age <= 0 ? "aujourd'hui" : `${age} j`})</b>
          {r.expected_back && <> · retour prévu le {fmtDate(r.expected_back)}</>}
        </p>
      </Link>
    </motion.div>
  );
}

function Dashboard({ repairs, assets }: { repairs: Repair[]; assets: Asset[] }) {
  const open = repairs.filter((r) => REPAIR_OPEN.includes(r.status)).sort(sortRepairs);
  const crit = open.filter((r) => r.immobilized || r.urgency === "Bloquant");
  const year = new Date().getFullYear();
  const closed = repairs.filter((r) => r.status === "F" && r.closed_on);
  const avgDelay = closed.length ? closed.reduce((s, r) => s + Math.max(0, daysBetween(r.observed_on, parse(r.closed_on!))), 0) / closed.length : null;
  const cost = repairs.filter((r) => r.observed_on.startsWith(String(year))).reduce((s, r) => s + (Number(r.cost) || 0), 0);

  const byCat = REPAIR_CATS.map((c, i) => ({ name: c, value: repairs.filter((r) => r.category === c).length, color: CAT_COLOR[i] })).filter((x) => x.value);
  const byAsset = useMemo(() => {
    const m = new Map<string, number>();
    repairs.forEach((r) => m.set(r.label, (m.get(r.label) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label: label.length > 26 ? label.slice(0, 25) + "…" : label, n }));
  }, [repairs]);
  const byStatus = (Object.keys(REPAIR_STATUS) as (keyof typeof REPAIR_STATUS)[]).map((k) => ({ s: REPAIR_STATUS[k].label, n: repairs.filter((r) => r.status === k).length, k }));

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Ouvertes" value={open.length} icon={<Wrench className="h-5 w-5" />} tone="brand" sub="demandes non clôturées" href="/reparations?tab=list" />
        <Kpi index={1} label="Bloquantes / immobilisés" value={crit.length} icon={<Siren className="h-5 w-5" />} tone={crit.length ? "bad" : "ok"} sub={`${assets.filter((a) => a.kind === "VEH").length} véhicules au parc`} />
        <Kpi index={2} label="Délai moyen de clôture" value={avgDelay} decimals={1} suffix=" j" icon={<Timer className="h-5 w-5" />} tone="info" sub={`${closed.length} demandes terminées`} />
        <Kpi index={3} label={`Coût ${year}`} value={cost} suffix=" €" tone="violet" sub="montants saisis (HT)" />
      </div>
      <Card>
        <CardHeader title="En cours" subtitle="Immobilisés et bloquants en premier" />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
          {open.length ? open.map((r, i) => <RepairCard key={r.id} r={r} i={i} />) : <Empty title="Aucune réparation en cours. Tout est clôturé." />}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Par statut" />
          <div className="px-3 pb-4">
            <Bars data={byStatus} x="s" series={[{ key: "n", label: "Demandes", color: "var(--brand)" }]} height={220} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Types de problèmes" />
          <div className="px-5 pb-5">
            {byCat.length ? (
              <>
                <Donut data={byCat} height={170} />
                <Legend items={byCat.map((c) => ({ label: c.name, color: c.color, value: c.value }))} />
              </>
            ) : (
              <Empty title="Aucune donnée" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Les plus touchés" subtitle="Véhicules et matériels" />
          <div className="px-5 pb-5">
            {byAsset.length ? <RankBars data={byAsset.map((x) => ({ k: x.label, v: x.n }))} color="var(--warn)" /> : <Empty title="Aucune donnée" />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function List({ repairs, onEdit }: { repairs: Repair[]; onEdit: (r: Repair) => void }) {
  return (
    <DataTable
      rows={repairs}
      table="repairs"
      exportName="reparations"
      onEdit={onEdit}
      rowHref={(r) => `/reparations/${r.id}`}
      searchText={(r) => `${r.label} ${r.description || ""} ${r.note || ""} ${r.category}`}
      initialSort={{ key: "date", dir: "desc" }}
      filters={[
        { key: "st", label: "Statut", options: [["open", "Non clôturées"], ...Object.entries(REPAIR_STATUS).map(([k, v]) => [k, v.label] as [string, string])], value: (r) => [r.status, ...(REPAIR_OPEN.includes(r.status) ? ["open"] : [])] },
        { key: "kind", label: "Type", options: Object.entries(ASSET_KINDS).map(([k, v]) => [k, v.plural]), value: (r) => r.kind },
        { key: "urg", label: "Urgence", options: URGENCIES.map((u) => [u, u]), value: (r) => r.urgency },
        { key: "cat", label: "Problème", options: REPAIR_CATS.map((c) => [c, c]), value: (r) => r.category },
      ]}
      columns={[
        { key: "label", header: "Véhicule / matériel", sort: (r) => r.label, cell: (r) => <b>{r.label}</b> },
        { key: "cat", header: "Problème", sort: (r) => r.category, cell: (r) => r.category, hideOnMobile: true },
        { key: "desc", header: "Description", exportValue: (r) => r.description, cell: (r) => <span className="line-clamp-1 max-w-[320px] text-muted">{r.description}</span>, hideOnMobile: true },
        {
          key: "urg",
          header: "Urgence",
          sort: (r) => URGENCIES.indexOf(r.urgency) - (r.immobilized ? 10 : 0),
          exportValue: (r) => r.urgency + (r.immobilized ? " (immobilisé)" : ""),
          cell: (r) => (
            <div className="flex gap-1">
              {r.immobilized && <Badge tone="bad">Immo.</Badge>}
              <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge>
            </div>
          ),
        },
        { key: "date", header: "Constaté", sort: (r) => r.observed_on, exportValue: (r) => fmtDate(r.observed_on), cell: (r) => <span className="tabular">{fmtDate(r.observed_on)}</span> },
        { key: "st", header: "Statut", sort: (r) => "ATVRFX".indexOf(r.status), exportValue: (r) => REPAIR_STATUS[r.status].label, cell: (r) => <Badge tone={REPAIR_STATUS[r.status].tone} dot>{REPAIR_STATUS[r.status].label}</Badge> },
        { key: "cost", header: "Coût", className: "text-right", hideOnMobile: true, sort: (r) => Number(r.cost) || 0, cell: (r) => (r.cost ? `${nf(Number(r.cost), 2)} €` : "–") },
      ]}
    />
  );
}

function ToSend({ repairs, settings }: { repairs: Repair[]; settings: Settings }) {
  const router = useRouter();
  const canSend = usePerms().write("reparations");
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string[]>(() => repairs.map((r) => r.id));
  const list = repairs.filter((r) => sel.includes(r.id)).sort(sortRepairs);
  const text = `Bonjour ${settings.repair_contact_name},\n\nVoici les demandes de réparation à traiter (${list.length}) :\n\n${list
    .map(
      (r, i) =>
        `${i + 1}. ${r.label}${r.immobilized ? " - IMMOBILISÉ" : ""}\n   ${r.category}, urgence ${r.urgency.toLowerCase()}, constaté le ${fmtDate(r.observed_on)}${r.mileage ? `, ${r.mileage} km` : ""}\n   ${r.description || ""}`,
    )
    .join("\n\n")}\n\nLes détails et les photos sont dans l'Espace Expédition.\n\nCordialement,\n${settings.signature}`;
  const subject = `Demandes de réparation (${list.length})`;
  const markSent = () =>
    start(async () => {
      const res = await patchRows("repairs", sel, { status: "T" });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${sel.length} demande(s) marquée(s) « Transmis »`);
      router.refresh();
    });

  if (!repairs.length) return <Card><Empty icon={<Send className="h-5 w-5" />} title="Rien à transmettre">Toutes les demandes « À traiter » ont été transmises.</Empty></Card>;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader title="Demandes à transmettre" subtitle="Décochez celles à garder pour plus tard" />
        <ul className="divide-y divide-line">
          {repairs.sort(sortRepairs).map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-surface-2/50">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {r.label}
                    {r.immobilized && <Badge tone="bad">Immobilisé</Badge>}
                    <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{r.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Message prêt à envoyer"
          subtitle={settings.repair_contact_email ? `À : ${settings.repair_contact_email}` : "Ajoutez l'adresse e-mail du destinataire dans les Réglages"}
        />
        <div className="grid gap-3 px-5 pb-5">
          <textarea readOnly value={text} className="field min-h-[280px] font-mono text-[12.5px]" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Message copié"))}>
              <Copy className="h-4 w-4" /> Copier
            </Button>
            <a href={`mailto:${settings.repair_contact_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>
              <Button variant="outline">
                <Mail className="h-4 w-4" /> Ouvrir dans la messagerie
              </Button>
            </a>
            <Button className="ml-auto" onClick={markSent} loading={pending} disabled={!sel.length || !canSend}>
              <Send className="h-4 w-4" /> Marquer comme transmis
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
