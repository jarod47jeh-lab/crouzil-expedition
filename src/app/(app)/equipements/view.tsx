"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, HardHat, Plus, RotateCcw, Ruler, Signature } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePerms } from "@/components/app/perms-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { patchRows, saveRow } from "@/lib/actions/crud";
import { TEAM_ORDER, TEAMS } from "@/lib/domain/constants";
import { fmtDate, iso, today } from "@/lib/domain/dates";
import { applies, CATEGORIES, ISSUE_STATE, issueStatus, SIZE_KINDS, sizeOf } from "@/lib/domain/equipment";
import type { Employee, EquipmentIssue, EquipmentItem, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "tailles" | "dotations" | "commande" | "catalogue";
const TEAM_CHOICES: [string, string][] = [
  ["all", "Toutes les équipes"],
  ["chauf", "Chauffeurs"],
  ["prep", "Préparateurs"],
  ["chauf,prep", "Chauffeurs et préparateurs"],
  ["commande", "Service Commande"],
  ["bureau", "Bureau Direction"],
];

export function EquipmentView({ tab, team, employees, items, issues }: { tab: Tab; team: string; employees: Employee[]; items: EquipmentItem[]; issues: EquipmentIssue[] }) {
  const perms = usePerms();
  const canEdit = perms.write("equipe");
  const t = iso(today());
  const sized = employees.filter((e) => SIZE_KINDS.every((s) => e[s.col]));
  const toSign = issues.filter((i) => !i.signed && !i.returned_on).length;
  const renew = employees.reduce((n, e) => n + items.filter((it) => applies(it, e.team) && issueStatus(it, e.id, issues, t).state === "renew").length, 0);
  const href = (k: Tab, tm = team) => `/equipements?tab=${k}${k === "dotations" || k === "commande" ? `&team=${tm}` : ""}`;
  return (
    <>
      <PageHeader title="Tenues et équipements" icon={<HardHat className="h-6 w-6" />} subtitle="Tailles, dotations nominatives avec émargement, renouvellements et commande groupée" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi index={0} label="Tailles renseignées" value={sized.length} suffix={` / ${employees.length}`} tone={sized.length < employees.length ? "warn" : "ok"} icon={<Ruler className="h-5 w-5" />} href={href("tailles")} />
        <Kpi index={1} label="Articles au catalogue" value={items.filter((i) => i.active).length} icon={<HardHat className="h-5 w-5" />} href={href("catalogue")} />
        <Kpi index={2} label="Émargements à faire" value={toSign} tone={toSign ? "warn" : "ok"} icon={<Signature className="h-5 w-5" />} href={href("dotations")} />
        <Kpi index={3} label="À renouveler" value={renew} tone={renew ? "bad" : "ok"} icon={<RotateCcw className="h-5 w-5" />} href={href("dotations")} />
      </div>
      <Tabs
        id="eq-tabs"
        active={tab}
        tabs={[
          { key: "tailles", label: "Tailles", href: href("tailles"), count: employees.length - sized.length },
          { key: "dotations", label: "Dotations", href: href("dotations") },
          { key: "commande", label: "Commande groupée", href: href("commande") },
          { key: "catalogue", label: "Catalogue", href: href("catalogue") },
        ]}
      />
      {tab === "tailles" && <Sizes employees={employees} canEdit={canEdit} />}
      {tab === "dotations" && <Issues team={team as Team} employees={employees} items={items} issues={issues} canEdit={canEdit} />}
      {tab === "commande" && <Order team={team as Team} employees={employees} items={items} />}
      {tab === "catalogue" && <Catalogue items={items} canEdit={canEdit} />}
    </>
  );
}

function TeamChips({ team, base }: { team: string; base: string }) {
  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {TEAM_ORDER.map((k) => (
        <Link key={k} href={`${base}&team=${k}`} scroll={false} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", team === k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-muted hover:text-ink")}>
          {TEAMS[k]}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Tailles : saisie directe dans le tableau ---------- */
function Sizes({ employees, canEdit }: { employees: Employee[]; canEdit: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string | null>>({});
  const [, start] = useTransition();
  const set = (e: Employee, col: string, v: string) => {
    const key = e.id + col;
    setVals((o) => ({ ...o, [key]: v || null }));
    start(async () => {
      const r = await patchRows("employees", [e.id], { [col]: v || null });
      if (!r.ok) {
        setVals((o) => ({ ...o, [key]: (e as unknown as Record<string, string | null>)[col] }));
        return void toast.error(r.error);
      }
      toast.success(`Taille enregistrée pour ${e.name}`);
      router.refresh();
    });
  };
  const val = (e: Employee, col: string) => (e.id + col in vals ? vals[e.id + col] : (e as unknown as Record<string, string | null>)[col]);
  if (!employees.length) return <Card><Empty icon={<Ruler className="h-5 w-5" />} title="Aucun collaborateur">Ajoutez d&apos;abord l&apos;équipe dans Collaborateurs.</Empty></Card>;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Tailles de chaque collaborateur" subtitle={canEdit ? "Choisissez directement dans le tableau : c'est enregistré tout de suite." : "Consultation seule"} />
      <div className="overflow-x-auto [contain:paint]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/50 text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 font-semibold">Collaborateur</th>
              {SIZE_KINDS.map((s) => (
                <th key={s.k} className="px-3 py-2.5 font-semibold">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAM_ORDER.flatMap((g) => {
              const rows = employees.filter((e) => e.team === g);
              if (!rows.length) return [];
              return [
                <tr key={g}>
                  <td colSpan={5} className="sticky left-0 bg-surface px-4 pt-4 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{TEAMS[g]}</td>
                </tr>,
                ...rows.map((e) => (
                  <tr key={e.id} className="border-t border-line/70">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">
                      <Link href={`/equipe/${e.id}`} className="hover:text-brand">{e.name}</Link>
                    </td>
                    {SIZE_KINDS.map((s) => {
                      const v = val(e, s.col as string);
                      return (
                        <td key={s.k} className="px-3 py-1.5">
                          {canEdit ? (
                            <select
                              aria-label={`${s.label} de ${e.name}`}
                              value={v || ""}
                              onChange={(ev) => set(e, s.col as string, ev.target.value)}
                              className={cn("field h-9 min-h-0 w-[110px] pr-6 text-sm", !v && "border-dashed text-muted")}
                            >
                              <option value="">À renseigner</option>
                              {s.options.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={v ? "font-semibold" : "text-muted"}>{v || "—"}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Dotations : qui a quoi ---------- */
function Issues({ team, employees, items, issues, canEdit }: { team: Team; employees: Employee[]; items: EquipmentItem[]; issues: EquipmentIssue[]; canEdit: boolean }) {
  const t = iso(today());
  const rows = employees.filter((e) => e.team === team);
  const cols = items.filter((it) => applies(it, team));
  const [cell, setCell] = useState<{ e: Employee; it: EquipmentItem } | null>(null);
  return (
    <>
      <TeamChips team={team} base="/equipements?tab=dotations" />
      {!rows.length || !cols.length ? (
        <Card>
          <Empty icon={<HardHat className="h-5 w-5" />} title={!rows.length ? "Personne dans cette équipe" : "Aucun article pour cette équipe"}>
            {!rows.length ? "Ajoutez des collaborateurs à cette équipe." : "Ajoutez des articles dans l'onglet Catalogue."}
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-left text-[11px] tracking-wide text-muted uppercase">
                  <th className="sticky left-0 z-10 min-w-[150px] bg-surface-2 px-4 py-2.5 font-semibold">Collaborateur</th>
                  {cols.map((it) => (
                    <th key={it.id} className="min-w-[96px] px-2 py-2.5 align-bottom font-semibold">
                      <span className="block leading-tight normal-case">{it.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-line/70">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">{e.name}</td>
                    {cols.map((it) => {
                      const st = issueStatus(it, e.id, issues, t);
                      const s = ISSUE_STATE[st.state];
                      return (
                        <td key={it.id} className="px-2 py-1.5">
                          <button
                            onClick={() => setCell({ e, it })}
                            className={cn(
                              "w-full rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition-colors hover:border-brand/50",
                              st.state === "ok" && "border-ok/30 bg-ok/8 text-ok",
                              st.state === "unsigned" && "border-warn/40 bg-warn/10 text-warn",
                              st.state === "renew" && "border-bad/40 bg-bad/8 text-bad",
                              (st.state === "none" || st.state === "returned") && "border-dashed border-line text-muted",
                            )}
                            aria-label={`${it.name} pour ${e.name} : ${s.label}`}
                          >
                            {s.short}
                            {st.last && !st.last.returned_on && <span className="block font-normal opacity-80">{st.last.size || fmtDate(st.last.issued_on)}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line px-4 py-3 text-xs text-muted">
            {(["ok", "unsigned", "renew", "none"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <Badge tone={ISSUE_STATE[k].tone}>{ISSUE_STATE[k].short}</Badge> {ISSUE_STATE[k].label}
              </span>
            ))}
          </div>
        </Card>
      )}
      <IssueDialog cell={cell} issues={issues} canEdit={canEdit} onClose={() => setCell(null)} />
    </>
  );
}

function IssueDialog({ cell, issues, canEdit, onClose }: { cell: { e: Employee; it: EquipmentItem } | null; issues: EquipmentIssue[]; canEdit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ issued_on: "", size: "", qty: "1", signed: true, note: "" });
  const [openFor, setOpenFor] = useState<string | null>(null);
  const key = cell ? cell.e.id + cell.it.id : null;
  if (cell && openFor !== key) {
    setOpenFor(key);
    setForm({ issued_on: iso(today()), size: sizeOf(cell.e, cell.it.sized) || "", qty: String(cell.it.qty_per_person || 1), signed: true, note: "" });
  }
  if (!cell) return null;
  const hist = issues.filter((i) => i.employee_id === cell.e.id && i.item_id === cell.it.id).sort((a, b) => b.issued_on.localeCompare(a.issued_on));
  const sk = SIZE_KINDS.find((s) => s.k === cell.it.sized);
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, msg: string, close = false) =>
    start(async () => {
      const r = await f();
      if (!r.ok) return void toast.error(r.error || "Erreur");
      toast.success(msg);
      router.refresh();
      if (close) {
        setOpenFor(null);
        onClose();
      }
    });
  return (
    <Dialog
      open
      onClose={() => {
        setOpenFor(null);
        onClose();
      }}
      title={cell.it.name}
      subtitle={`${cell.e.name} · ${TEAMS[cell.e.team]}${cell.it.norm ? " · " + cell.it.norm : ""}`}
      footer={
        canEdit && (
          <Button
            loading={pending}
            onClick={() =>
              run(() => saveRow("equipment_issues", null, { employee_id: cell.e.id, item_id: cell.it.id, issued_on: form.issued_on, size: form.size || null, qty: form.qty, signed: form.signed, note: form.note }), `${cell.it.name} remis à ${cell.e.name}`, true)
            }
          >
            <Plus className="h-4 w-4" /> Enregistrer la remise
          </Button>
        )
      }
    >
      {hist.length > 0 && (
        <div className="mb-4 grid gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Historique</p>
          {hist.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5 text-sm">
              <span className="font-semibold">{fmtDate(h.issued_on)}</span>
              {h.size && <Badge tone="muted">Taille {h.size}</Badge>}
              <span className="text-muted">× {h.qty}</span>
              {h.returned_on ? <Badge tone="muted">Restitué le {fmtDate(h.returned_on)}</Badge> : h.signed ? <Badge tone="ok">Émargé</Badge> : <Badge tone="warn">À émarger</Badge>}
              {canEdit && !h.returned_on && (
                <span className="ml-auto flex gap-1.5">
                  {!h.signed && (
                    <Button size="sm" variant="outline" onClick={() => run(() => patchRows("equipment_issues", [h.id], { signed: true }), "Émargement noté")}>
                      <Check className="h-3.5 w-3.5" /> Émargé
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => run(() => patchRows("equipment_issues", [h.id], { returned_on: iso(today()) }), "Restitution notée")}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restitué
                  </Button>
                </span>
              )}
              {h.note && <p className="basis-full text-xs text-muted">{h.note}</p>}
            </div>
          ))}
        </div>
      )}
      {canEdit ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase sm:col-span-2">Nouvelle remise</p>
          <Field label="Date de remise">
            <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
          </Field>
          <Field label="Quantité">
            <Input type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          {sk && (
            <Field label={`Taille (${sk.label.toLowerCase()})`} hint={sizeOf(cell.e, cell.it.sized) ? "Reprise de la fiche du collaborateur" : "Taille non renseignée sur la fiche"}>
              <Select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} options={sk.options} placeholder="—" />
            </Field>
          )}
          <div className="flex items-end pb-2">
            <Switch checked={form.signed} onChange={(v) => setForm({ ...form, signed: v })} label="Émargé à la remise" />
          </div>
          <Field label="Note (facultatif)" full>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex. : remplace une paire usée" />
          </Field>
        </div>
      ) : (
        !hist.length && <p className="text-sm text-muted">Pas encore remis.</p>
      )}
    </Dialog>
  );
}

/* ---------- Commande groupée par taille ---------- */
function Order({ team, employees, items }: { team: Team; employees: Employee[]; items: EquipmentItem[] }) {
  const people = employees.filter((e) => e.team === team);
  const rows = useMemo(
    () =>
      items
        .filter((it) => applies(it, team))
        .map((it) => {
          const by = new Map<string, number>();
          let missing = 0;
          people.forEach((e) => {
            const s = it.sized ? sizeOf(e, it.sized) : "Taille unique";
            if (!s) missing++;
            else by.set(s, (by.get(s) || 0) + it.qty_per_person);
          });
          const sk = SIZE_KINDS.find((s) => s.k === it.sized);
          const sizes = [...by.entries()].sort((a, b) => (sk ? sk.options.indexOf(a[0]) - sk.options.indexOf(b[0]) : 0));
          return { it, sizes, missing, total: it.qty_per_person * people.length };
        }),
    [items, people, team],
  );
  const total = rows.reduce((n, r) => n + r.total, 0);
  const csv = () => {
    const lines = [["Article", "Norme", "Qté par personne", "Total", "Répartition par taille", "Tailles manquantes"]];
    rows.forEach((r) => lines.push([r.it.name, r.it.norm || "", String(r.it.qty_per_person), String(r.total), r.sizes.map(([s, n]) => `${s} × ${n}`).join(" ; "), String(r.missing)]));
    const blob = new Blob(["﻿" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commande-${team}-${iso(today())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <TeamChips team={team} base="/equipements?tab=commande" />
      <Card className="overflow-hidden">
        <CardHeader
          title={`Commande groupée · ${TEAMS[team]}`}
          subtitle={`${people.length} personne(s) · ${total} article(s) au total`}
          actions={
            <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5" /> Excel / CSV
            </Button>
          }
        />
        {rows.length ? (
          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2/50 text-left text-[11px] tracking-wide text-muted uppercase">
                  <th className="px-4 py-2.5 font-semibold">Article</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Par pers.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-3 py-2.5 font-semibold">Par taille</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.it.id} className="border-t border-line/70 align-top">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{r.it.name}</span>
                      {r.it.norm && <span className="block text-xs text-muted">{r.it.norm}</span>}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{r.it.qty_per_person}</td>
                    <td className="tabular px-3 py-2.5 text-right font-bold">{r.total}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.sizes.map(([s, n]) => (
                          <Badge key={s} tone="info">{s} × {n}</Badge>
                        ))}
                        {r.missing > 0 && <Badge tone="warn">{r.missing} taille(s) manquante(s)</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink/80 font-bold">
                  <td className="px-4 py-2.5">Total des articles</td>
                  <td />
                  <td className="tabular px-3 py-2.5 text-right">{total}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Aucun article pour cette équipe" />
        )}
      </Card>
    </>
  );
}

/* ---------- Catalogue ---------- */
function Catalogue({ items, canEdit }: { items: EquipmentItem[]; canEdit: boolean }) {
  const ed = useEditor<EquipmentItem>();
  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Nouvel article
          </Button>
        </div>
      )}
      <DataTable
        rows={items}
        table="equipment_items"
        exportName="catalogue-equipements"
        onEdit={ed.edit}
        searchText={(i) => `${i.name} ${i.norm || ""}`}
        initialSort={{ key: "pos", dir: "asc" }}
        filters={[{ key: "cat", label: "Catégorie", options: Object.entries(CATEGORIES).map(([k, v]) => [k, v.label]), value: (i) => i.category }]}
        columns={[
          { key: "pos", header: "Article", sort: (i) => i.position, exportValue: (i) => i.name, cell: (i) => <span><b>{i.name}</b>{i.norm && <span className="block text-xs text-muted">{i.norm}</span>}</span> },
          { key: "cat", header: "Catégorie", sort: (i) => i.category, exportValue: (i) => CATEGORIES[i.category].label, cell: (i) => <Badge tone={CATEGORIES[i.category].tone}>{CATEGORIES[i.category].label}</Badge> },
          { key: "qty", header: "Par pers.", sort: (i) => i.qty_per_person, cell: (i) => <span className="tabular">{i.qty_per_person}</span> },
          { key: "size", header: "Taille", hideOnMobile: true, sort: (i) => i.sized || "", exportValue: (i) => SIZE_KINDS.find((s) => s.k === i.sized)?.label || "Unique", cell: (i) => SIZE_KINDS.find((s) => s.k === i.sized)?.label || <span className="text-muted">Unique</span> },
          { key: "ren", header: "Renouvellement", hideOnMobile: true, sort: (i) => i.renewal_months || 999, exportValue: (i) => (i.renewal_months ? `${i.renewal_months} mois` : ""), cell: (i) => (i.renewal_months ? `${i.renewal_months} mois` : <span className="text-muted">—</span>) },
          { key: "teams", header: "Pour", hideOnMobile: true, sort: (i) => (i.teams || []).join(","), exportValue: (i) => (i.teams?.length ? i.teams.map((x) => TEAMS[x]).join(", ") : "Tous"), cell: (i) => (i.teams?.length ? i.teams.map((x) => TEAMS[x]).join(", ") : "Tous") },
        ]}
      />
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? "Modifier l'article" : "Nouvel article"}
        table="equipment_items"
        id={ed.row?.id}
        initial={ed.row ? { ...ed.row, teams: ed.row.teams?.length ? ed.row.teams.join(",") : "all", sized: ed.row.sized || "none" } : { category: "tenue", qty_per_person: 1, teams: "chauf", sized: "none", active: true, position: items.length + 1 }}
        transform={(v) => ({ ...v, sized: v.sized === "none" ? null : v.sized, teams: v.teams === "all" ? null : v.teams })}
        fields={[
          { name: "name", label: "Article", required: true, full: true, placeholder: "Ex. : Veste de pluie" },
          { name: "category", label: "Catégorie", type: "select", required: true, options: Object.entries(CATEGORIES).map(([k, v]) => [k, v.label]) },
          { name: "teams", label: "Pour qui", type: "select", required: true, options: TEAM_CHOICES },
          { name: "norm", label: "Norme ou détail", full: true, placeholder: "Ex. : EN ISO 20471, classe 2" },
          { name: "sized", label: "Taille utilisée", type: "select", required: true, options: [["none", "Taille unique"], ...SIZE_KINDS.map((s) => [s.k, s.label] as [string, string])] },
          { name: "qty_per_person", label: "Quantité par personne", type: "number" },
          { name: "renewal_months", label: "Renouveler tous les (mois)", type: "number", hint: "Vide si pas de renouvellement" },
          { name: "position", label: "Ordre d'affichage", type: "number" },
          { name: "active", label: "Article en service", type: "checkbox" },
        ]}
      />
    </>
  );
}
