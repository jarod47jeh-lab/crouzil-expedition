"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, CheckCheck, Pencil, RotateCcw, Route as RouteIcon, Repeat } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { usePerms } from "@/components/app/perms-context";
import { setNoteStatus } from "@/lib/actions/crud";
import { NOTE_KINDS, NOTE_LEVELS, NOTE_SOURCES, NOTE_STATUS } from "@/lib/domain/constants";
import { fmtDate, fmtShort } from "@/lib/domain/dates";
import type { DeliveryNote } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NoteCard({ n, i = 0, author, me, onEdit, compact }: { n: DeliveryNote; i?: number; author?: string; me?: string; onEdit?: (n: DeliveryNote) => void; compact?: boolean }) {
  const router = useRouter();
  const perms = usePerms();
  const [pending, start] = useTransition();
  const editor = perms.write("remontees");
  const mine = perms.role === "contributor" && n.created_by === me;
  const status = (s: "todo" | "ack" | "done") =>
    start(async () => {
      const r = await setNoteStatus([n.id], s);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Remontée : ${NOTE_STATUS[s].label.toLowerCase()}`);
      router.refresh();
    });
  const attn = n.level === "attention";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03 }}
      className={cn(
        "group rounded-2xl border border-l-[5px] bg-surface p-4 shadow-card",
        attn ? "border-line border-l-warn" : "border-line border-l-info",
        n.status === "done" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={NOTE_LEVELS[n.level].tone}>{NOTE_LEVELS[n.level].label}</Badge>
        <span className="text-xs font-semibold text-muted">{NOTE_KINDS[n.kind]}</span>
        {n.permanent ? (
          <Badge tone="violet">
            <Repeat className="h-3 w-3" /> Permanente{n.until_date && ` jusqu'au ${fmtShort(n.until_date)}`}
          </Badge>
        ) : n.due_date ? (
          <span className="text-xs font-semibold">{fmtDate(n.due_date)}</span>
        ) : null}
        <Badge tone={NOTE_STATUS[n.status].tone} dot className="ml-auto">
          {NOTE_STATUS[n.status].label}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        {n.client_name &&
          (n.client_id ? (
            <Link href={`/clients/${n.client_id}`} className="font-display text-[16px] font-bold hover:text-brand">
              {n.client_name}
            </Link>
          ) : (
            <span className="font-display text-[16px] font-bold">{n.client_name}</span>
          ))}
        {n.route && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <RouteIcon className="h-3 w-3" /> {n.route}
          </span>
        )}
      </div>
      <p className={cn("mt-1 whitespace-pre-wrap", compact ? "line-clamp-2 text-sm" : "text-[15px]")}>{n.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          {NOTE_SOURCES[n.source]}
          {n.source_name && ` · ${n.source_name}`}
          {author && ` · saisi par ${author}`}
        </span>
        <div className="ml-auto flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          {editor && n.status === "todo" && (
            <button disabled={pending} onClick={() => status("ack")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-info hover:bg-info/10">
              <Check className="h-3.5 w-3.5" /> Pris en compte
            </button>
          )}
          {editor && n.status !== "done" && (
            <button disabled={pending} onClick={() => status("done")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-ok hover:bg-ok/10">
              <CheckCheck className="h-3.5 w-3.5" /> Clore
            </button>
          )}
          {editor && n.status === "done" && (
            <button disabled={pending} onClick={() => status("todo")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-surface-2">
              <RotateCcw className="h-3.5 w-3.5" /> Rouvrir
            </button>
          )}
          {onEdit && (editor || mine) && (
            <button onClick={() => onEdit(n)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2 hover:text-brand" aria-label="Modifier">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
