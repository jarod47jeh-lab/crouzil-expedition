"use client";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtClock, type Alert, type Rule, type RuleKey, type Status } from "@/lib/domain/worktime";

/** Heure d'horloge (sélecteur natif, pratique au téléphone) */
export function TimeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink/85">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="field tabular" />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Durée saisie en heures et minutes, « 3:00 » ou « 0:30 » */
export function DurField({ label, value, onChange, hint, placeholder = "0:00" }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink/85">{label}</span>
      <input inputMode="numeric" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="field tabular" />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function NumField({ label, value, onChange, hint, min = 0 }: { label: string; value: string; onChange: (v: string) => void; hint?: string; min?: number }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink/85">{label}</span>
      <input type="number" min={min} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="field tabular" />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Choix à deux ou trois options, en boutons */
export function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink/85">{label}</span>
      <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-line bg-surface p-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn("h-8 rounded-md px-2 text-sm transition-colors", value === v ? "bg-surface-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATUS_CLS: Record<Status, string> = {
  Conforme: "border-ok/30 bg-ok/10 text-ok",
  "À surveiller": "border-warn/30 bg-warn/10 text-warn",
  "Non conforme": "border-bad/30 bg-bad/10 text-bad",
};
export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium", STATUS_CLS[status], className)}>{status}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" | "warn" }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <p className="truncate text-xs text-muted">{label}</p>
      {/d/.test(value) ? (
        <p className={cn("tabular mt-1 text-xl font-medium", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")}>{value}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">{value}</p>
      )}
      {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

const LEVEL: Record<Alert["level"], { icon: typeof Info; cls: string; label: string }> = {
  bad: { icon: CircleAlert, cls: "text-bad", label: "Non conforme" },
  warn: { icon: AlertTriangle, cls: "text-warn", label: "À surveiller" },
  info: { icon: Info, cls: "text-muted", label: "Pour information" },
};
export function AlertList({ alerts, rules }: { alerts: Alert[]; rules: Record<RuleKey, Rule> }) {
  if (!alerts.length) return <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">Aucune règle n&apos;est enfreinte.</p>;
  const order = { bad: 0, warn: 1, info: 2 };
  return (
    <ul className="grid gap-2">
      {[...alerts]
        .sort((a, b) => order[a.level] - order[b.level])
        .map((a, i) => {
          const L = LEVEL[a.level];
          return (
            <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
              <L.icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", L.cls)} strokeWidth={1.75} aria-label={L.label} />
              <div className="min-w-0 text-sm">
                <p className="text-ink">{a.message}</p>
                <p className="mt-1 font-medium text-ink">{a.action}</p>
                <p className="mt-1 text-xs text-muted">
                  <span className="tabular">{a.rule}</span> · {rules[a.rule].title} · {rules[a.rule].ref}
                </p>
              </div>
            </li>
          );
        })}
    </ul>
  );
}

export interface Band {
  start: number;
  end: number;
  cls: string;
  label: string;
}
/** Frise horaire : bandes colorées sur l'échelle de la journée, graduée à l'heure */
export function Timeline({ from, to, bands, markers = [], shade, legend }: { from: number; to: number; bands: Band[]; markers?: { at: number; label: string }[]; shade?: { from: number; to: number; label: string }; legend: [string, string][] }) {
  const a = Math.floor(from / 60) * 60;
  const b = Math.max(a + 60, Math.ceil(to / 60) * 60);
  const pos = (m: number) => `${((Math.min(Math.max(m, a), b) - a) / (b - a)) * 100}%`;
  const width = (s: number, e: number) => `${((Math.min(e, b) - Math.max(s, a)) / (b - a)) * 100}%`;
  const hours: number[] = [];
  for (let h = a; h <= b; h += 60) hours.push(h);
  const step = hours.length > 13 ? 2 : 1;
  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-lg border border-line bg-surface-2">
        {shade && shade.to > a && shade.from < b && (
          <div
            className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,transparent_0_6px,color-mix(in_srgb,var(--muted)_18%,transparent)_6px_8px)]"
            style={{ left: pos(shade.from), width: width(shade.from, shade.to) }}
            title={shade.label}
          />
        )}
        {bands.map((x, i) => (
          <div key={i} className={cn("absolute inset-y-1 rounded-[3px]", x.cls)} style={{ left: pos(x.start), width: width(x.start, x.end) }} title={`${x.label} : ${fmtClock(x.start)} à ${fmtClock(x.end)}`} />
        ))}
        {markers.map((m, i) => (
          <div key={i} className="absolute inset-y-0 w-px bg-ink" style={{ left: pos(m.at) }} title={m.label} />
        ))}
      </div>
      <div className="relative mt-1 h-4">
        {hours.map((h, i) =>
          i % step === 0 ? (
            <span key={h} className="tabular absolute -translate-x-1/2 text-[11px] text-muted first:translate-x-0 last:-translate-x-full" style={{ left: pos(h) }}>
              {fmtClock(h).replace("h00", "h")}
            </span>
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {legend.map(([cls, l]) => (
          <li key={l} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-4 rounded-[2px]", cls)} />
            {l}
          </li>
        ))}
        {markers.map((m) => (
          <li key={m.label} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-ink" />
            {m.label}
          </li>
        ))}
        {shade && (
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[2px] bg-[repeating-linear-gradient(45deg,transparent_0_3px,color-mix(in_srgb,var(--muted)_35%,transparent)_3px_4px)]" />
            {shade.label}
          </li>
        )}
      </ul>
    </div>
  );
}

/** « 05:00 » (champ time) -> minutes */
export const fromInput = (v: string) => {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** minutes -> « 05:00 » pour un champ time */
export const toInput = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
