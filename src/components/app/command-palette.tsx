"use client";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, CornerDownLeft, Truck, UserRound, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV } from "./nav";

type Hit = { id: string; label: string; sub?: string; href: string; group: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const s = q.trim();
    if (s.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const sb = createClient();
      const like = `%${s.replace(/[%_,()]/g, " ")}%`;
      const [e, c, a, r] = await Promise.all([
        sb.from("employees").select("id,name,job_title").is("deleted_at", null).ilike("name", like).limit(6),
        sb.from("clients").select("id,name,route").is("deleted_at", null).ilike("name", like).limit(6),
        sb.from("assets").select("id,name,ref,designation").is("deleted_at", null).or(`name.ilike.${like},ref.ilike.${like},designation.ilike.${like}`).limit(6),
        sb.from("repairs").select("id,label,description").is("deleted_at", null).or(`label.ilike.${like},description.ilike.${like}`).limit(6),
      ]);
      setHits([
        ...(e.data || []).map((x) => ({ id: "e" + x.id, label: x.name, sub: x.job_title || "", href: `/equipe/${x.id}`, group: "Équipe" })),
        ...(c.data || []).map((x) => ({ id: "c" + x.id, label: x.name, sub: x.route || "", href: `/clients/${x.id}`, group: "Clients" })),
        ...(a.data || []).map((x) => ({ id: "a" + x.id, label: x.name, sub: [x.designation, x.ref].filter(Boolean).join(" · "), href: `/parc/${x.id}`, group: "Parc" })),
        ...(r.data || []).map((x) => ({ id: "r" + x.id, label: x.label, sub: (x.description || "").slice(0, 60), href: `/reparations/${x.id}`, group: "Réparations" })),
      ]);
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const icon = (g: string) => ({ Équipe: UserRound, Clients: Building2, Parc: Truck, Réparations: Wrench })[g] || UserRound;
  const groups = [...new Set(hits.map((h) => h.group))];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-pop"
          >
            <Command shouldFilter={false} loop onKeyDown={(e) => e.key === "Escape" && onClose()}>
              <Command.Input
                autoFocus
                value={q}
                onValueChange={setQ}
                placeholder="Rechercher ou aller à…"
                className="h-14 w-full border-b border-line bg-transparent px-5 text-[15px] outline-none placeholder:text-muted"
              />
              <Command.List className="max-h-[55vh] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted">Aucun résultat</Command.Empty>
                {groups.map((g) => (
                  <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted">
                    {hits
                      .filter((h) => h.group === g)
                      .map((h) => {
                        const I = icon(g);
                        return (
                          <Command.Item key={h.id} value={h.id} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-surface-2">
                            <I className="h-4 w-4 text-muted" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{h.label}</span>
                              {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                            </span>
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted opacity-0 [[data-selected=true]_&]:opacity-100" />
                          </Command.Item>
                        );
                      })}
                  </Command.Group>
                ))}
                <Command.Group heading="Aller à" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted">
                  {NAV.flatMap((g) => g.items)
                    .filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()))
                    .map((i) => (
                      <Command.Item key={i.href} value={"nav" + i.href} onSelect={() => go(i.href)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-surface-2">
                        <i.icon className="h-4 w-4 text-muted" />
                        {i.label}
                      </Command.Item>
                    ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
