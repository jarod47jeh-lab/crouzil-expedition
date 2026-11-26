"use client";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { checkDay, fmtClock, fmtDur, parseDuration, type Category, type Rule, type RuleKey, type WorkParams } from "@/lib/domain/worktime";
import { iso, today } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { AlertList, Choice, DurField, fromInput, NumField, Stat, StatusPill, TimeField, Timeline, type Band } from "./shared";
import { TemplateBar, type Template } from "./templates";

interface PauseForm {
  start: string;
  end: string;
  free: boolean;
}
export interface ControlForm {
  driver: string;
  date: string;
  category: Category;
  badgeIn: string;
  badgeOut: string;
  pauses: PauseForm[];
  drive: string;
  other: string;
  avail: string;
  rest: string;
  prevEnd: string;
  weekService: string;
  weekDrive: string;
  fortnightDrive: string;
  extendedDays: string;
  reducedRests: string;
}

const empty = (): ControlForm => ({
  driver: "",
  date: iso(today()),
  category: "lourd",
  badgeIn: "",
  badgeOut: "",
  pauses: [],
  drive: "",
  other: "",
  avail: "",
  rest: "",
  prevEnd: "",
  weekService: "",
  weekDrive: "",
  fortnightDrive: "",
  extendedDays: "",
  reducedRests: "",
});
/** Journée type de la consigne (cas A) */
const example = (f: ControlForm): ControlForm => ({
  ...f,
  badgeIn: "05:00",
  badgeOut: "13:30",
  pauses: [{ start: "09:20", end: "09:50", free: true }],
  drive: "3:00",
  other: "5:00",
  avail: "0:00",
  rest: "0:30",
});

const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

export function ControlMode({ P, R, drivers, templates }: { P: WorkParams; R: Record<RuleKey, Rule>; drivers: { id: string; name: string }[]; templates: Template[] }) {
  const [f, setF] = useState<ControlForm>(empty);
  const set = <K extends keyof ControlForm>(k: K, v: ControlForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setPause = (i: number, p: Partial<PauseForm>) => setF((x) => ({ ...x, pauses: x.pauses.map((q, j) => (j === i ? { ...q, ...p } : q)) }));

  const bIn = fromInput(f.badgeIn);
  const bOut = fromInput(f.badgeOut);
  const res = useMemo(() => {
    if (bIn == null || bOut == null) return null;
    return checkDay(
      {
        category: f.category,
        badgeIn: bIn,
        badgeOut: bOut,
        pauses: f.pauses.flatMap((p) => {
          const s = fromInput(p.start);
          const e = fromInput(p.end);
          return s == null || e == null ? [] : [{ start: s, end: e, free: p.free }];
        }),
        tacho: { drive: parseDuration(f.drive), other: parseDuration(f.other), avail: parseDuration(f.avail), rest: parseDuration(f.rest) },
        prevEnd: fromInput(f.prevEnd),
        weekServiceBefore: parseDuration(f.weekService),
        weekDriveBefore: parseDuration(f.weekDrive),
        fortnightDriveBefore: parseDuration(f.fortnightDrive),
        extendedDaysBefore: num(f.extendedDays),
        reducedRestsBefore: num(f.reducedRests),
      },
      P,
      R,
    );
  }, [f, bIn, bOut, P, R]);

  const driverList = drivers.length > 0;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-5">
        <Card>
          <CardHeader
            title="Journée à contrôler"
            subtitle="Saisie temporaire : rien n'est enregistré"
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => setF(example)}>
                  Exemple
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setF(empty())} aria-label="Effacer la saisie">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            }
          />
          <div className="grid gap-4 px-5 pb-5">
            <TemplateBar kind="controle" templates={templates} current={f} onLoad={setF} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chauffeur">
                {driverList ? (
                  <select className="field pr-8" value={f.driver} onChange={(e) => set("driver", e.target.value)}>
                    <option value="">Choisir</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={f.driver} onChange={(e) => set("driver", e.target.value)} placeholder="Nom du chauffeur" />
                )}
              </Field>
              <Field label="Date">
                <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
            </div>
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
              <TimeField label="Badge sortie" value={f.badgeOut} onChange={(v) => set("badgeOut", v)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Pauses"
            subtitle={`Une pause non libre compte comme du travail ; moins de ${P.pauseSlice} min, elle ne coupe pas le travail`}
            actions={
              <Button size="sm" variant="outline" onClick={() => set("pauses", [...f.pauses, { start: "", end: "", free: true }])}>
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            }
          />
          <div className="grid gap-3 px-5 pb-5">
            {!f.pauses.length && <p className="text-sm text-muted">Aucune pause saisie.</p>}
            {f.pauses.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl border border-line p-3">
                <TimeField label="Début" value={p.start} onChange={(v) => setPause(i, { start: v })} />
                <TimeField label="Fin" value={p.end} onChange={(v) => setPause(i, { end: v })} />
                <Button variant="ghost" size="icon" onClick={() => set("pauses", f.pauses.filter((_, j) => j !== i))} aria-label="Retirer la pause">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="col-span-3">
                  <Choice<"oui" | "non">
                    label="Réellement libre"
                    value={p.free ? "oui" : "non"}
                    onChange={(v) => setPause(i, { free: v === "oui" })}
                    options={[
                      ["oui", "Oui"],
                      ["non", "Non"],
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tachygraphe" subtitle="Durées de la journée, en heures et minutes" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5">
            <DurField label="Conduite" value={f.drive} onChange={(v) => set("drive", v)} />
            <DurField label="Autres tâches" value={f.other} onChange={(v) => set("other", v)} />
            <DurField label="Disponibilité" value={f.avail} onChange={(v) => set("avail", v)} />
            <DurField label="Pause / lit" value={f.rest} onChange={(v) => set("rest", v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Veille et semaine" subtitle="Facultatif : pour le repos quotidien et les cumuls" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5">
            <TimeField label="Fin de service la veille" value={f.prevEnd} onChange={(v) => set("prevEnd", v)} />
            <DurField label="Service de la semaine, avant ce jour" value={f.weekService} onChange={(v) => set("weekService", v)} placeholder="31:30" />
            <DurField label="Conduite de la semaine, avant ce jour" value={f.weekDrive} onChange={(v) => set("weekDrive", v)} placeholder="12:00" />
            <DurField label="Conduite sur deux semaines, avant ce jour" value={f.fortnightDrive} onChange={(v) => set("fortnightDrive", v)} placeholder="30:00" />
            {f.category === "lourd" && (
              <>
                <NumField label="Journées de 10 h de conduite déjà faites" value={f.extendedDays} onChange={(v) => set("extendedDays", v)} />
                <NumField label="Repos réduits déjà pris" value={f.reducedRests} onChange={(v) => set("reducedRests", v)} />
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid content-start gap-5 xl:sticky xl:top-24">
        {!res ? (
          <Card>
            <div className="px-5 py-10 text-center text-sm text-muted">Saisissez le badge d&apos;entrée et de sortie pour lancer le contrôle.</div>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader
                title={f.driver ? `${f.driver}, ${new Date(f.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : "Résultat"}
                subtitle={f.category === "lourd" ? "Véhicule de plus de 3,5 t" : "Véhicule de 3,5 t et moins"}
                actions={<StatusPill status={res.status} />}
              />
              <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3">
                <Stat label="Présence" value={fmtDur(res.presence)} />
                <Stat label="Temps de service" value={fmtDur(res.service)} tone={res.service > P.serviceDay ? "bad" : undefined} />
                <Stat label="Pauses retenues" value={fmtDur(res.pausesValid)} sub={res.pauseRequired ? `${fmtDur(res.pauseRequired)} requises` : "aucune requise"} tone={res.pausesValid < res.pauseRequired ? "bad" : undefined} />
                <Stat label="Travail d'affilée max" value={fmtDur(res.longestWork)} tone={res.longestWork > P.maxConsecutive ? "bad" : undefined} sub={`limite ${fmtDur(P.maxConsecutive)}`} />
                <Stat label="Première pause avant" value={fmtClock(res.firstPauseDeadline)} sub={`marge conseillée ${fmtClock(res.firstPauseDeadline - P.pauseMargin)}`} />
                <Stat label="Conduite" value={res.drive == null ? "non saisie" : fmtDur(res.drive)} />
                <Stat label="Écart tachygraphe" value={res.gap == null ? "non saisi" : fmtDur(res.gap)} tone={res.gap != null && Math.abs(res.gap) > P.badgeTolerance ? "warn" : undefined} sub={`tolérance ${P.badgeTolerance} min`} />
                <Stat label="Repos depuis la veille" value={res.rest == null ? "non saisi" : fmtDur(res.rest)} />
                <Stat label="Service de la semaine" value={res.weekService == null ? "non saisi" : fmtDur(res.weekService)} sub={res.overtime ? `${fmtDur(res.overtime)} supplémentaires` : undefined} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Frise de la journée" />
              <div className="px-5 pb-5">
                <Timeline
                  from={bIn!}
                  to={bOut! < bIn! ? bOut! + 1440 : bOut!}
                  bands={res.segments.map<Band>((s) => ({
                    start: s.start,
                    end: s.end,
                    label: { travail: "Travail", pause: "Pause libre", "pause-non-libre": "Pause non libre", depassement: "Au-delà de 6 h d'affilée" }[s.kind],
                    cls: { travail: "bg-ink/25", pause: "bg-ok", "pause-non-libre": "bg-warn", depassement: "bg-bad" }[s.kind],
                  }))}
                  markers={[{ at: res.firstPauseDeadline, label: `Limite de la première pause, ${fmtClock(res.firstPauseDeadline)}` }]}
                  legend={[
                    ["bg-ink/25", "Travail"],
                    ["bg-ok", "Pause libre"],
                    ["bg-warn", "Pause non libre"],
                    ["bg-bad", "Au-delà de la limite"],
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Alertes et actions" subtitle={res.alerts.length ? undefined : "La journée respecte toutes les règles contrôlées"} />
              <div className={cn("px-5 pb-5")}>
                <AlertList alerts={res.alerts} rules={R} />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
