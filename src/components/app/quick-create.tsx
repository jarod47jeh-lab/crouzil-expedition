"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Camera, ListPlus, Megaphone, NotebookPen, Plus, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePerms } from "./perms-context";

/** Menu « Nouveau » : créer vite depuis n'importe quelle page */
export function useQuickItems() {
  const p = usePerms();
  return [
    { href: "/signaler", label: "Signaler avec une photo", sub: "Pneu, casse, choc… depuis le téléphone", icon: Camera, ok: p.write("reparations") },
    { href: "/remontees?new=1", label: "Remontée livraison", sub: "Consigne d'un client ou d'un commercial", icon: Megaphone, ok: p.contribute },
    { href: "/taches?new=1", label: "Tâche", sub: "Dans la to do list", icon: ListPlus, ok: p.write("taches") },
    { href: "/conges?new=1", label: "Demande de congé", sub: "Pour un collaborateur", icon: CalendarPlus, ok: p.write("conges") },
    { href: "/reparations?new=1", label: "Réparation", sub: "Sans photo, depuis le bureau", icon: Wrench, ok: p.write("reparations") },
    { href: "/journal?new=1", label: "Note de journal", sub: "Événement, incident, remarque", icon: NotebookPen, ok: p.write("journal") },
  ].filter((i) => i.ok);
}

function Menu({ onClose, className }: { onClose: () => void; className?: string }) {
  const items = useQuickItems();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      className={cn("w-[300px] rounded-2xl border border-line bg-surface p-1.5 shadow-pop", className)}
      role="menu"
    >
      {items.map((i) => (
        <Link key={i.href} href={i.href} onClick={onClose} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <i.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{i.label}</span>
            <span className="block truncate text-xs text-muted">{i.sub}</span>
          </span>
        </Link>
      ))}
    </motion.div>
  );
}

/** Bouton « Nouveau » de la barre du haut (ordinateur) */
export function QuickCreateButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = useQuickItems();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink shadow-sm transition hover:brightness-110 active:scale-[0.97]"
      >
        <Plus className="h-4 w-4" /> Nouveau
      </button>
      <AnimatePresence>{open && <Menu onClose={() => setOpen(false)} className="absolute top-12 right-0 z-50 origin-top-right" />}</AnimatePresence>
    </div>
  );
}

/** Bouton rond « + » au-dessus de la barre d'onglets (téléphone) */
export function QuickCreateFab() {
  const [open, setOpen] = useState(false);
  const items = useQuickItems();
  if (!items.length) return null;
  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <Menu onClose={() => setOpen(false)} className="absolute right-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] origin-bottom-right" />
          </div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer" : "Nouveau"}
        aria-expanded={open}
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-ink shadow-[0_12px_28px_-8px_rgb(206_0_19/0.6)] lg:hidden"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
          {open ? <X className="h-6 w-6 -rotate-45" /> : <Plus className="h-6 w-6" />}
        </motion.span>
      </motion.button>
    </>
  );
}
