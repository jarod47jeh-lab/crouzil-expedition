"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarCheck2, CalendarClock, Gauge as GaugeIcon, Megaphone, PackageX, Pencil, Plus, Siren, Trash2, UserX, Wrench } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bars } from "@/components/charts/charts";
import { AuditItem } from "@/components/app/history";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { restoreRow, trashRows } from "@/lib/actions/crud";
import { ANNOUNCEMENT_KINDS, LEAVE_COLOR, LEAVE_LABEL, REPAIR_OPEN } from "@/lib/domain/constants";
import { absencesOn } from "@/lib/domain/conges";
import { addDays, daysBetween, fmtDay, fmtLong, fmtShort, iso, isWorkDay, nextWorkDay, prevWorkDay, today, weekStart } from "@/lib/domain/dates";
import { conformity } from "@/lib/domain/errors";
import { sortRepairs } from "@/lib/domain/repairs";
import type { DeliveryNote, Announcement, Asset, AuditEntry, DayMark, DeliveryError, Employee, FreelanceCall, LeaveRequest, Repair, Settings } from "@/lib/types";
import { nf, pct } from "@/lib/utils";
import { RepairCard } from "./reparations/view";
import { nextDue } from "./parc/fields";
import { NoteCard } from "./remontees/note-card";
import { forDashboard } from "@/lib/domain/notes";

interface Props {
  name: string;
  employees: Employee[];
  leaves: LeaveRequest[];
  pendingCount: number;
  marks: DayMark[];
  calls: FreelanceCall[];
  repairs: Repair[];
  errors: DeliveryError[];
  volumes: Record<string, number>;
  settings: Settings;
  announcements: Announcement[];
  assets: Asset[];
  audit: AuditEntry[];
  notes: DeliveryNote[];
}

export function HomeView(p: Props) {
  const router = useRouter();
  const perms = usePerms();
  const ann = useEditor<Announcement>();
  const t = today();
  const wd = isWorkDay(t) ? t : nextWorkDay(t);
  const yd = prevWorkDay(t);
  const fixed = p.employees.filter((e) => !e.freelance);
  const absToday = absencesOn(wd, p.leaves, p.marks).filter((a) => fixed.some((e) => e.id === a.employee_id));
  const name = (id: string) => p.employees.find((e) => e.id === id)?.name || "?";
  const open = p.repairs.filter((r) => REPAIR_OPEN.includes(r.status)).sort(sortRepairs);
  const crit = open.filter((r) => r.immobilized || r.urgency === "Bloquant");
  const month = iso(t).slice(0, 7);
  const confM = conformity(p.errors, p.volumes, (d) => d.startsWith(month));
  const target = Number(p.settings.conformity_target);
  const errYd = p.errors.filter((e) => e.date === iso(yd));

  const forecast = useMemo(() => {
    const out: Record<string, string | number>[] = [];
    let d = wd;
    for (let i = 0; i < 10; i++) {
      const a = absencesOn(d, p.leaves, p.marks, true).filter((x) => fixed.some((e) => e.id === x.employee_id));
      out.push({ d: fmtDay(d), Validées: a.filter((x) => !x.pending).length, "En attente": a.filter((x) => x.pending).length });
      d = nextWorkDay(d);
    }
    return out;
  }, [wd, p.leaves, p.marks, fixed]);

  const weekly = useMemo(() => {
    const out: Record<string, string | number>[] = [];
    const w0 = weekStart(t);
    for (let i = 7; i >= 0; i--) {
      const s = addDays(w0, -7 * i), e = addDays(s, 6);
      out.push({ w: fmtShort(iso(s)), n: p.errors.filter((x) => x.date >= iso(s) && x.date <= iso(e)).length });
    }
    return out;
  }, [p.errors, t]);

  const due = p.assets
    .map((a) => ({ a, n: nextDue(a) }))
    .filter((x) => x.n && -daysBetween(x.n.d) <= 30)
    .sort((x, y) => x.n!.d.localeCompare(y.n!.d));
  const announcements = p.announcements.filter((a) => !a.expires_on || a.expires_on >= iso(t)).sort((a, b) => ["prio", "attn", "new", "info"].indexOf(a.kind) - ["prio", "attn", "new", "info"].indexOf(b.kind));
  const free = p.employees.filter((e) => e.freelance);

  const removeAnn = async (a: Announcement) => {
    const r = await trashRows("announcements", [a.id]);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Message retiré", { action: { label: "Annuler", onClick: async () => { await restoreRow("announcements", a.id); router.refresh(); } } });
    router.refresh();
  };

  const hour = new Date().getHours();
  const dash = forDashboard(p.notes);
  const notesTodo = p.notes.filter((n) => n.status === "todo").length;
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mb-7">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">
          {hour < 18 ? "Bonjour" : "Bonsoir"}
          {p.name && `, ${p.name}`}
        </h1>
        <p className="mt-1 text-muted">{fmtLong(new Date())}</p>
      </motion.div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        {perms.read("remontees") && <Kpi index={0} href="/remontees" label="Remontées livraison" value={notesTodo} icon={<Megaphone className="h-5 w-5" />} tone={notesTodo ? "warn" : "ok"} sub={notesTodo ? "à traiter" : "rien à traiter"} />}
        {perms.read("conges") && <Kpi index={0} href="/conges" label={wd.getTime() === t.getTime() ? "Absents aujourd'hui" : `Absents ${fmtDay(wd)}`} value={absToday.length} icon={<UserX className="h-5 w-5" />} tone={absToday.length > p.settings.max_abs ? "bad" : "info"} sub={`sur ${fixed.length} collaborateurs`} />}
        {perms.read("conges") && <Kpi index={1} href="/conges?tab=demandes" label="Congés à valider" value={p.pendingCount} icon={<CalendarCheck2 className="h-5 w-5" />} tone={p.pendingCount ? "warn" : "ok"} sub={p.pendingCount ? "demandes en attente" : "rien en attente"} />}
        {perms.read("reparations") && <Kpi index={2} href="/reparations" label="Réparations ouvertes" value={open.length} icon={<Wrench className="h-5 w-5" />} tone="brand" sub={crit.length ? <span className="font-semibold text-bad">{crit.length} bloquante(s) ou immobilisée(s)</span> : "aucune bloquante"} />}
        {perms.read("erreurs") && <Kpi index={3} href="/erreurs" label="Conformité du mois" value={confM ? confM.global : null} decimals={2} suffix=" %" icon={<GaugeIcon className="h-5 w-5" />} tone={confM ? (confM.global >= target ? "ok" : "bad") : "ink"} sub={confM ? `objectif ${nf(target)} %` : "volumes non saisis"} />}
        {perms.read("erreurs") && <Kpi index={4} href="/erreurs?tab=list" label="Erreurs hier" value={errYd.length} icon={<PackageX className="h-5 w-5" />} tone={errYd.length ? "warn" : "ok"} sub={fmtDay(yd)} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 content-start gap-6">
          {perms.read("remontees") && (
            <Card className={dash.length ? "border-warn/40" : ""}>
              <CardHeader
                title="Livraisons : points d'attention"
                subtitle="Remontées pour aujourd'hui, demain, échues et consignes permanentes"
                actions={<Link href="/remontees" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Tout voir <ArrowRight className="h-4 w-4" /></Link>}
              />
              {dash.length ? (
                <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
                  {dash.slice(0, 6).map((n, i) => (
                    <NoteCard key={n.id} n={n} i={i} compact />
                  ))}
                  {dash.length > 6 && (
                    <Link href="/remontees" className="grid place-items-center rounded-2xl border border-dashed border-line p-4 text-sm font-semibold text-muted hover:text-brand">
                      + {dash.length - 6} autre(s)
                    </Link>
                  )}
                </div>
              ) : (
                <Empty icon={<Megaphone className="h-5 w-5" />} title="Rien de particulier pour les prochaines livraisons" />
              )}
            </Card>
          )}
          <Card>
            <CardHeader
              title="À la une"
              subtitle="Priorités et informations pour l'équipe"
              actions={
                <CanWrite module="any">
                  <Button size="sm" onClick={ann.create}>
                    <Plus className="h-3.5 w-3.5" /> Ajouter
                  </Button>
                </CanWrite>
              }
            />
            {announcements.length ? (
              <ul className="grid gap-2 px-5 pb-5">
                {announcements.map((a, i) => {
                  const k = ANNOUNCEMENT_KINDS[a.kind];
                  return (
                    <motion.li key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="group flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                      <Badge tone={k.tone}>{k.label}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px]">{a.body}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {a.tool || "Général"} · {fmtShort(a.created_at.slice(0, 10))}
                          {a.expires_on && ` · jusqu'au ${fmtShort(a.expires_on)}`}
                        </p>
                      </div>
                      {perms.write("any") && <div className="flex gap-0.5 opacity-50 group-hover:opacity-100">
                        <button onClick={() => ann.edit(a)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface" aria-label="Modifier">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeAnn(a)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface hover:text-bad" aria-label="Retirer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>}
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <Empty icon={<Megaphone className="h-5 w-5" />} title="Aucun message">Publiez une priorité ou une information pour l&apos;équipe.</Empty>
            )}
          </Card>

          {perms.read("reparations") && <Card>
            <CardHeader title="Réparations en cours" subtitle={`${open.length} non clôturée(s)`} actions={<Link href="/reparations?tab=list" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Tout voir <ArrowRight className="h-4 w-4" /></Link>} />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {open.length ? open.slice(0, 6).map((r, i) => <RepairCard key={r.id} r={r} i={i} />) : <Empty title="Aucune réparation en cours" />}
            </div>
          </Card>}

          <div className="grid gap-6 lg:grid-cols-2">
            {perms.read("conges") && <Card>
              <CardHeader title="Absences à venir" subtitle="10 prochains jours ouvrés" />
              <div className="px-3 pb-4">
                <Bars
                  data={forecast}
                  x="d"
                  stacked
                  height={220}
                  refLine={{ y: p.settings.max_abs, label: `seuil ${p.settings.max_abs}` }}
                  series={[
                    { key: "Validées", label: "Validées", color: "var(--info)" },
                    { key: "En attente", label: "En attente", color: "var(--warn)" },
                  ]}
                />
              </div>
            </Card>}
            {perms.read("erreurs") && <Card>
              <CardHeader title="Erreurs de livraison" subtitle="8 dernières semaines" />
              <div className="px-3 pb-4">
                <Bars data={weekly} x="w" height={220} series={[{ key: "n", label: "Erreurs", color: "var(--brand)" }]} />
              </div>
            </Card>}
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          {perms.read("conges") && <Card>
            <CardHeader title="Effectif du jour" subtitle={wd.getTime() === t.getTime() ? "Aujourd'hui" : fmtDay(wd)} actions={<Link href="/conges" className="text-sm font-semibold text-brand">Détail</Link>} />
            <div className="grid gap-3 px-5 pb-5">
              {absToday.length ? (
                <ul className="grid gap-1.5">
                  {absToday.map((a) => (
                    <li key={a.employee_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{name(a.employee_id)}</span>
                      <ColorBadge color={LEAVE_COLOR[a.type]}>{LEAVE_LABEL[a.type]}</ColorBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ok">Tout le monde est là.</p>
              )}
              {free.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-muted uppercase">Freelances</p>
                  {free.map((e) => {
                    const on = p.calls.some((c) => c.employee_id === e.id && c.date === iso(wd) && c.triggered);
                    return (
                      <p key={e.id} className="flex items-center justify-between text-sm">
                        {e.name} <Badge tone={on ? "ok" : "muted"}>{on ? "Déclenché" : "Pas déclenché"}</Badge>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>}

          {perms.read("reparations") && (due.length > 0 || crit.length > 0) && (
            <Card className="border-warn/40">
              <CardHeader title="Points d'attention" />
              <ul className="grid gap-2 px-5 pb-5 text-sm">
                {crit.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reparations/${r.id}`} className="flex items-center gap-2 hover:text-brand">
                      <Siren className="h-4 w-4 shrink-0 text-bad" />
                      <span className="flex-1">{r.label}</span>
                      <Badge tone="bad">{r.immobilized ? "Immobilisé" : "Bloquant"}</Badge>
                    </Link>
                  </li>
                ))}
                {due.map(({ a, n }) => (
                  <li key={a.id}>
                    <Link href={`/parc/${a.id}`} className="flex items-center gap-2 hover:text-brand">
                      <CalendarClock className="h-4 w-4 shrink-0 text-warn" />
                      <span className="flex-1">
                        {a.name} : {n!.k.toLowerCase()}
                      </span>
                      <Badge tone={daysBetween(n!.d) > 0 ? "bad" : "warn"}>{fmtShort(n!.d)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {confM && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-muted">Conformité du mois</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Global", confM.global], ["Prépa.", confM.prep], ["Livraison", confM.liv]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-surface-2 p-2">
                    <p className={`font-display text-lg font-bold ${(v as number) >= target ? "text-ok" : "text-bad"}`}>{pct(v as number, 2)}</p>
                    <p className="text-xs text-muted">{l}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Activité récente" actions={perms.admin ? <Link href="/historique" className="text-sm font-semibold text-brand">Historique</Link> : undefined} />
            {p.audit.length ? (
              <ul className="grid gap-4 border-l border-line px-5 pb-5 [margin-left:calc(1.25rem+4px)]">
                {p.audit.slice(0, 8).map((e) => (
                  <AuditItem key={e.id} e={e} showTable />
                ))}
              </ul>
            ) : (
              <Empty title="Aucune activité" />
            )}
          </Card>
        </div>
      </div>

      <EntityForm
        open={ann.open}
        onClose={ann.close}
        title={ann.row ? "Modifier le message" : "Nouveau message à la une"}
        table="announcements"
        id={ann.row?.id}
        initial={ann.row ? { ...ann.row } : { kind: "prio", tool: "", body: "" }}
        fields={[
          { name: "kind", label: "Type", type: "select", required: true, options: Object.entries(ANNOUNCEMENT_KINDS).map(([k, v]) => [k, v.label]) },
          { name: "tool", label: "Concerne", type: "select", options: ["Livraison", "Récupération", "Présences et congés", "Réparations", "Erreurs de livraison", "Journal de bord"] },
          { name: "body", label: "Message", type: "textarea", required: true },
          { name: "expires_on", label: "Afficher jusqu'au (facultatif)", type: "date" },
        ]}
      />
    </>
  );
}
