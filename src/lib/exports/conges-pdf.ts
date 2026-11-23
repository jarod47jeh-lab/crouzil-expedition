/* PDF « Planning et congés » en A4 paysage, pour l'impression et la lecture :
   indicateurs, planning coloré par motif (un mois par page), demandes et soldes. */
import { LEAVE_COLOR, LEAVE_TYPES } from "@/lib/domain/constants";
import { MONTHS } from "@/lib/domain/dates";
import type { Cell, Sheet } from "./workbook";

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BRAND: RGB = [206, 0, 19];
const INK: RGB = [35, 29, 26];
const MUTED: RGB = [113, 102, 95];
const LINE: RGB = [227, 218, 209];
const SOFT: RGB = [246, 242, 237];
const txt = (c: Cell) => (c == null ? "" : typeof c === "number" ? String(c).replace(".", ",") : String(c));

/** Découpe l'onglet « Indicateurs » en blocs : titre de section (en majuscules) puis tableau */
function sections(rows: Cell[][]) {
  const out: { title: string; rows: Cell[][] }[] = [];
  let cur: { title: string; rows: Cell[][] } | null = null;
  for (const r of rows.slice(5)) {
    const filled = r.filter((c) => c != null && c !== "");
    if (!filled.length) continue;
    const t = String(r[0] ?? "");
    if (filled.length === 1 && t === t.toUpperCase() && /[A-ZÉ]/.test(t)) {
      cur = { title: t, rows: [] };
      out.push(cur);
    } else if (cur) cur.rows.push(r);
    else {
      cur = { title: "INDICATEURS CLÉS", rows: [r] };
      out.push(cur);
    }
  }
  return out;
}

/** Construit le document (testable hors navigateur) */
export async function buildCongesPdf(sheets: Sheet[], label: string) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 10;
  const sheet = (n: string) => sheets.find((s) => s.name === n || s.name.startsWith(n));
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;
  const heading = (title: string, sub?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(title, M, 22);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(sub, M, 27.5);
    }
  };
  const base = {
    theme: "grid" as const,
    margin: { left: M, right: M, top: 18, bottom: 12 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.15, overflow: "linebreak" as const },
    headStyles: { fillColor: INK, textColor: [255, 255, 255] as RGB, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: SOFT },
  };

  /* ---- 1. Indicateurs ---- */
  const kpi = sheet("Indicateurs");
  const extraction = kpi?.rows[3]?.[1] ? `Extraction du ${txt(kpi.rows[3][1])}` : "";
  heading(`Planning et congés · ${label}`, [kpi?.rows[2] ? `Du ${txt(kpi.rows[2][1])} au ${txt(kpi.rows[2][3])}` : "", extraction].filter(Boolean).join("   ·   "));
  let y = 32;
  if (kpi) {
    const blocks = sections(kpi.rows).filter((b) => b.title !== "LÉGENDE DU PLANNING");
    // indicateurs clés : cartes chiffrées
    const key = blocks.find((b) => b.title === "INDICATEURS CLÉS");
    if (key) {
      const items = key.rows.slice(1).filter((r) => !String(r[0]).startsWith("   "));
      const cols = 5, gap = 3, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = 17;
      items.forEach((r, i) => {
        const x = M + (i % cols) * (cw + gap), yy = y + Math.floor(i / cols) * (ch + gap);
        doc.setFillColor(...SOFT);
        doc.setDrawColor(...LINE);
        doc.roundedRect(x, yy, cw, ch, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(txt(r[0]), cw - 5)[0], x + 2.5, yy + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...(/absentéisme|non planifiées|seuil/i.test(txt(r[0])) && Number(r[1]) > 0 ? BRAND : INK));
        doc.text(txt(r[1]), x + 2.5, yy + 12.5);
      });
      y += Math.ceil(items.length / cols) * (ch + gap) + 3;
    }
    const rest = blocks.filter((x) => x !== key && x.rows.length > 1);
    // « Par motif » et « Les plus absents » côte à côte : la page des indicateurs tient sur une page
    const pair = ["PAR MOTIF", "COLLABORATEURS LES PLUS ABSENTS"];
    const half = (W - 2 * M - 6) / 2;
    const draw = (b: (typeof rest)[number], left: number, width: number | "auto", startY: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...BRAND);
      doc.text(b.title, left, startY + 3);
      autoTable(doc, {
        ...base,
        startY: startY + 5,
        margin: { ...base.margin, left },
        head: [b.rows[0].map(txt)],
        body: b.rows.slice(1).map((r) => r.map(txt)),
        tableWidth: width,
      });
      return lastY();
    };
    for (const b of rest) {
      if (pair.includes(b.title) && b.title !== pair[0] && rest.some((x) => x.title === pair[0])) continue;
      if (y > H - 40) {
        doc.addPage();
        y = 22;
      }
      if (b.title === pair[0]) {
        const other = rest.find((x) => x.title === pair[1]);
        const y1 = draw(b, M, other ? half : Math.min(W - 2 * M, 190), y);
        const y2 = other ? draw(other, M + half + 6, half, y) : y1;
        y = Math.max(y1, y2) + 7;
        continue;
      }
      y = draw(b, M, b.title === "PAR ÉQUIPE" || b.title === "PAR MOIS" ? "auto" : Math.min(W - 2 * M, 190), y) + 7;
    }
  }

  /* ---- 2. Planning : un mois par page, cases colorées par motif ---- */
  const plan = sheet("Planning");
  if (plan && plan.rows.length > 2) {
    const head = plan.rows[0], dow = plan.rows[1], people = plan.rows.slice(2);
    const dayCols = head.map((_, i) => i).filter((i) => i >= 2 && i < head.length - 1);
    const byMonth = new Map<string, number[]>();
    dayCols.forEach((i) => {
      const m = String(head[i]).slice(3, 5);
      byMonth.set(m, [...(byMonth.get(m) || []), i]);
    });
    const legendItems = LEAVE_TYPES.map((t) => [t.k, t.label, t.color] as const);
    for (const [m, cols] of byMonth) {
      doc.addPage();
      const yr = label.match(/\d{4}/)?.[0] || "";
      heading(`Planning · ${MONTHS[Number(m) - 1]} ${yr}`.trim(), "Cases colorées par motif · « ? » : demande en attente · D : freelance déclenché · gris : week-end ou jour férié");
      const nameW = 38, totW = 14;
      const dayW = Math.min(7.6, (W - 2 * M - nameW - totW - 1) / cols.length);
      autoTable(doc, {
        ...base,
        startY: 31,
        styles: { ...base.styles, fontSize: 6.4, cellPadding: 0.8, halign: "center", valign: "middle", minCellHeight: 5.2 },
        headStyles: { ...base.headStyles, fontSize: 6.2 },
        alternateRowStyles: {},
        head: [
          ["Collaborateur", ...cols.map((i) => String(head[i]).slice(0, 2)), "Abs."],
          ["", ...cols.map((i) => (dow[i] === "Férié" ? "F" : txt(dow[i]))), ""],
        ],
        body: people.map((r) => {
          const n = cols.filter((i) => r[i] && r[i] !== "—" && r[i] !== "D" && !String(r[i]).endsWith("?")).length;
          return [`${txt(r[0])}\n${txt(r[1])}`, ...cols.map((i) => txt(r[i])), r[0] && String(r[0]).includes("(freelance)") ? "" : String(n)];
        }),
        columnStyles: { 0: { halign: "left", cellWidth: nameW, fontSize: 6.8 }, [cols.length + 1]: { cellWidth: totW, fontStyle: "bold" } },
        didParseCell: (d) => {
          if (d.column.index > 0 && d.column.index <= cols.length) d.cell.styles.cellWidth = dayW;
          if (d.section !== "body" || d.column.index === 0 || d.column.index > cols.length) return;
          const v = String(d.cell.raw || "");
          if (v === "—") {
            d.cell.styles.fillColor = [226, 221, 215];
            d.cell.text = [""];
          } else if (v === "D") {
            d.cell.styles.fillColor = [210, 236, 219];
            d.cell.styles.textColor = [29, 122, 70];
            d.cell.styles.fontStyle = "bold";
          } else if (v) {
            const code = v.replace("?", "") as keyof typeof LEAVE_COLOR;
            const c = LEAVE_COLOR[code];
            if (c) {
              const rgb = hex(c);
              if (v.endsWith("?")) {
                d.cell.styles.fillColor = rgb.map((x) => Math.round(255 - (255 - x) * 0.25)) as RGB;
                d.cell.styles.textColor = rgb;
              } else {
                d.cell.styles.fillColor = rgb;
                d.cell.styles.textColor = [255, 255, 255];
              }
              d.cell.styles.fontStyle = "bold";
            }
          }
        },
      });
      // légende
      let lx = M, ly = Math.min(lastY() + 6, H - 14);
      doc.setFontSize(7);
      for (const [k, l, c] of legendItems) {
        const w = doc.getTextWidth(`${k} ${l}`) + 8;
        if (lx + w > W - M) {
          lx = M;
          ly += 5;
        }
        doc.setFillColor(...hex(c));
        doc.roundedRect(lx, ly - 3, 3.5, 3.5, 0.6, 0.6, "F");
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "bold");
        doc.text(k, lx + 4.6, ly);
        doc.setFont("helvetica", "normal");
        doc.text(l, lx + 4.6 + doc.getTextWidth(k) + 1.2, ly);
        lx += w + 3;
      }
    }
  }

  /* ---- 3. Demandes et soldes ---- */
  for (const [n, title] of [["Demandes", "Demandes de congés sur la période"], ["Soldes", "Soldes de l'année"]] as const) {
    const s = sheet(n);
    if (!s || s.rows.length < 2) continue;
    doc.addPage();
    heading(title, `${s.rows.length - 1} ligne(s)`);
    autoTable(doc, { ...base, startY: 31, styles: { ...base.styles, fontSize: n === "Soldes" ? 7 : 8 }, head: [s.rows[0].map(txt)], body: s.rows.slice(1).map((r) => r.map(txt)) });
  }

  /* ---- en-tête et pied de page ---- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, W, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND);
    doc.text("CROUZIL BOISSONS · ESPACE EXPÉDITION", M, 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Planning et congés · ${label}`, W - M, 10, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.line(M, H - 8, W - M, H - 8);
    doc.setFontSize(7.5);
    doc.text(`Page ${p} / ${pages}`, W - M, H - 4.5, { align: "right" });
  }
  return doc;
}

export async function downloadCongesPdf(file: string, sheets: Sheet[], label: string) {
  (await buildCongesPdf(sheets, label)).save(`${file}.pdf`);
}
