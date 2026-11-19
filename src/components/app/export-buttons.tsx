"use client";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { loadTeamExport } from "@/lib/actions/exports";
import { buildCongesWorkbook, customPeriod, monthPeriod, yearPeriod, type CongesExportData } from "@/lib/exports/conges";
import { buildTeamWorkbook } from "@/lib/exports/team";
import { downloadWorkbook, type ExportKind } from "@/lib/exports/workbook";
import { MONTHS } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

function Formats({ busy, onPick }: { busy: ExportKind | null; onPick: (k: ExportKind) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={!!busy} onClick={() => onPick("xlsx")} className="flex items-start gap-3 rounded-2xl border border-line p-3 text-left transition-colors hover:border-brand/50 disabled:opacity-60">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
        <span>
          <span className="block font-semibold">{busy === "xlsx" ? "Préparation…" : "Excel (.xlsx)"}</span>
          <span className="text-xs text-muted">Un onglet par tableau, l&apos;onglet « Indicateurs » en premier</span>
        </span>
      </button>
      <button type="button" disabled={!!busy} onClick={() => onPick("csv")} className="flex items-start gap-3 rounded-2xl border border-line p-3 text-left transition-colors hover:border-brand/50 disabled:opacity-60">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <span>
          <span className="block font-semibold">{busy === "csv" ? "Préparation…" : "CSV"}</span>
          <span className="text-xs text-muted">Un seul fichier : indicateurs puis chaque tableau, séparateur « ; »</span>
        </span>
      </button>
    </div>
  );
}

/** Export « Équipes, collaborateurs, tenues et équipements » */
export function TeamExportButton({ label = "Exporter" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const year = new Date().getFullYear();
  const go = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      const r = await loadTeamExport(year);
      if (!r.ok) return void toast.error(r.error);
      await downloadWorkbook("equipe-collaborateurs-equipements", buildTeamWorkbook(r.data), kind);
      toast.success("Export prêt", { description: "Le fichier est dans vos téléchargements." });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Exporter l'équipe" subtitle="Collaborateurs, tailles, tenues et équipements, avec les indicateurs">
        <div className="grid gap-4">
          <ul className="grid gap-1 text-sm text-muted">
            <li>• <b className="text-ink">Indicateurs</b> : effectif par équipe, ancienneté, tailles renseignées, CP restants, taux d&apos;équipement par catégorie</li>
            <li>• Collaborateurs (fiche complète et soldes {year}), tailles</li>
            <li>• État des dotations, besoins de commande par taille, historique, catalogue</li>
          </ul>
          <Formats busy={busy} onPick={go} />
        </div>
      </Dialog>
    </>
  );
}

/** Export « Planning et congés » : mois affiché, année ou période libre */
export function CongesExportButton({ year, month, ...data }: Omit<CongesExportData, "from" | "to" | "label"> & { year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [mode, setMode] = useState<"mois" | "annee" | "libre">("mois");
  const [a, setA] = useState(`${year}-${String(month + 1).padStart(2, "0")}-01`);
  const [b, setB] = useState(`${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`);
  const go = async (kind: ExportKind) => {
    if (mode === "libre" && (!a || !b || a > b)) return void toast.error("Choisissez une période valide.");
    const p = mode === "mois" ? monthPeriod(year, month) : mode === "annee" ? yearPeriod(year) : customPeriod(a, b);
    setBusy(kind);
    try {
      const slug = mode === "mois" ? `${year}-${String(month + 1).padStart(2, "0")}` : mode === "annee" ? String(year) : `${a}_${b}`;
      await downloadWorkbook(`planning-conges-${slug}`, buildCongesWorkbook({ ...data, ...p }), kind, false);
      toast.success("Export prêt", { description: "Le fichier est dans vos téléchargements." });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(null);
    }
  };
  const opt = (k: typeof mode, l: string) => (
    <button type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", mode === k ? "border-brand bg-brand text-brand-ink" : "border-line hover:border-brand/50")}>
      {l}
    </button>
  );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Exporter
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Exporter le planning et les congés" subtitle="Excel ou CSV, avec les indicateurs de la période">
        <div className="grid gap-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Période</p>
            <div className="flex flex-wrap gap-1.5">
              {opt("mois", `${MONTHS[month]} ${year}`)}
              {opt("annee", `Année ${year}`)}
              {opt("libre", "Autre période")}
            </div>
            {mode === "libre" && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                Du <input type="date" value={a} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setA(e.target.value)} className="field h-9 min-h-0 w-auto" aria-label="Début de la période" />
                au <input type="date" value={b} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setB(e.target.value)} className="field h-9 min-h-0 w-auto" aria-label="Fin de la période" />
              </div>
            )}
          </div>
          <ul className="grid gap-1 text-sm text-muted">
            <li>• <b className="text-ink">Indicateurs</b> : jours d&apos;absence, taux d&apos;absence et d&apos;absentéisme, par équipe, par motif et par mois, pic d&apos;absents, jours au-dessus du seuil, demandes, freelances</li>
            <li>• Planning jour par jour (codes CP, RTT, MAL…), détail des absences, demandes, soldes {year}</li>
          </ul>
          <Formats busy={busy} onPick={go} />
        </div>
      </Dialog>
    </>
  );
}
