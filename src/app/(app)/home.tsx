"use client";
import { Avatar } from "@/components/ui/avatar";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarCheck2, CalendarClock, ListTodo, Megaphone, Pencil, Plus, Siren, Trash2, Wrench } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bars } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { CountUp } from "@/components/ui/kpi";
import { DepotTiles } from "@/components/depot/overview";
import { DepotHero } from "@/components/depot/hero";
import { buildStaff, buildVehicles, noteLine, type DepotSummary } from "@/components/depot/summary";
import { minimalSummary } from "@/components/depot/summary-empty";
import { restoreRow, trashRows } from "@/lib/actions/crud";
import { ANNOUNCEMENT_KINDS, LEAVE_LABEL, REPAIR_OPEN, TEAM_ORDER, TEAMS } from "@/lib/domain/constants";
import { absencesOn } from "@/lib/domain/conges";
import { addDays, daysBetween, fmtDay, fmtLong, fmtShort, iso, isWorkDay, nextWorkDay, prevWorkDay, today, weekStart } from "@/lib/domain/dates";
import { conformity } from "@/lib/domain/errors";
import { forDashboard } from "@/lib/domain/notes";
import type { DeliveryNote, Announcement, Asset, AuditEntry, DayMark, DeliveryError, Employee, FreelanceCall, LeaveRequest, Repair, Settings, Task } from "@/lib/types";
import { cn, nf } from "@/lib/utils";
import { nextDue } from "./parc/fields";
import { NoteCard } from "./remontees/note-card";

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
  tasks: Task[];
}

type Todo = { key: string; icon: typeof Siren; tone: "bad" | "warn" | "info"; tag: string; title: string; sub: string; href: string; cta: string };

export function HomeView(p: Props) {
  const router = useRouter();
  const perms = usePerms();
  const ann = useEditor<Announcement>();
  const t = today();
  const ti = iso(t);
  const wd = isWorkDay(t) ? t : nextWorkDay(t);
  const yd = prevWorkDay(t);
  const fixed = p.employees.filter((e) => !e.freelance);
  const absToday = absencesOn(wd, p.leaves, p.marks).filter((a) => fixed.some((e) => e.id === a.employee_id));
  const absent = new Set(absToday.map((a) => a.employee_id));
  const name = (id: string) => p.employees.find((e) => e.id === id)?.name || "?";
  const open = p.repairs.filter((r) => REPAIR_OPEN.includes(r.status));
  const crit = open.filter((r) => r.immobilized || r.urgency === "Bloquant");
  const month = ti.slice(0, 7);
  const confM = conformity(p.errors, p.volumes, (d) => d.startsWith(month));
  const target = Number(p.settings.conformity_target);
  const errYd = p.errors.filter((e) => e.date === iso(yd));
  const dash = forDashboard(p.notes);
  const notesTodo = p.notes.filter((n) => n.status === "todo").length;
  const openTasks = p.tasks.filter((x) => !x.done);
  const lateTasks = openTasks.filter((x) => x.due_date && x.due_date <= ti);
  const pending = p.leaves.filter((l) => l.status === "pending" && !l.deleted_at);
  const vehicles = useMemo(() => buildVehicles(p.assets, p.repairs, ti), [p.assets, p.repairs, ti]);
  const vDown = vehicles.filter((v) => v.state === "bad").length;

  const teams = TEAM_ORDER.map((g) => {
    const all = fixed.filter((e) => e.team === g);
    return { key: g, label: TEAMS[g], present: all.filter((e) => !absent.has(e.id)).length, total: all.length, out: all.filter((e) => absent.has(e.id)) };
  }).filter((x) => x.total);

  /* À traiter ce matin : tout ce qui attend une décision, tous espaces confondus */
  const todos: Todo[] = [];
  if (perms.read("reparations"))
    crit.forEach((r) => todos.push({ key: "r" + r.id, icon: Wrench, tone: "bad", tag: r.immobilized ? "Immobilisé" : "Bloquant", title: r.label, sub: r.description || "Réparation en cours", href: `/reparations/${r.id}`, cta: "Voir" }));
  if (perms.read("remontees"))
    dash
      .filter((n) => n.status === "todo")
      .forEach((n) => todos.push({ key: "n" + n.id, icon: Megaphone, tone: n.level === "attention" ? "bad" : "warn", tag: n.level === "attention" ? "Attention" : "Livraison", title: `${n.client_name ? n.client_name + " : " : ""}${n.body}`, sub: [n.route, n.due_date ? fmtShort(n.due_date) : n.permanent ? "Consigne permanente" : ""].filter(Boolean).join(" · "), href: "/remontees", cta: "Traiter" }));
  if (perms.read("conges"))
    pending.forEach((l) => todos.push({ key: "l" + l.id, icon: CalendarCheck2, tone: "warn", tag: "Congé", title: `${LEAVE_LABEL[l.type]} de ${name(l.employee_id)}`, sub: `du ${fmtShort(l.start_date)} au ${fmtShort(l.end_date)}`, href: "/conges?tab=demandes", cta: "Décider" }));
  if (perms.read("taches"))
    lateTasks.forEach((x) => todos.push({ key: "t" + x.id, icon: ListTodo, tone: x.due_date! < ti ? "bad" : "warn", tag: x.due_date! < ti ? "En retard" : "Aujourd'hui", title: x.title, sub: x.section, href: "/taches", cta: "Ouvrir" }));
  if (perms.read("parc"))
    p.assets
      .map((a) => ({ a, n: nextDue(a) }))
      .filter((x) => x.n && -daysBetween(x.n.d) <= 21)
      .forEach(({ a, n }) => todos.push({ key: "a" + a.id, icon: CalendarClock, tone: daysBetween(n!.d) > 0 ? "bad" : "info", tag: n!.k, title: `${a.name}${a.ref ? " · " + a.ref : ""}`, sub: daysBetween(n!.d) > 0 ? `dépassé depuis le ${fmtShort(n!.d)}` : `le ${fmtShort(n!.d)}`, href: `/parc/${a.id}`, cta: "Planifier" }));

  /* Résumé pour la vue du dépôt */
  const summary: DepotSummary = useMemo(() => {
    const deliv = dash.filter((n) => n.kind !== "recuperation");
    const recup = p.notes.filter((n) => (n.kind === "recuperation" || n.kind === "les_deux") && n.status !== "done");
    const prep = teams.find((x) => x.key === "prep"), cmd = teams.find((x) => x.key === "commande");
    const out = (x?: (typeof teams)[number]) => (x?.out || []).map((e) => ({ text: `${e.name} absent`, tone: "warn" as const }));
    const base = minimalSummary(
      vehicles,
      {
        quais: deliv.filter((n) => n.level === "attention" && n.status === "todo").length,
        vide: recup.filter((n) => n.status === "todo").length,
        depose: errYd.length ? 1 : 0,
        parking: vDown,
      },
      {
        quais: { lines: deliv.slice(0, 5).map(noteLine), stat: `${deliv.length} consigne(s) pour les départs · 3 rideaux` },
        vide: { lines: recup.slice(0, 5).map(noteLine), stat: "Retours de fûts et casiers vides" },
        depose: { lines: [...(errYd.length ? [{ text: `${errYd.length} erreur(s) de livraison hier`, tone: "warn" as const }] : []), ...out(prep)], stat: prep ? `${prep.present}/${prep.total} préparateurs présents` : "Commandes préparées" },
        bureau: { lines: out(cmd), stat: cmd ? `${cmd.present}/${cmd.total} au Service Commande` : "Prise de commandes" },
        parking: { lines: vehicles.filter((v) => v.state !== "ok").map((v) => ({ text: `${v.name} : ${v.note}`, tone: v.state === "bad" ? ("bad" as const) : ("warn" as const) })), stat: `${vehicles.length - vDown}/${vehicles.length} véhicules disponibles` },
        soft: { stat: "Racks 30 m, 3 niveaux, 6 m de haut" },
        vins: { stat: "Racks 30 m, 3 niveaux, 6 m de haut" },
        alcool: { stat: "2 niveaux, 2 m maxi, en cage" },
      },
    );
    return { ...base, staff: buildStaff(p.employees, absToday) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.notes, vehicles, errYd.length, absToday.length]);

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

  const announcements = p.announcements
    .filter((a) => !a.expires_on || a.expires_on >= ti)
    .sort((a, b) => ["prio", "attn", "new", "info"].indexOf(a.kind) - ["prio", "attn", "new", "info"].indexOf(b.kind));
  const removeAnn = async (a: Announcement) => {
    const r = await trashRows("announcements", [a.id]);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Message retiré", { action: { label: "Annuler", onClick: async () => { await restoreRow("announcements", a.id); router.refresh(); } } });
    router.refresh();
  };

  const present = teams.reduce((n, x) => n + x.present, 0), total = teams.reduce((n, x) => n + x.total, 0);
  const kpis = [
    perms.read("remontees") && { label: "Remontées à traiter", value: notesTodo, sub: `${dash.filter((n) => n.level === "attention").length} « Attention » à venir`, tone: notesTodo ? "bad" : "ok", href: "/remontees" },
    perms.read("conges") && { label: wd.getTime() === t.getTime() ? "Présents aujourd'hui" : `Présents ${fmtDay(wd)}`, value: present, suffix: ` / ${total}`, sub: absToday.length ? `${absToday.length} absent(s)` : "tout le monde est là", tone: "ink", href: "/conges" },
    perms.read("conges") && { label: "Congés à valider", value: pending.length, sub: pending.length ? "demandes en attente" : "rien en attente", tone: pending.length ? "warn" : "ok", href: "/conges?tab=demandes" },
    perms.read("parc") && { label: "Véhicules disponibles", value: vehicles.length - vDown, suffix: ` / ${vehicles.length}`, sub: vDown ? `${vDown} immobilisé(s)` : "aucun immobilisé", tone: vDown ? "bad" : "ok", href: "/parc" },
    perms.read("taches") && { label: "Tâches en retard", value: lateTasks.length, sub: `sur ${openTasks.length} ouvertes`, tone: lateTasks.length ? "warn" : "ok", href: "/taches" },
    perms.read("erreurs") && { label: "Conformité du mois", value: confM ? confM.global : null, decimals: 1, suffix: " %", sub: confM ? `objectif ${nf(target)} %` : "volumes non saisis", tone: confM ? (confM.global >= target ? "ok" : "bad") : "ink", href: "/erreurs" },
  ].filter(Boolean) as { label: string; value: number | null; suffix?: string; decimals?: number; sub: string; tone: string; href: string }[];
  const toneText: Record<string, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", ink: "text-ink" };

  const hour = new Date().getHours();
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.1em] text-brand uppercase">{fmtLong(new Date())}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight sm:text-[34px]">
            {hour < 18 ? "Bonjour" : "Bonsoir"}
            {p.name && `, ${p.name}`}
          </h1>
        </div>
        <p className="text-sm text-muted">
          {todos.length ? (
            <>
              <b className="text-ink">{todos.length} point(s)</b> attendent une décision.
            </>
          ) : (
            "Rien n'attend de décision : le dépôt suit le plan."
          )}
        </p>
      </motion.div>

      {/* Bandeau de chiffres */}
      {kpis.length > 0 && (
        <div className="mb-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="grid min-w-max grid-flow-col auto-cols-[minmax(150px,1fr)] overflow-hidden rounded-2xl border border-line bg-surface sm:min-w-0">
            {kpis.map((k, i) => (
              <Link key={k.label} href={k.href} className={cn("group px-4 py-3.5 transition-colors hover:bg-surface-2/60", i && "border-l border-line")}>
                <p className="truncate text-[11px] font-semibold tracking-[0.07em] text-muted uppercase">{k.label}</p>
                <p className={cn("tabular mt-1 font-display text-[28px] leading-none font-bold", toneText[k.tone])}>
                  {k.value == null ? "–" : <CountUp value={k.value} decimals={k.decimals} />}
                  {k.suffix && k.value != null && <span className="text-[16px] text-muted">{k.suffix}</span>}
                </p>
                <p className="mt-1 truncate text-[12px] text-muted">{k.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Le dépôt */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            title="Le dépôt en direct"
            subtitle="Zones, quais et véhicules, avec leurs alertes du jour"
            actions={<Link href="/depot" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Plein écran <ArrowRight className="h-4 w-4" /></Link>}
          />
          <DepotHero summary={summary} />
          <div className="px-4 pb-4">
            <DepotTiles s={summary} compact />
          </div>
        </Card>

        {/* À traiter ce matin */}
        <Card className={cn("min-w-0", todos.length && "border-brand/25 bg-gradient-to-b from-brand/[0.04] to-surface")}>
          <CardHeader title="À traiter" subtitle={todos.length ? "Ce qui attend une décision, du plus urgent au moins urgent" : undefined} />
          {todos.length ? (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 px-4 pb-4">
              {todos.slice(0, 7).map((x, i) => (
                <motion.li className="min-w-0" key={x.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                  <Link href={x.href} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand/40">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", x.tone === "bad" ? "bg-bad/10 text-bad" : x.tone === "warn" ? "bg-warn/12 text-warn" : "bg-info/10 text-info")}>
                      <x.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <Badge tone={x.tone}>{x.tag}</Badge>
                      </span>
                      <span className="mt-1 block truncate text-[14px] font-semibold">{x.title}</span>
                      {x.sub && <span className="block truncate text-xs text-muted">{x.sub}</span>}
                    </span>
                    <span className="hidden shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold group-hover:border-brand/40 group-hover:text-brand sm:inline">{x.cta}</span>
                  </Link>
                </motion.li>
              ))}
              {todos.length > 7 && <p className="px-1 text-sm text-muted">et {todos.length - 7} autre(s)</p>}
            </ul>
          ) : (
            <Empty icon={<Siren className="h-5 w-5" />} title="Rien en attente">
              Aucun véhicule bloqué, aucune consigne ni demande en attente.
            </Empty>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {perms.read("conges") && (
          <Card>
            <CardHeader title="Qui est là" subtitle={wd.getTime() === t.getTime() ? "Aujourd'hui" : fmtDay(wd)} actions={<Link href="/conges" className="text-sm font-semibold text-brand">Planning</Link>} />
            <div className="grid gap-3 px-5 pb-5">
              {teams.map((x) => (
                <div key={x.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{x.label}</span>
                    <span className={cn("tabular font-semibold", x.present < x.total ? "text-warn" : "text-ok")}>
                      {x.present}/{x.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div className={cn("h-full rounded-full", x.present < x.total ? "bg-warn" : "bg-ok")} initial={{ width: 0 }} animate={{ width: `${(x.present / x.total) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {fixed
                      .filter((e) => e.team === x.key)
                      .map((e) => (
                        <Link key={e.id} href={`/equipe/${e.id}`} title={`${e.name}${absent.has(e.id) ? " · absent" : ""}`}>
                          <Avatar e={e} size={28} dim={absent.has(e.id)} />
                        </Link>
                      ))}
                  </div>
                  {x.out.length > 0 && <p className="mt-1 truncate text-xs text-muted">Absent(s) : {x.out.map((e) => e.name).join(", ")}</p>}
                </div>
              ))}
              {!teams.length && <p className="text-sm text-muted">Aucun collaborateur enregistré.</p>}
            </div>
          </Card>
        )}

        {perms.read("taches") && (
          <Card>
            <CardHeader title="To do list" subtitle={`${openTasks.length} tâche(s) ouverte(s)`} actions={<Link href="/taches" className="text-sm font-semibold text-brand">Tout voir</Link>} />
            <ul className="grid px-5 pb-4">
              {openTasks
                .slice()
                .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
                .slice(0, 5)
                .map((x) => (
                  <li key={x.id} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-line" />
                    <Link href="/taches" className="min-w-0 flex-1 hover:text-brand">
                      <span className="block text-sm leading-snug">{x.title}</span>
                      <span className={cn("text-xs", x.due_date && x.due_date <= ti ? "font-semibold text-bad" : "text-muted")}>{x.due_date ? fmtShort(x.due_date) : x.section}</span>
                    </Link>
                  </li>
                ))}
              {!openTasks.length && <p className="py-2 text-sm text-ok">Tout est fait.</p>}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader
            title="À la une"
            subtitle="Pour toute l'équipe"
            actions={
              <CanWrite module="any">
                <Button size="sm" variant="outline" onClick={ann.create}>
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </Button>
              </CanWrite>
            }
          />
          {announcements.length ? (
            <ul className="grid gap-2 px-5 pb-5">
              {announcements.map((a) => {
                const k = ANNOUNCEMENT_KINDS[a.kind];
                return (
                  <li key={a.id} className="group flex items-start gap-2.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
                    <Badge tone={k.tone}>{k.label}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.body}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.tool || "Général"}
                        {a.expires_on && ` · jusqu'au ${fmtShort(a.expires_on)}`}
                      </p>
                    </div>
                    {perms.write("any") && (
                      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                        <button onClick={() => ann.edit(a)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2" aria-label="Modifier le message">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeAnn(a)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-bad" aria-label="Retirer le message">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon={<Megaphone className="h-5 w-5" />} title="Aucun message">Publiez une priorité pour l&apos;équipe.</Empty>
          )}
        </Card>
      </div>

      {perms.read("remontees") && dash.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Livraisons sensibles" subtitle="Consignes pour aujourd'hui, demain et permanentes" actions={<Link href="/remontees" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Tout voir <ArrowRight className="h-4 w-4" /></Link>} />
          <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
            {dash.slice(0, 6).map((n, i) => (
              <NoteCard key={n.id} n={n} i={i} compact />
            ))}
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {perms.read("conges") && (
          <Card>
            <CardHeader title="Absences à venir" subtitle="10 prochains jours ouvrés" />
            <div className="px-3 pb-4">
              <Bars
                data={forecast}
                x="d"
                stacked
                height={200}
                refLine={{ y: p.settings.max_abs, label: `seuil ${p.settings.max_abs}` }}
                series={[
                  { key: "Validées", label: "Validées", color: "var(--navy)" },
                  { key: "En attente", label: "En attente", color: "var(--amber)" },
                ]}
              />
            </div>
          </Card>
        )}
        {perms.read("erreurs") && (
          <Card>
            <CardHeader title="Erreurs de livraison" subtitle="8 dernières semaines" />
            <div className="px-3 pb-4">
              <Bars data={weekly} x="w" height={200} series={[{ key: "n", label: "Erreurs", color: "var(--brand)" }]} />
            </div>
          </Card>
        )}
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
