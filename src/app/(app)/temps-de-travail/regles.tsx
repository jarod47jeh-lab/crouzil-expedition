"use client";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { usePerms } from "@/components/app/perms-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { saveWorktimeSettings } from "@/lib/actions/worktime";
import { fmtDate } from "@/lib/domain/dates";
import { DEFAULT_PARAMS, DEFAULT_RULES, fmtClock, fmtDur, PARAM_FIELDS, parseDuration, type Rule, type RuleKey, type WorkParams } from "@/lib/domain/worktime";
import { fromInput, toInput } from "./shared";

const KEYS = Object.keys(DEFAULT_RULES) as RuleKey[];
const show = (unit: (typeof PARAM_FIELDS)[number]["unit"], v: number) => (unit === "heure" ? fmtClock(v) : unit === "nombre" ? String(v) : fmtDur(v));

export function RulesMode({ P, R, verifiedOn }: { P: WorkParams; R: Record<RuleKey, Rule>; verifiedOn: string | null }) {
  const admin = usePerms().admin;
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title="Règles appliquées"
          subtitle={`Dernière vérification des règles : ${verifiedOn ? fmtDate(verifiedOn) : "non renseignée"}`}
          actions={
            admin ? (
              <Button variant="outline" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4" /> Modifier les paramètres
              </Button>
            ) : (
              <span className="text-xs text-muted">Lecture seule : seul l&apos;administrateur modifie ces règles</span>
            )
          }
        />
        <ul className="grid px-5 pb-3">
          {KEYS.map((k) => (
            <li key={k} className="grid gap-2 border-t border-line py-4 first:border-t-0 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,0.9fr)] sm:gap-4">
              <span className="tabular text-sm text-muted">{k}</span>
              <div className="min-w-0">
                <p className="font-medium">{R[k].title}</p>
                <p className="mt-1 text-sm text-ink/85">{R[k].text}</p>
                <p className="mt-1 text-xs text-muted">
                  {R[k].ref}
                  {!R[k].legal && " · règle interne"}
                </p>
              </div>
              <dl className="grid content-start gap-1 text-sm">
                {PARAM_FIELDS.filter((p) => p.rule === k).map((p) => (
                  <div key={p.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">{p.label}</dt>
                    <dd className="tabular shrink-0">{show(p.unit, P[p.key])}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Card>
      {admin && <RulesEditor open={open} onClose={() => setOpen(false)} P={P} R={R} verifiedOn={verifiedOn} />}
    </div>
  );
}

function RulesEditor({ open, onClose, P, R, verifiedOn }: { open: boolean; onClose: () => void; P: WorkParams; R: Record<RuleKey, Rule>; verifiedOn: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fmtIn = (unit: string, v: number) => (unit === "heure" ? toInput(v) : unit === "nombre" ? String(v) : fmtDur(v).replace("h", ":"));
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(PARAM_FIELDS.map((p) => [p.key, fmtIn(p.unit, P[p.key])])));
  const [texts, setTexts] = useState<Record<RuleKey, Rule>>(R);
  const [date, setDate] = useState(verifiedOn || new Date().toISOString().slice(0, 10));

  const submit = (reset = false) =>
    start(async () => {
      const params: Partial<WorkParams> = {};
      if (!reset)
        for (const p of PARAM_FIELDS) {
          const s = vals[p.key];
          const v = p.unit === "heure" ? fromInput(s) : p.unit === "nombre" ? (s.trim() === "" ? null : Number(s)) : parseDuration(s);
          if (v == null || !Number.isFinite(v)) return void toast.error(`Valeur invalide : ${p.label} (${p.rule}).`);
          if (v !== DEFAULT_PARAMS[p.key]) params[p.key] = v;
        }
      const rules: Partial<Record<RuleKey, Partial<Rule>>> = {};
      if (!reset)
        for (const k of KEYS) {
          const o: Partial<Rule> = {};
          for (const f of ["title", "text", "ref"] as const) if (texts[k][f] !== DEFAULT_RULES[k][f]) o[f] = texts[k][f];
          if (Object.keys(o).length) rules[k] = o;
        }
      const r = await saveWorktimeSettings(params, rules, date);
      if (!r.ok) return void toast.error(r.error);
      toast.success(reset ? "Valeurs d'origine rétablies" : "Paramètres enregistrés");
      onClose();
      router.refresh();
    });

  return (
    <Dialog open={open} onClose={onClose} title="Modifier les paramètres" subtitle="Durées en heures et minutes (6:00, 0:30). Les changements s'appliquent à tous les utilisateurs." wide>
      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Date de dernière vérification des règles">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {KEYS.map((k) => (
          <fieldset key={k} className="grid gap-3 rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-medium">
              <span className="tabular text-muted">{k}</span> {texts[k].title}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {PARAM_FIELDS.filter((p) => p.rule === k).map((p) => (
                <Field key={p.key} label={p.label}>
                  <Input
                    type={p.unit === "heure" ? "time" : p.unit === "nombre" ? "number" : "text"}
                    inputMode="numeric"
                    className="tabular"
                    value={vals[p.key]}
                    onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
            <Field label="Intitulé">
              <Input value={texts[k].title} onChange={(e) => setTexts((t) => ({ ...t, [k]: { ...t[k], title: e.target.value } }))} />
            </Field>
            <Field label="Texte de la règle">
              <Textarea value={texts[k].text} onChange={(e) => setTexts((t) => ({ ...t, [k]: { ...t[k], text: e.target.value } }))} />
            </Field>
            <Field label="Référence">
              <Input value={texts[k].ref} onChange={(e) => setTexts((t) => ({ ...t, [k]: { ...t[k], ref: e.target.value } }))} />
            </Field>
          </fieldset>
        ))}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (confirm("Rétablir toutes les valeurs et tous les textes d'origine ?")) submit(true);
            }}
            disabled={pending}
          >
            Rétablir les valeurs d&apos;origine
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
