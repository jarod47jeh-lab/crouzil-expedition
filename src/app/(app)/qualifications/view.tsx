"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, CalendarClock, CheckCircle2, Download, FileSpreadsheet, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePerms } from "@/components/app/perms-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { saveRow, trashRows } from "@/lib/actions/crud";
import { TEAM_ORDER, TEAMS } from "@/lib/domain/constants";
import { daysBetween, fmtDate, fmtShort, iso, today } from "@/lib/domain/dates";
import { appliesTo, expiryOf, QUAL_CATEGORIES, QUAL_STATE, QUAL_TEAMS, qualStatus, type QualState } from "@/lib/domain/qualifications";
import { downloadWorkbook, pct, type Cell, type ExportKind } from "@/lib/exports/workbook";
import type { Employee, Qualification, QualificationType, Team } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

type Tab = "tableau" | "echeances" | "catalogue";
const TEAM_CHOICES: [string, string][] = [
  ["chauf,prep", "Chauffeurs et préparateurs"],
  ["chauf", "Chauffeurs"],
  ["prep", "Préparateurs"],
  ["all", "Toutes les équipes"],
];
const STATE_CLS: Record<QualState, string> = {
  valid: "bg-ok/14 text-ok",
  soon: "bg-warn/16 text-warn",
  expired: "bg-bad/14 text-bad",
  missing: "border border-dashed border-bad/60 text-bad",
  none: "text-muted/50",
};

export function QualificationsView({ tab, employees, types, quals }: { tab: Tab; employees: Employee[]; types: QualificationType[]; quals: Qualification[] }) {
  const canEdit = usePerms().write("equipe");
  const t = iso(today());
  const tracked = employees.filter((e) => !e.freelance || QUAL_TEAMS.includes(e.team));
  // état de chaque qualification attendue (types qui concernent l'équipe de la personne)
  const cells = useMemo(
    () => tracked.flatMap((e) => types.filter((ty) => appliesTo(ty, e.team)).map((ty) => ({ e, ty, ...qualStatus(ty, e, quals, t) }))),
    [tracked, types, quals, t],
  );
  const n = (s: QualState) => cells.filter((c) => c.state === s).length;
  const [edit, setEdit] = useState<{ e: Employee | null; ty: QualificationType | null; q: Qualification | null } | null>(null);
  const href = (k: Tab) => `/qualifications?tab=${k}`;
  return (
    <>
      <PageHeader
        title="Qualifications et formations"
        icon={<Award className="h-6 w-6" />}
        subtitle="CACES, permis, FCO, carte conducteur, SST, sécurité : qui est qualifié, et jusqu'à quand"
        actions={
          <>
            <QualExport employees={tracked} types={types} quals={quals} />
            {canEdit && (
              <Button onClick={() => setEdit({ e: null, ty: null, q: null })}>
                <Plus className="h-4 w-4" /> Nouvelle qualification
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi index={0} label="Qualifications valides" value={n("valid")} tone="ok" icon={<CheckCircle2 className="h-5 w-5" />} sub={`${pct(n("valid") + n("soon"), cells.filter((c) => c.state !== "none").length)} % des détenues à jour`} />
        <Kpi index={1} label="À renouveler (60 j)" value={n("soon")} tone={n("soon") ? "warn" : "ok"} icon={<CalendarClock className="h-5 w-5" />} href={href("echeances")} />
        <Kpi index={2} label="Expirées" value={n("expired")} tone={n("expired") ? "bad" : "ok"} icon={<AlertTriangle className="h-5 w-5" />} href={href("echeances")} />
        <Kpi index={3} label="Obligatoires manquantes" value={n("missing")} tone={n("missing") ? "bad" : "ok"} icon={<AlertTriangle className="h-5 w-5" />} href={href("echeances")} />
      </div>
      <Tabs
        id="qual-tabs"
        active={tab}
        tabs={[
          { key: "tableau", label: "Tableau par équipe", href: href("tableau") },
          { key: "echeances", label: "Échéances et manques", href: href("echeances"), count: n("soon") + n("expired") + n("missing") },
          { key: "catalogue", label: "Catalogue", href: href("catalogue") },
        ]}
      />
      {tab === "tableau" && <Matrix employees={tracked} types={types} quals={quals} canEdit={canEdit} onCell={(e, ty, q) => setEdit({ e, ty, q })} />}
      {tab === "echeances" && <Deadlines cells={cells} canEdit={canEdit} onCell={(e, ty, q) => setEdit({ e, ty, q })} />}
      {tab === "catalogue" && <Catalogue types={types} quals={quals} canEdit={canEdit} />}
      {edit && <QualForm employees={tracked} types={types} quals={quals} init={edit} onClose={() => setEdit(null)} canEdit={canEdit} />}
    </>
  );
}

/* ---------- Tableau croisé : collaborateurs × qualifications, par équipe ---------- */
function Matrix({ employees, types, quals, canEdit, onCell }: { employees: Employee[]; types: QualificationType[]; quals: Qualification[]; canEdit: boolean; onCell: (e: Employee, ty: QualificationType, q: Qualification | null) => void }) {
  const t = iso(today());
  const [team, setTeam] = useState<Team | "all">("all");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "alert">("all");
  const teams = TEAM_ORDER.filter((g) => employees.some((e) => e.team === g) && (team === "all" || g === team));
  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {(["all", ...TEAM_ORDER.filter((g) => employees.some((e) => e.team === g))] as const).map((g) => (
            <button key={g} type="button" onClick={() => setTeam(g)} aria-pressed={team === g} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", team === g ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink")}>
              {g === "all" ? "Toutes" : TEAMS[g]}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="field h-9 min-h-0 w-auto pr-8 text-sm" aria-label="Catégorie">
          <option value="all">Toutes catégories</option>
          {Object.entries(QUAL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={only} onChange={(e) => setOnly(e.target.value as "all" | "alert")} className="field h-9 min-h-0 w-auto pr-8 text-sm" aria-label="Afficher">
          <option value="all">Tout le monde</option>
          <option value="alert">Seulement à traiter</option>
        </select>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom" className="field h-9 min-h-0 w-48 pl-8 text-sm" aria-label="Rechercher un collaborateur" />
        </label>
      </Card>
      {teams.map((g) => {
        const cols = types.filter((ty) => appliesTo(ty, g) && (cat === "all" || ty.category === cat));
        let rows = employees.filter((e) => e.team === g && e.name.toLowerCase().includes(q.trim().toLowerCase()));
        if (only === "alert") rows = rows.filter((e) => cols.some((ty) => ["soon", "expired", "missing"].includes(qualStatus(ty, e, quals, t).state)));
        if (!rows.length || !cols.length) return null;
        return (
          <Card key={g} className="overflow-hidden">
            <CardHeader title={TEAMS[g]} subtitle={`${plural(rows.length, "collaborateur")} · ${plural(cols.length, "qualification suivie", "qualifications suivies")}${canEdit ? " · cliquez sur une case pour saisir" : ""}`} />
            <div className="max-h-[70dvh] overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-30 min-w-[170px] border-b border-line bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold">Collaborateur</th>
                    {cols.map((ty) => (
                      <th key={ty.id} className="sticky top-0 z-20 min-w-[96px] border-b border-line bg-surface-2 px-1.5 py-2 text-center align-bottom text-[11px] leading-tight font-semibold" title={ty.name}>
                        <span className="line-clamp-3">{ty.name.replace(/\s*\(.*\)$/, "")}</span>
                        {ty.required && <span className="mt-0.5 block text-[10px] font-semibold text-bad">obligatoire</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-line/60">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                        <Link href={`/equipe/${e.id}`} className="flex items-center gap-2 font-semibold hover:text-brand">
                          <Avatar e={e} size={24} /> <span className="truncate">{e.name}</span>
                        </Link>
                      </td>
                      {cols.map((ty) => {
                        const s = qualStatus(ty, e, quals, t);
                        return (
                          <td key={ty.id} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => onCell(e, ty, s.last)}
                              title={`${ty.name} · ${QUAL_STATE[s.state].label}${s.expires ? ` · échéance ${fmtDate(s.expires)}` : ""}`}
                              className={cn("block w-full rounded-md px-1 py-1 text-[11px] leading-tight font-semibold transition-transform", STATE_CLS[s.state])}
                            >
                              {s.state === "none" ? (canEdit ? "+" : "—") : s.state === "missing" ? "Manque" : s.expires ? fmtShort(s.expires) : "Valide"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["valid", "soon", "expired", "missing"] as const).map((s) => (
          <span key={s} className={cn("rounded-md px-2 py-1 font-semibold", STATE_CLS[s])}>{QUAL_STATE[s].label}</span>
        ))}
        <span className="text-muted">La date affichée est l&apos;échéance.</span>
      </div>
    </div>
  );
}

/* ---------- Échéances : ce qui est expiré, bientôt échu ou manquant ---------- */
function Deadlines({ cells, canEdit, onCell }: { cells: ({ e: Employee; ty: QualificationType; state: QualState; last: Qualification | null; expires: string | null })[]; canEdit: boolean; onCell: (e: Employee, ty: QualificationType, q: Qualification | null) => void }) {
  const order: Record<QualState, number> = { expired: 0, missing: 1, soon: 2, valid: 3, none: 4 };
  const list = cells.filter((c) => c.state === "expired" || c.state === "soon" || c.state === "missing").sort((a, b) => order[a.state] - order[b.state] || (a.expires || "").localeCompare(b.expires || ""));
  if (!list.length)
    return (
      <Card>
        <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="Tout est à jour">Aucune qualification expirée, à renouveler dans les 60 jours ou obligatoire manquante.</Empty>
      </Card>
    );
  return (
    <Card className="divide-y divide-line/70">
      {list.map((c) => (
        <div key={c.e.id + c.ty.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Avatar e={c.e} size={34} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              <Link href={`/equipe/${c.e.id}`} className="hover:text-brand">{c.e.name}</Link>
              <span className="ml-2 text-xs font-normal text-muted">{TEAMS[c.e.team]}</span>
            </p>
            <p className="text-sm text-muted">{c.ty.name}</p>
          </div>
          <Badge tone={QUAL_STATE[c.state].tone}>
            {c.state === "missing" ? "Obligatoire, manquante" : c.state === "expired" ? `Expirée depuis le ${fmtDate(c.expires)}` : `Échéance ${fmtDate(c.expires)} (${-daysBetween(c.expires!)} j)`}
          </Badge>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onCell(c.e, c.ty, c.state === "missing" ? null : c.last)}>
              {c.state === "missing" ? "Saisir" : "Renouveler"}
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}

/* ---------- Catalogue des qualifications ---------- */
function Catalogue({ types, quals, canEdit }: { types: QualificationType[]; quals: Qualification[]; canEdit: boolean }) {
  const ed = useEditor<QualificationType>();
  return (
    <>
      <DataTable
        rows={types}
        table="qualification_types"
        exportName="catalogue-qualifications"
        onEdit={canEdit ? ed.edit : undefined}
        initialSort={{ key: "pos", dir: "asc" }}
        searchText={(r) => r.name}
        toolbar={canEdit ? <Button size="sm" onClick={ed.create}><Plus className="h-4 w-4" /> Ajouter au catalogue</Button> : undefined}
        columns={[
          { key: "pos", header: "#", sort: (r) => r.position, cell: (r) => <span className="text-muted">{r.position}</span>, hideOnMobile: true },
          { key: "name", header: "Qualification", sort: (r) => r.name, cell: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "cat", header: "Catégorie", sort: (r) => r.category, exportValue: (r) => QUAL_CATEGORIES[r.category].label, cell: (r) => <Badge tone={QUAL_CATEGORIES[r.category].tone}>{QUAL_CATEGORIES[r.category].label}</Badge> },
          { key: "val", header: "Validité", sort: (r) => r.validity_months ?? 999, exportValue: (r) => (r.validity_months ? `${r.validity_months} mois` : "Sans échéance"), cell: (r) => (r.validity_months ? (r.validity_months % 12 ? `${r.validity_months} mois` : `${plural(r.validity_months / 12, "an")}`) : "Sans échéance") },
          { key: "teams", header: "Pour", hideOnMobile: true, sort: (r) => (r.teams || []).join(","), exportValue: (r) => (r.teams?.length ? r.teams.map((x) => TEAMS[x]).join(", ") :"Tous"), cell: (r) => (r.teams?.length ? r.teams.map((x) => TEAMS[x]).join(", ") :"Tous") },
          { key: "req", header: "Obligatoire", sort: (r) => +r.required, exportValue: (r) => (r.required ? "Oui" : "Non"), cell: (r) => (r.required ? <Badge tone="bad">Obligatoire</Badge> : <span className="text-muted">Non</span>) },
          { key: "n", header: "Détenteurs", sort: (r) => quals.filter((q) => q.type_id === r.id).length, cell: (r) => new Set(quals.filter((q) => q.type_id === r.id).map((q) => q.employee_id)).size },
          { key: "act", header: "Suivi", sort: (r) => +r.active, exportValue: (r) => (r.active ? "Oui" : "Non"), cell: (r) => (r.active ? "Oui" : <span className="text-muted">Archivé</span>) },
        ]}
      />
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? "Modifier la qualification" : "Nouvelle qualification au catalogue"}
        table="qualification_types"
        id={ed.row?.id}
        initial={ed.row ? { ...ed.row, teams: ed.row.teams?.length ? ed.row.teams.join(",") : "all" } : { category: "caces", validity_months: 60, teams: "chauf,prep", required: false, active: true, position: types.length + 1 }}
        transform={(v) => ({ ...v, teams: v.teams === "all" ? null : v.teams })}
        fields={[
          { name: "name", label: "Nom", required: true, full: true, placeholder: "Ex. : CACES R489 cat. 3" },
          { name: "category", label: "Catégorie", type: "select", required: true, options: Object.entries(QUAL_CATEGORIES).map(([k, v]) => [k, v.label] as [string, string]) },
          { name: "validity_months", label: "Validité (mois, vide = sans échéance)", type: "number", placeholder: "60" },
          { name: "teams", label: "Pour qui", type: "select", required: true, options: TEAM_CHOICES },
          { name: "position", label: "Ordre d'affichage", type: "number" },
          { name: "required", label: "Obligatoire pour ces équipes", type: "checkbox" },
          { name: "active", label: "Suivie (décocher pour archiver)", type: "checkbox" },
        ]}
      />
    </>
  );
}

/* ---------- Saisie d'une qualification ---------- */
function QualForm({ employees, types, quals, init, onClose, canEdit }: { employees: Employee[]; types: QualificationType[]; quals: Qualification[]; init: { e: Employee | null; ty: QualificationType | null; q: Qualification | null }; onClose: () => void; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    employee_id: init.e?.id || "",
    type_id: init.ty?.id || "",
    obtained_on: init.q?.obtained_on || "",
    expires_on: init.q?.expires_on || "",
    provider: init.q?.provider || "",
    reference: init.q?.reference || "",
    note: init.q?.note || "",
  });
  const [renew, setRenew] = useState(false);
  const ty = types.find((x) => x.id === f.type_id);
  const auto = expiryOf({ obtained_on: f.obtained_on || null, expires_on: null }, ty);
  const history = quals.filter((q) => q.employee_id === f.employee_id && q.type_id === f.type_id).sort((a, b) => (b.obtained_on || "").localeCompare(a.obtained_on || ""));
  const editing = init.q && !renew ? init.q : null;
  const save = () =>
    start(async () => {
      if (!f.employee_id || !f.type_id) return void toast.error("Choisissez le collaborateur et la qualification.");
      const r = await saveRow("qualifications", editing?.id || null, { ...f, expires_on: f.expires_on || auto || "" });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Qualification mise à jour" : "Qualification enregistrée");
      router.refresh();
      onClose();
    });
  const remove = (id: string) =>
    start(async () => {
      const r = await trashRows("qualifications", [id]);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Qualification supprimée", { description: "Récupérable 30 jours dans la corbeille." });
      router.refresh();
      onClose();
    });
  const emp = employees.find((e) => e.id === f.employee_id);
  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? "Qualification" : init.q ? "Renouveler la qualification" : "Nouvelle qualification"}
      subtitle={emp ? `${emp.name} · ${TEAMS[emp.team]}` : "Choisissez un collaborateur"}
      footer={
        canEdit ? (
          <>
            {init.q && !renew && (
              <Button variant="outline" onClick={() => (setRenew(true), setF((o) => ({ ...o, obtained_on: iso(today()), expires_on: "", reference: "" })))}>
                Renouveler (nouvelle date)
              </Button>
            )}
            <Button onClick={save} loading={pending}>Enregistrer</Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Collaborateur
          <select className="field" value={f.employee_id} disabled={!!init.e || !canEdit} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
            <option value="">Choisir…</option>
            {TEAM_ORDER.map((g) => (
              <optgroup key={g} label={TEAMS[g]}>
                {employees.filter((e) => e.team === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Qualification
          <select className="field" value={f.type_id} disabled={!!init.ty || !canEdit} onChange={(e) => setF({ ...f, type_id: e.target.value })}>
            <option value="">Choisir…</option>
            {Object.entries(QUAL_CATEGORIES).map(([k, v]) => (
              <optgroup key={k} label={v.label}>
                {types.filter((x) => x.category === k && x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Obtenue le
          <input type="date" className="field" value={f.obtained_on} disabled={!canEdit} onChange={(e) => setF({ ...f, obtained_on: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Échéance
          <input type="date" className="field" value={f.expires_on} disabled={!canEdit} onChange={(e) => setF({ ...f, expires_on: e.target.value })} />
          <span className="text-xs font-normal text-muted">{f.expires_on ? "Saisie manuellement" : auto ? `Calculée : ${fmtDate(auto)}` : ty && !ty.validity_months ? "Sans échéance" : "Calculée à partir de la date d'obtention"}</span>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Organisme de formation
          <input className="field" value={f.provider} disabled={!canEdit} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="Ex. : AFTRAL, Promotrans" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          N° de certificat / de permis
          <input className="field" value={f.reference} disabled={!canEdit} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Note
          <textarea className="field min-h-[64px] py-2" value={f.note} disabled={!canEdit} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        {history.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-[13px] font-semibold">Historique</p>
            <ul className="grid gap-1 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-lg bg-surface-2/50 px-2.5 py-1.5">
                  <span className="flex-1">Obtenue le {fmtDate(h.obtained_on) || "?"} · échéance {fmtDate(expiryOf(h, ty)) || "aucune"}{h.provider ? ` · ${h.provider}` : ""}</span>
                  {canEdit && (
                    <button type="button" onClick={() => remove(h.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad" aria-label="Supprimer cette ligne">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ---------- Export Excel / CSV avec indicateurs ---------- */
function QualExport({ employees, types, quals }: { employees: Employee[]; types: QualificationType[]; quals: Qualification[] }) {
  const [open, setOpen] = useState(false);
  const go = async (kind: ExportKind) => {
    const t = iso(today());
    const cells = employees.flatMap((e) => types.filter((ty) => appliesTo(ty, e.team)).map((ty) => ({ e, ty, ...qualStatus(ty, e, quals, t) })));
    const n = (s: QualState, l = cells) => l.filter((c) => c.state === s).length;
    const k: Cell[][] = [
      ["Qualifications et formations"],
      ["Extraction du", fmtDate(t)],
      [],
      ["INDICATEURS", "Valeur"],
      ["Collaborateurs suivis", employees.length],
      ["Qualifications attendues (collaborateurs × qualifications)", cells.length],
      ["Valides", n("valid")],
      ["À renouveler dans les 60 jours", n("soon")],
      ["Expirées", n("expired")],
      ["Obligatoires manquantes", n("missing")],
      ["Taux de conformité des obligatoires (%)", pct(cells.filter((c) => c.ty.required && (c.state === "valid" || c.state === "soon")).length, cells.filter((c) => c.ty.required).length)],
      [],
      ["PAR ÉQUIPE"],
      ["Équipe", "Collaborateurs", "Valides", "À renouveler", "Expirées", "Obligatoires manquantes"],
      ...TEAM_ORDER.filter((g) => employees.some((e) => e.team === g)).map((g) => {
        const l = cells.filter((c) => c.e.team === g);
        return [TEAMS[g], employees.filter((e) => e.team === g).length, n("valid", l), n("soon", l), n("expired", l), n("missing", l)];
      }),
      [],
      ["PAR QUALIFICATION"],
      ["Qualification", "Obligatoire", "Détenteurs valides", "À renouveler", "Expirées", "Manquantes"],
      ...types.filter((ty) => ty.active).map((ty) => {
        const l = cells.filter((c) => c.ty.id === ty.id);
        return [ty.name, ty.required ? "Oui" : "Non", n("valid", l), n("soon", l), n("expired", l), n("missing", l)];
      }),
    ];
    const matrixTypes = types.filter((ty) => ty.active);
    const matrix: Cell[][] = [
      ["Collaborateur", "Équipe", ...matrixTypes.map((ty) => ty.name)],
      ...employees.map((e) => [
        e.name, TEAMS[e.team],
        ...matrixTypes.map((ty) => {
          if (!appliesTo(ty, e.team)) return "";
          const s = qualStatus(ty, e, quals, t);
          return s.state === "none" ? "" : s.state === "missing" ? "MANQUE" : s.expires ? `${QUAL_STATE[s.state].short} · ${fmtDate(s.expires)}` : "Valide";
        }),
      ]),
    ];
    const detail: Cell[][] = [
      ["Collaborateur", "Équipe", "Qualification", "Catégorie", "Obtenue le", "Échéance", "État", "Organisme", "N° de certificat", "Note"],
      ...quals.map((q) => {
        const e = employees.find((x) => x.id === q.employee_id), ty = types.find((x) => x.id === q.type_id);
        const exp = expiryOf(q, ty);
        const st: QualState = !exp ? "valid" : exp < t ? "expired" : daysBetween(exp) >= -60 ? "soon" : "valid";
        return [e?.name || "?", e ? TEAMS[e.team] : "", ty?.name || "?", ty ? QUAL_CATEGORIES[ty.category].label : "", fmtDate(q.obtained_on), fmtDate(exp), QUAL_STATE[st].label, q.provider, q.reference, q.note];
      }),
    ];
    const todo: Cell[][] = [
      ["Collaborateur", "Équipe", "Qualification", "État", "Échéance"],
      ...cells.filter((c) => c.state === "expired" || c.state === "soon" || c.state === "missing").map((c) => [c.e.name, TEAMS[c.e.team], c.ty.name, QUAL_STATE[c.state].label, fmtDate(c.expires)]),
    ];
    await downloadWorkbook("qualifications-formations", [
      { name: "Indicateurs", rows: k, widths: [52, 14, 18, 14, 12, 22] },
      { name: "Tableau", rows: matrix, freeze: 1 },
      { name: "À traiter", rows: todo, freeze: 1 },
      { name: "Détail", rows: detail, freeze: 1 },
    ], kind);
    toast.success("Export prêt", { description: "Le fichier est dans vos téléchargements." });
    setOpen(false);
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Exporter
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Exporter les qualifications" subtitle="Indicateurs, tableau par collaborateur, à traiter, détail">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => go("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</Button>
          <Button variant="outline" onClick={() => go("csv")}><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </Dialog>
    </>
  );
}
