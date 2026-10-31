"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FileSpreadsheet, Gauge as GaugeIcon, MessageSquareText, PackageX, Plus, Truck, Upload, Users } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bars, Gauge, RankBars, Trend } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { importErrors, saveVolume, type ImportedError } from "@/lib/actions/crud";
import { ERROR_ORIGINS, ERROR_TYPES, JUSTIF_CONCLUSIONS } from "@/lib/domain/constants";
import { MONTHS, fmtDate, fmtDateTime, iso, isWorkDay, parse, weekStart } from "@/lib/domain/dates";
import { conformity, errorKeys, originGroup } from "@/lib/domain/errors";
import { MONTHS_SHORT } from "@/lib/domain/constants-ext";
import type { Client, DeliveryError, Justification, Settings } from "@/lib/types";
import { cn, nf, pct } from "@/lib/utils";
import { JustificationDialog } from "./justification";

interface Props {
  tab: string;
  period?: string;
  errors: DeliveryError[];
  volumes: Record<string, number>;
  justifs: Justification[];
  settings: Settings;
  clients: Client[];
  lastImport: { source: string; updated_at: string } | null;
}

const GROUP_COLOR: Record<string, string> = { Préparation: "#6B4FC8", Livraison: "#2F6FDE", Autre: "#E8590C", Inconnu: "#9A9093" };

export function ErrorsView(p: Props) {
  const ed = useEditor<DeliveryError>();
  const periods = useMemo(() => {
    const ms = [...new Set(p.errors.map((e) => e.date.slice(0, 7)).concat(Object.keys(p.volumes).map((d) => d.slice(0, 7))))].sort().reverse();
    const ys = [...new Set(ms.map((m) => m.slice(0, 4)))];
    return { ms, ys };
  }, [p.errors, p.volumes]);
  const period = p.period || periods.ms[0] || String(new Date().getFullYear());
  const inPeriod = (d: string) => period === "all" || d.startsWith(period);
  const label = period === "all" ? "toute la période" : period.length === 4 ? period : `${MONTHS[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;
  const q = (o: Record<string, string>) => "/erreurs?" + new URLSearchParams({ p: period, ...o }).toString();

  return (
    <>
      <PageHeader
        title="Erreurs de livraison"
        icon={<PackageX className="h-6 w-6" />}
        subtitle={p.lastImport ? `Dernier import : ${p.lastImport.source}, le ${fmtDateTime(p.lastImport.updated_at)}` : "Relevé et suivi des litiges et erreurs de tournée"}
        actions={
          <>
            <Link href={q({ tab: "import" })}>
              <Button variant="outline">
                <Upload className="h-4 w-4" /> Importer l&apos;Excel
              </Button>
            </Link>
            <Button onClick={ed.create}>
              <Plus className="h-4 w-4" /> Nouvelle erreur
            </Button>
          </>
        }
      />
      <Tabs
        id="err-tabs"
        active={p.tab}
        tabs={[
          { key: "dash", label: "Tableau de bord", href: q({ tab: "dash" }) },
          { key: "list", label: "Détail des erreurs", href: q({ tab: "list" }) },
          { key: "import", label: "Import et volumes", href: q({ tab: "import" }) },
        ]}
      />
      {p.tab !== "import" && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted">Période :</span>
          <select
            value={period}
            onChange={(e) => (window.location.href = q({ tab: p.tab, p: e.target.value }))}
            className="field h-9 min-h-0 w-auto pr-8 text-sm"
          >
            {periods.ms.map((m) => (
              <option key={m} value={m}>
                {MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}
              </option>
            ))}
            {periods.ys.map((y) => (
              <option key={y} value={y}>
                Année {y}
              </option>
            ))}
            <option value="all">Toute la période</option>
          </select>
        </div>
      )}
      {p.tab === "dash" && <Dashboard {...p} inPeriod={inPeriod} label={label} />}
      {p.tab === "list" && <List {...p} inPeriod={inPeriod} onEdit={ed.edit} />}
      {p.tab === "import" && <ImportTab {...p} />}
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? "Modifier l'erreur" : "Nouvelle erreur de livraison"}
        table="delivery_errors"
        id={ed.row?.id}
        initial={ed.row ? { ...ed.row } : { date: iso(new Date()), qty: 1, error_type: "Manquant", origin: "Intégration Préparateur" }}
        transform={(v) => {
          const c = p.clients.find((x) => x.name.toUpperCase() === String(v.client_name || "").trim().toUpperCase());
          return { ...v, client_id: c?.id || null };
        }}
        fields={[
          { name: "date", label: "Date", type: "date", required: true },
          { name: "client_name", label: "Client", required: true, placeholder: "Nom du client" },
          { name: "route", label: "Tournée", placeholder: "TM10" },
          { name: "driver", label: "Chauffeur" },
          { name: "error_type", label: "Type d'erreur", type: "select", required: true, options: ERROR_TYPES },
          { name: "origin", label: "Origine", type: "select", options: ERROR_ORIGINS },
          { name: "goods", label: "Marchandise", placeholder: "Vins, Bières, Café…" },
          { name: "packaging", label: "Conditionnement", placeholder: "Carton, Fût, BIB…" },
          { name: "qty", label: "Quantité", type: "number", step: "0.5" },
          { name: "picker", label: "Préparateur" },
          { name: "other_resp", label: "Autre responsable" },
          { name: "comment", label: "Commentaire", type: "textarea" },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------------
function Dashboard({ errors, volumes, settings, inPeriod, label, justifs }: Props & { inPeriod: (d: string) => boolean; label: string }) {
  const target = Number(settings.conformity_target);
  const conf = conformity(errors, volumes, inPeriod);
  const rows = errors.filter((e) => inPeriod(e.date));

  const weekly = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    for (const e of rows) {
      const w = iso(weekStart(parse(e.date)));
      const r = m.get(w) || { w: fmtDate(w).slice(0, 5), k: w, Préparation: 0, Livraison: 0, Autre: 0, Inconnu: 0 };
      r[originGroup(e.origin)] = (r[originGroup(e.origin)] as number) + 1;
      m.set(w, r);
    }
    return [...m.values()].sort((a, b) => String(a.k).localeCompare(String(b.k)));
  }, [rows]);

  const monthly = useMemo(() => {
    const ms = [...new Set(Object.keys(volumes).map((d) => d.slice(0, 7)))].sort().slice(-12);
    return ms.map((mo) => {
      const c = conformity(errors, volumes, (d) => d.startsWith(mo));
      return { m: MONTHS_SHORT[Number(mo.slice(5)) - 1] + " " + mo.slice(2, 4), Global: c ? +c.global.toFixed(2) : null, Préparation: c ? +c.prep.toFixed(2) : null, Livraison: c ? +c.liv.toFixed(2) : null };
    });
  }, [errors, volumes]);

  const top = (f: (e: DeliveryError) => string | null | undefined, n = 8) => {
    const m = new Map<string, number>();
    rows.forEach((e) => {
      const k = (f(e) || "").trim();
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k: k.length > 28 ? k.slice(0, 27) + "…" : k, v }));
  };
  const jDone = rows.filter((e) => justifs.some((j) => j.error_id === e.id)).length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold">Conformité, {label}</h2>
            <Badge tone="muted">Objectif {nf(target)} %</Badge>
          </div>
          {conf ? (
            <div className="grid grid-cols-3 gap-2">
              {([["Global", conf.global, GaugeIcon], ["Préparation", conf.prep, Users], ["Livraison", conf.liv, Truck]] as const).map(([l, v, I], i) => (
                <motion.div key={l} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 * i }} className="relative grid place-items-center">
                  <Gauge value={v} target={target} size={140} />
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <I className="mx-auto mb-0.5 h-4 w-4 text-muted" />
                      <p className={cn("font-display text-xl font-bold", v >= target ? "text-ok" : "text-bad")}>{pct(v, 2)}</p>
                      <p className="text-[11px] font-semibold text-muted uppercase">{l}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <Empty title="Pas de volumes livrés pour cette période">Saisissez le nombre de livraisons par jour dans « Import et volumes » pour calculer la conformité.</Empty>
          )}
          {conf && (
            <p className="mt-2 text-center text-xs text-muted">
              {conf.errors} erreur(s) sur {nf(conf.deliveries)} livraisons ({conf.days} jours renseignés). Sous {nf(target)} %, l&apos;objectif n&apos;est pas tenu.
            </p>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Kpi index={0} label="Erreurs" value={rows.length} tone="brand" icon={<PackageX className="h-5 w-5" />} sub={label} />
          <Kpi index={1} label="Clients touchés" value={new Set(rows.map((e) => e.client_name)).size} tone="info" />
          <Kpi index={2} label="Côté préparation" value={rows.filter((e) => originGroup(e.origin) === "Préparation").length} tone="violet" />
          <Kpi index={3} label="Justifications" value={jDone} tone={jDone < rows.length ? "warn" : "ok"} icon={<MessageSquareText className="h-5 w-5" />} sub={`sur ${rows.length} erreurs`} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Erreurs par semaine" subtitle="Selon l'origine" />
          <div className="px-3 pb-4">
            {weekly.length ? <Bars data={weekly} x="w" stacked series={Object.entries(GROUP_COLOR).map(([k, c]) => ({ key: k, label: k, color: c }))} /> : <Empty title="Aucune erreur" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Évolution de la conformité" subtitle="Par mois, en %" />
          <div className="px-3 pb-4">
            {monthly.length ? (
              <Trend
                data={monthly}
                x="m"
                unit=" %"
                domain={[Math.floor(Math.min(target, ...monthly.flatMap((m) => [m.Global, m.Préparation, m.Livraison].filter((x): x is number => x != null))) - 0.5), 100]}
                refLine={{ y: target, label: `objectif ${target} %` }}
                series={[
                  { key: "Global", label: "Global", color: "var(--brand)" },
                  { key: "Préparation", label: "Préparation", color: "#6B4FC8" },
                  { key: "Livraison", label: "Livraison", color: "#2F6FDE" },
                ]}
              />
            ) : (
              <Empty title="Pas de volumes saisis" />
            )}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[
          ["Types d'erreurs", top((e) => e.error_type), "#E8590C"],
          ["Clients les plus touchés", top((e) => e.client_name), "#CE0013"],
          ["Par préparateur", top((e) => e.picker), "#6B4FC8"],
        ].map(([t, d, c]) => (
          <Card key={t as string}>
            <CardHeader title={t as string} />
            <div className="px-5 pb-5">
              {(d as { k: string }[]).length ? <RankBars data={d as { k: string; v: number }[]} color={c as string} /> : <Empty title="Aucune donnée" />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function List({ errors, justifs, clients, inPeriod, onEdit }: Props & { inPeriod: (d: string) => boolean; onEdit: (e: DeliveryError) => void }) {
  const [j, setJ] = useState<DeliveryError | null>(null);
  const rows = errors.filter((e) => inPeriod(e.date));
  const jOf = (e: DeliveryError) => justifs.find((x) => x.error_id === e.id);
  const jLabel = (e: DeliveryError) => {
    const x = jOf(e);
    return x ? JUSTIF_CONCLUSIONS[x.conclusion || ""] : { label: "À recueillir", tone: "warn" as const };
  };
  const clientId = (e: DeliveryError) => e.client_id || clients.find((c) => c.name.toUpperCase() === e.client_name.toUpperCase())?.id;
  return (
    <>
      <DataTable
        rows={rows}
        table="delivery_errors"
        exportName="erreurs-livraison"
        onEdit={onEdit}
        dense
        searchText={(e) => `${e.client_name} ${e.error_type} ${e.goods} ${e.picker} ${e.driver} ${e.comment} ${e.route}`}
        initialSort={{ key: "date", dir: "desc" }}
        filters={[
          { key: "type", label: "Type", options: [...new Set(rows.map((e) => e.error_type || ""))].filter(Boolean).sort().map((t) => [t, t]), value: (e) => e.error_type || "" },
          { key: "grp", label: "Origine", options: Object.keys(GROUP_COLOR).map((g) => [g, g]), value: (e) => originGroup(e.origin) },
          { key: "j", label: "Justification", options: [["À recueillir", "À recueillir"], ...Object.values(JUSTIF_CONCLUSIONS).map((c) => [c.label, c.label] as [string, string])], value: (e) => jLabel(e).label },
        ]}
        columns={[
          { key: "date", header: "Date", sort: (e) => e.date, exportValue: (e) => fmtDate(e.date), cell: (e) => <span className="tabular whitespace-nowrap">{fmtDate(e.date)}</span> },
          {
            key: "client",
            header: "Client",
            sort: (e) => e.client_name,
            cell: (e) => {
              const id = clientId(e);
              return id ? <Link href={`/clients/${id}`} className="font-semibold hover:text-brand">{e.client_name}</Link> : <b>{e.client_name}</b>;
            },
          },
          { key: "type", header: "Erreur", sort: (e) => e.error_type, cell: (e) => <Badge tone="warn">{e.error_type}</Badge> },
          { key: "goods", header: "Marchandise", hideOnMobile: true, sort: (e) => e.goods, exportValue: (e) => [e.qty, e.packaging, e.goods].filter(Boolean).join(" "), cell: (e) => <span className="text-muted">{[e.qty && nf(Number(e.qty), 1), e.packaging, e.goods].filter(Boolean).join(" · ")}</span> },
          { key: "origin", header: "Origine", hideOnMobile: true, sort: (e) => e.origin, cell: (e) => <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[originGroup(e.origin)] }} />{e.origin}</span> },
          { key: "who", header: "Responsable", sort: (e) => e.picker || e.driver || e.other_resp, exportValue: (e) => [e.picker, e.driver, e.other_resp].filter(Boolean).join(", "), cell: (e) => [e.picker, e.driver, e.other_resp].filter(Boolean).join(", ") || <span className="text-muted">–</span> },
          { key: "comment", header: "Commentaire", hideOnMobile: true, exportValue: (e) => e.comment, cell: (e) => <span className="line-clamp-2 max-w-[260px] text-xs text-muted">{e.comment}</span> },
          {
            key: "j",
            header: "Justification",
            sort: (e) => jLabel(e).label,
            exportValue: (e) => jLabel(e).label,
            cell: (e) => (
              <button onClick={() => setJ(e)} className="transition-transform hover:scale-105">
                <Badge tone={jLabel(e).tone} dot>{jLabel(e).label}</Badge>
              </button>
            ),
          },
        ]}
      />
      <JustificationDialog error={j} justif={j ? jOf(j) || null : null} onClose={() => setJ(null)} />
    </>
  );
}

// ---------------------------------------------------------------------
function ImportTab({ volumes, errors }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<{ rows: ImportedError[]; volumes: Record<string, number>; name: string } | null>(null);
  const [pending, start] = useTransition();
  const known = new Set(errors.map((e) => e.import_key));

  const read = async (f: File) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array", cellDates: true });
      const MAP: Record<string, RegExp> = {
        date: /^DATE/, client_name: /^CLIENT/, route: /^TOURN/, driver: /^CHAUFFEUR/, goods: /^MARCHANDISE/, qty: /^(QT|QUANTIT)/, packaging: /^TYPE DE MARCH/,
        error_type: /^TYPE D.ERREUR/, origin: /^ORIGINE/, picker: /^PR[ÉE]PARATEUR/, other_resp: /^RESPONSABLE/, comment: /^COMMENTAIRE/,
      };
      const clean = (x: unknown) => (x == null ? "" : String(x).replace(/\s+/g, " ").trim());
      const day = (d: Date) => iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() > 12 ? 1 : 0)));
      const raw: Omit<ImportedError, "import_key">[] = [];
      for (const n of wb.SheetNames) {
        if (!/^\d{2}-/.test(n)) continue;
        const a = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: null });
        // ligne d'en-têtes : la première (parmi les 15 premières) qui contient DATE et CLIENT
        const hr = a.slice(0, 15).findIndex((row) => {
          const h = (row || []).map((x) => clean(x).toUpperCase());
          return h.some((x) => MAP.date.test(x)) && h.some((x) => MAP.client_name.test(x));
        });
        if (hr < 0) continue;
        const h = (a[hr] || []).map((x) => clean(x).toUpperCase());
        const idx = Object.fromEntries(Object.entries(MAP).map(([k, re]) => [k, h.findIndex((x) => re.test(x))]));
        for (let i = hr + 1; i < a.length; i++) {
          const l = a[i];
          if (!l || !(l[idx.date] instanceof Date)) continue;
          const o = Object.fromEntries(Object.keys(MAP).filter((k) => k !== "date").map((k) => [k, idx[k] >= 0 ? clean(l[idx[k]]) : ""])) as Record<string, string>;
          raw.push({ ...(o as unknown as Omit<ImportedError, "import_key">), date: day(l[idx.date] as Date), qty: Number(o.qty) || 0 });
        }
      }
      const vols: Record<string, number> = {};
      const act = wb.Sheets["Activité"];
      if (act)
        XLSX.utils.sheet_to_json<unknown[]>(act, { header: 1, raw: true, defval: null })
          .forEach((l) => {
            if (l && l[0] instanceof Date && Number(l[4]) > 0) vols[day(l[0] as Date)] = Number(l[4]);
          });
      if (!raw.length) return void toast.error("Aucune ligne trouvée : le fichier doit contenir des onglets mois (« 09-Sep ») avec une ligne d'en-têtes DATE, CLIENT…");
      const keys = errorKeys(raw);
      setPreview({ rows: raw.map((r, i) => ({ ...r, import_key: keys[i] })), volumes: vols, name: f.name });
    } catch (e) {
      console.error(e);
      toast.error("Lecture impossible. Vérifiez qu'il s'agit bien du fichier Suivi_Erreurs.xlsx.");
    }
  };

  const save = () =>
    start(async () => {
      if (!preview) return;
      const res = await importErrors(preview.rows, preview.volumes, preview.name);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data!.errors} erreurs importées, ${res.data!.clients} nouveau(x) client(s), ${res.data!.volumes} jour(s) de volumes`);
      setPreview(null);
      router.refresh();
    });

  const newCount = preview ? preview.rows.filter((r) => !known.has(r.import_key)).length : 0;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Importer le fichier de suivi" subtitle="Suivi_Erreurs.xlsx : onglets mois et onglet « Activité »" />
        <div className="grid gap-4 px-5 pb-5">
          <motion.button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) read(f);
            }}
            animate={{ scale: drag ? 1.02 : 1 }}
            className={cn("grid place-items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-brand bg-brand/5" : "border-line hover:border-brand/50")}
          >
            <FileSpreadsheet className="h-10 w-10 text-ok" />
            <span className="font-semibold">Glissez le fichier ici ou cliquez pour le choisir</span>
            <span className="text-sm text-muted">Les lignes déjà importées sont mises à jour, sans doublon. Les nouveaux clients sont créés automatiquement.</span>
          </motion.button>
          <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          {preview && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface-2/50 p-4">
              <p className="font-semibold">{preview.name}</p>
              <ul className="mt-2 grid gap-1 text-sm">
                <li>
                  <b>{preview.rows.length}</b> lignes lues, dont <b className="text-ok">{newCount} nouvelles</b> et {preview.rows.length - newCount} déjà connues
                </li>
                <li>
                  <b>{Object.keys(preview.volumes).length}</b> jours de volumes livrés (onglet Activité)
                </li>
              </ul>
              <div className="mt-3 flex gap-2">
                <Button onClick={save} loading={pending}>
                  Enregistrer l&apos;import
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Annuler
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
      <VolumesCard volumes={volumes} />
    </div>
  );
}

function VolumesCard({ volumes }: { volumes: Record<string, number> }) {
  const router = useRouter();
  const [ym, setYm] = useState(() => iso(new Date()).slice(0, 7));
  const [, start] = useTransition();
  const [y, m] = ym.split("-").map(Number);
  const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => new Date(y, m - 1, i + 1)).filter(isWorkDay);
  const total = days.reduce((s, d) => s + (volumes[iso(d)] || 0), 0);
  const save = (d: string, v: string) =>
    start(async () => {
      const n = v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0);
      if ((volumes[d] ?? null) === n) return;
      const res = await saveVolume(d, n);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Volume du ${fmtDate(d)} enregistré`);
      router.refresh();
    });
  return (
    <Card>
      <CardHeader
        title="Livraisons par jour"
        subtitle={`Base du taux de conformité · ${nf(total)} livraisons ce mois`}
        actions={<input type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} className="field h-9 min-h-0 w-auto" />}
      />
      <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-4">
        {days.map((d) => (
          <label key={iso(d)} className="flex flex-col gap-1 rounded-xl border border-line p-2">
            <span className="text-xs font-semibold text-muted">{d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</span>
            <input
              type="number"
              min={0}
              defaultValue={volumes[iso(d)] ?? ""}
              key={iso(d) + (volumes[iso(d)] ?? "")}
              onBlur={(e) => save(iso(d), e.target.value)}
              className="field h-8 min-h-0 px-2 text-sm"
              placeholder="–"
            />
          </label>
        ))}
        {!days.length && <Empty title="Aucun jour ouvré" />}
      </div>
    </Card>
  );
}
