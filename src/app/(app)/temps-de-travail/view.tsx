"use client";
import { Timer } from "lucide-react";
import { useState } from "react";
import { usePerms } from "@/components/app/perms-context";
import { PageHeader } from "@/components/ui/page-header";
import { fmtDate } from "@/lib/domain/dates";
import type { Rule, RuleKey, WorkParams } from "@/lib/domain/worktime";
import { cn } from "@/lib/utils";
import { ControlMode } from "./controle";
import { RulesMode } from "./regles";
import { SimulationMode } from "./simulation";
import type { Template } from "./templates";

export type { Template };
type Mode = "controle" | "simulation" | "regles";
const MODES: [Mode, string][] = [
  ["controle", "Contrôle d'une journée"],
  ["simulation", "Simulation de tournée"],
  ["regles", "Règles et paramètres"],
];

export function WorktimeView({ params, rules, verifiedOn, templates, drivers }: { params: WorkParams; rules: Record<RuleKey, Rule>; verifiedOn: string | null; templates: Template[]; drivers: { id: string; name: string }[] }) {
  const admin = usePerms().admin;
  // les onglets gardent la saisie en mémoire : on masque au lieu de démonter
  const [mode, setMode] = useState<Mode>("controle");
  return (
    <>
      <PageHeader
        title="Temps de travail"
        icon={<Timer />}
        subtitle={`Chauffeurs-livreurs : contrôle d'une journée et simulation de tournée${admin ? "" : " · lecture seule, rien n'est enregistré"}`}
      />
      <div role="tablist" aria-label="Mode" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 shadow-card">
        {MODES.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={cn("rounded-xl px-4 py-2 text-sm whitespace-nowrap transition-colors", mode === k ? "bg-surface-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink")}
          >
            {l}
          </button>
        ))}
      </div>
      <div hidden={mode !== "controle"}>
        <ControlMode P={params} R={rules} drivers={drivers} templates={templates} />
      </div>
      <div hidden={mode !== "simulation"}>
        <SimulationMode P={params} R={rules} templates={templates} />
      </div>
      <div hidden={mode !== "regles"}>
        <RulesMode P={params} R={rules} verifiedOn={verifiedOn} />
      </div>
      <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">
        <p className="mb-1">Règles vérifiées le {verifiedOn ? fmtDate(verifiedOn) : "(date non renseignée)"}.</p>
        <p>
          Outil d&apos;aide basé sur les textes en vigueur à la date indiquée. Il ne remplace ni la convention collective des transports routiers (non intégrée), ni l&apos;avis de l&apos;inspection du travail ou d&apos;un juriste.
        </p>
      </footer>
    </>
  );
}
