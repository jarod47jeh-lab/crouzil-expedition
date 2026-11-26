"use client";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtClock, fmtDur, maxClients, parseDuration, simulateTour, type Category, type Rule, type RuleKey, type StepKind, type WorkParams } from "@/lib/domain/worktime";
import { cn, plural } from "@/lib/utils";
import { AlertList, Choice, DurField, fromInput, NumField, Stat, StatusPill, TimeField, Timeline } from "./shared";
import { TemplateBar, type Template } from "./templates";

export interface TourForm {
  category: Category;
  badgeIn: string;
  departure: string;
  clients: string;
  perClient: string;
  between: string;
  returnAt: string;
  unload: string;
  closing: string;
}
const initial: TourForm = { category: "lourd", badgeIn: "05:00", departure: "05:30", clients: "12", perClient: "0:20", between: "0:10", returnAt: "13:00", unload: "0:20", closing: "0:10" };

const KIND: Record<StepKind, { cls: string; label: string }> = {
  prise: { cls: "bg-ink/25", label: "Prise de service" },
  trajet: { cls: "bg-navy", label: "Conduite" },
  client: { cls: "bg-amber", label: "Livraison client" },
  pause: { cls: "bg-ok", label: "Pause libre" },
  retour: { cls: "bg-navy", label: "Conduite" },
  dechargement: { cls: "bg-ink/25", label: "Déchargement, clôture" },
  cloture: { cls: "bg-ink/25", label: "Déchargement, clôture" },
};

export function SimulationMode({ P, R, templates }: { P: WorkParams; R: Record<RuleKey, Rule>; templates: Template[] }) {
  const [f, setF] = useState<TourForm>(initial);
  const set = <K extends keyof TourForm>(k: K, v: TourForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const input = useMemo(() => {
    const badgeIn = fromInput(f.badgeIn);
    const departure = fromInput(f.departure);
    const clients = Math.max(0, Math.min(60, Math.round(Number(f.clients) || 0)));
    const perClient = parseDuration(f.perClient);
    const between = parseDuration(f.between);
    if (badgeIn == null || departure == null || perClient == null || between == null || clients < 1) return null;
    return {
      category: f.category,
      badgeIn,
      departure: Math.max(departure, badgeIn),
      clients,
      perClient,
      between,
      returnAt: fromInput(f.returnAt),
      unload: parseDuration(f.unload) ?? 0,
      closing: parseDuration(f.closing) ?? 0,
    };
  }, [f]);
  const plan = useMemo(() => (input ? simulateTour(input, P) : null), [input, P]);
  const max = useMemo(() => (input ? maxClients(input, P) : null), [input, P]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card className="content-start self-start">
        <CardHeader
          title="Tournée à simuler"
          subtitle="Saisie temporaire : rien n'est enregistré"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setF(initial)} aria-label="Revenir aux valeurs de départ">
              <RotateCcw className="h-4 w-4" />
            </Button>
          }
        />
        <div className="grid gap-4 px-5 pb-5">
          <TemplateBar kind="simulation" templates={templates} current={f} onLoad={setF} />
          <Choice<Category>
            label="Véhicule"
            value={f.category}
            onChange={(v) => set("category", v)}
            options={[
              ["lourd", "Plus de 3,5 t"],
              ["leger", "3,5 t et moins"],
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <TimeField label="Badge entrée" value={f.badgeIn} onChange={(v) => set("badgeIn", v)} />
            <TimeField label="Départ du dépôt" value={f.departure} onChange={(v) => set("departure", v)} />
            <NumField label="Nombre de clients" value={f.clients} onChange={(v) => set("clients", v)} min={1} />
            <DurField label="Durée moyenne par client" value={f.perClient} onChange={(v) => set("perClient", v)} />
            <DurField label="Trajet moyen entre clients" value={f.between} onChange={(v) => set("between", v)} hint="Aussi utilisé pour aller au premier client" />
            <TimeField label="Retour au dépôt" value={f.returnAt} onChange={(v) => set("returnAt", v)} hint="Au plus tôt : dernier client plus un trajet" />
            <DurField label="Déchargement du vide" value={f.unload} onChange={(v) => set("unload", v)} />
            <DurField label="Clôture" value={f.closing} onChange={(v) => set("closing", v)} />
          </div>
        </div>
      </Card>

      <div className="grid content-start gap-5">
        {!plan || !input ? (
          <Card>
            <div className="px-5 py-10 text-center text-sm text-muted">Complétez le badge, le départ, les clients et les durées pour lancer la simulation.</div>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader title="Résultat de la tournée" subtitle={plural(input.clients, "client")} actions={<StatusPill status={plan.status} />} />
              <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3">
                <Stat label="Badge sortie" value={fmtClock(plan.badgeOut)} />
                <Stat label="Temps de service" value={fmtDur(plan.day.service)} tone={plan.day.service > P.serviceDay ? "bad" : undefined} />
                <Stat label="Conduite" value={fmtDur(plan.drive)} />
                <Stat
                  label="Dernière livraison"
                  value={plan.lastDeliveryEnd == null ? "aucune" : fmtClock(plan.lastDeliveryEnd)}
                  sub={`avant ${fmtClock(P.noDeliveryFrom)}`}
                  tone={plan.lastDeliveryEnd != null && plan.lastDeliveryEnd > P.noDeliveryFrom ? "bad" : undefined}
                />
                <Stat
                  label="Pause conseillée"
                  value={plan.pause ? fmtDur(plan.pause) : "aucune"}
                  sub={plan.pause ? (plan.pauseAfter === 0 ? "avant le premier client" : `après le client ${plan.pauseAfter}`) : undefined}
                />
                <Stat label="Clients tenables" value={max == null ? "non calculé" : String(max)} sub="au maximum en restant conforme" tone={max != null && input.clients > max ? "bad" : undefined} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Frise de la tournée" />
              <div className="px-5 pb-5">
                <Timeline
                  from={input.badgeIn}
                  to={plan.badgeOut}
                  bands={plan.steps.map((s) => ({ start: s.start, end: s.end, cls: KIND[s.kind].cls, label: s.label }))}
                  markers={[{ at: input.badgeIn + P.maxConsecutive, label: `Limite de la première pause, ${fmtClock(input.badgeIn + P.maxConsecutive)}` }]}
                  shade={{ from: P.noDeliveryFrom, to: P.noDeliveryTo, label: `Sans livraison, ${fmtClock(P.noDeliveryFrom)} à ${fmtClock(P.noDeliveryTo)}` }}
                  legend={[
                    ["bg-ink/25", "Dépôt"],
                    ["bg-navy", "Conduite"],
                    ["bg-amber", "Livraison"],
                    ["bg-ok", "Pause libre"],
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Alertes et actions" />
              <div className="px-5 pb-5">
                <AlertList alerts={[...plan.day.alerts, ...plan.extraAlerts]} rules={R} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Déroulé minute par minute" />
              <ol className="grid px-5 pb-4">
                {plan.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", KIND[s.kind].cls)} />
                    <span className="tabular w-28 shrink-0 text-muted">
                      {fmtClock(s.start)} à {fmtClock(s.end)}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", s.kind === "pause" && "font-medium")}>{s.label}</span>
                    <span className="tabular shrink-0 text-xs text-muted">{fmtDur(s.end - s.start)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
