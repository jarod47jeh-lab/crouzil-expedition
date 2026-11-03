"use client";
import { usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronRight, Download, FileSpreadsheet, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn, norm } from "@/lib/utils";
import { restoreRow, trashRows } from "@/lib/actions/crud";
import { Button } from "./button";
import { Empty } from "./card";

export interface Column<T> {
  key: string;
  header: string;
  cell: (r: T) => React.ReactNode;
  sort?: (r: T) => string | number | null | undefined;
  exportValue?: (r: T) => string | number | null | undefined;
  className?: string;
  hideOnMobile?: boolean;
}

export interface Filter<T> {
  key: string;
  label: string;
  options: [string, string][];
  value: (r: T) => string | string[];
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  filters = [],
  rowHref,
  onEdit,
  table,
  exportName,
  toolbar,
  empty = "Aucun élément",
  initialSort,
  pageSize = 50,
  dense,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText?: (r: T) => string;
  filters?: Filter<T>[];
  rowHref?: (r: T) => string;
  onEdit?: (r: T) => void;
  table?: string;
  exportName?: string;
  toolbar?: React.ReactNode;
  empty?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  dense?: boolean;
}) {
  const router = useRouter();
  const perms = usePerms();
  const writable = table ? perms.writeTable(table) : true;
  if (!writable) {
    onEdit = undefined;
    table = undefined;
  }
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort);
  const [limit, setLimit] = useState(pageSize);
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    let out = rows.filter((r) => {
      if (nq && searchText && !norm(searchText(r)).includes(nq)) return false;
      for (const fl of filters) {
        const want = f[fl.key];
        if (!want) continue;
        const v = fl.value(r);
        if (Array.isArray(v) ? !v.includes(want) : v !== want) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const s = col.sort;
        out = [...out].sort((a, b) => {
          const x = s(a) ?? "", y = s(b) ?? "";
          const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true });
          return sort.dir === "asc" ? c : -c;
        });
      }
    }
    return out;
  }, [rows, q, f, sort, columns, filters, searchText]);

  const doExport = async (kind: "csv" | "xlsx") => {
    const cols = columns.filter((c) => c.exportValue || c.sort);
    const data = filtered.map((r) => Object.fromEntries(cols.map((c) => [c.header, (c.exportValue || c.sort)!(r) ?? ""])));
    const name = `${exportName || "export"}-${new Date().toISOString().slice(0, 10)}`;
    if (kind === "xlsx") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");
      XLSX.writeFile(wb, name + ".xlsx");
    } else {
      const head = cols.map((c) => c.header);
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [head.map(esc).join(";"), ...data.map((d) => head.map((h) => esc(d[h])).join(";"))].join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = name + ".csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const remove = (r: T) => {
    if (!table) return;
    start(async () => {
      const res = await trashRows(table, [r.id]);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Mis à la corbeille", {
        action: {
          label: "Annuler",
          onClick: async () => {
            const u = await restoreRow(table, r.id);
            if (u.ok) toast.success("Restauré");
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  };

  const actionsCol = !!(onEdit || table);
  const visible = filtered.slice(0, limit);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {searchText && (
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="field h-9 min-h-0 pl-9 text-sm" />
          </div>
        )}
        {filters.map((fl) => (
          <select
            key={fl.key}
            value={f[fl.key] || ""}
            onChange={(e) => setF((o) => ({ ...o, [fl.key]: e.target.value }))}
            className={cn("field h-9 min-h-0 w-auto pr-8 text-sm", f[fl.key] && "border-brand/50 bg-brand/5")}
            aria-label={fl.label}
          >
            <option value="">{fl.label} : tous</option>
            {fl.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ))}
        <span className="text-xs text-muted">
          {filtered.length} / {rows.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {exportName && (
            <>
              <Button variant="ghost" size="sm" onClick={() => doExport("xlsx")} title="Exporter en Excel">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => doExport("csv")} title="Exporter en CSV">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </>
          )}
          {toolbar}
        </div>
      </div>
      {filtered.length === 0 ? (
        <Empty title={rows.length ? "Aucun résultat avec ces filtres" : empty} />
      ) : (
        <div className="overflow-x-auto [contain:paint]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-[12px] font-semibold tracking-wide text-muted uppercase">
                {columns.map((c) => (
                  <th key={c.key} className={cn("px-4 py-2.5 whitespace-nowrap", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                    {c.sort ? (
                      <button
                        className="inline-flex items-center gap-1 uppercase hover:text-ink"
                        onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }))}
                      >
                        {c.header}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {(actionsCol || rowHref) && <th className="w-px" />}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {visible.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.015 } }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn("group border-b border-line/70 last:border-0 hover:bg-surface-2/60", rowHref && "cursor-pointer")}
                    onClick={(e) => {
                      if (!rowHref) return;
                      if ((e.target as HTMLElement).closest("button,a,input,select")) return;
                      router.push(rowHref(r));
                    }}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 align-middle", dense ? "py-2" : "py-3", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                    {(actionsCol || rowHref) && (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          {onEdit && (
                            <button onClick={() => onEdit(r)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface hover:text-brand" title="Modifier" aria-label="Modifier">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {table && (
                            <button onClick={() => remove(r)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface hover:text-bad" title="Supprimer" aria-label="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {rowHref && (
                            <Link href={rowHref(r)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface" aria-label="Ouvrir">
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > limit && (
        <div className="border-t border-line p-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + pageSize)}>
            Afficher plus ({filtered.length - limit} restants)
          </Button>
        </div>
      )}
    </div>
  );
}
