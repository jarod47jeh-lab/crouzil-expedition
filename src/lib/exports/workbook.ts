/* Export de classeurs : Excel avec un onglet par tableau, ou CSV avec les tableaux les uns sous les autres.
   Le premier onglet est toujours « Indicateurs » : les KPI sont dans le fichier, pas seulement à l'écran. */

export type Cell = string | number | null | undefined;
export interface Sheet {
  /** Nom de l'onglet (31 caractères maximum dans Excel) */
  name: string;
  rows: Cell[][];
  /** Largeur des colonnes, en caractères */
  widths?: number[];
  /** Nombre de lignes figées en haut (en-têtes) */
  freeze?: number;
}
export type ExportKind = "xlsx" | "csv";

const SAFE = /[\\/?*[\]:]/g;

function csvOf(sheets: Sheet[]) {
  const esc = (v: Cell) => {
    if (v == null) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out: string[] = [];
  sheets.forEach((sh, i) => {
    if (i) out.push("", "");
    out.push(esc(`=== ${sh.name} ===`));
    sh.rows.forEach((r) => out.push(r.map(esc).join(";")));
  });
  return out.join("\r\n");
}

/** Télécharge le classeur dans le navigateur */
/** dated : ajoute la date du jour au nom du fichier (inutile quand le nom porte déjà la période) */
export async function downloadWorkbook(file: string, sheets: Sheet[], kind: ExportKind, dated = true) {
  const name = dated ? `${file}-${new Date().toISOString().slice(0, 10)}` : file;
  if (kind === "csv") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csvOf(sheets)], { type: "text/csv;charset=utf-8" }));
    a.download = name + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows.map((r) => r.map((c) => (c == null ? "" : c))));
    const widths = sh.widths || autoWidths(sh.rows);
    ws["!cols"] = widths.map((w) => ({ wch: w }));
    if (sh.freeze) ws["!freeze"] = { xSplit: 0, ySplit: sh.freeze };
    let n = sh.name.replace(SAFE, " ").slice(0, 31);
    while (used.has(n)) n = n.slice(0, 28) + " " + used.size;
    used.add(n);
    XLSX.utils.book_append_sheet(wb, ws, n);
  }
  XLSX.writeFile(wb, name + ".xlsx");
}

function autoWidths(rows: Cell[][]) {
  const w: number[] = [];
  for (const r of rows.slice(0, 400))
    r.forEach((c, i) => {
      const l = c == null ? 0 : String(c).length;
      w[i] = Math.min(48, Math.max(w[i] || 6, l + 2));
    });
  return w;
}

/** Pourcentage arrondi à 0,1 près (nombre, pour rester calculable dans Excel) */
export const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);
export const round1 = (n: number) => Math.round(n * 10) / 10;
