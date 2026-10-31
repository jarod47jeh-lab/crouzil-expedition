"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, Moon, Search, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { NAV } from "./nav";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";

export function Shell({
  children,
  user,
  badges,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  badges: { leaves: number; repairs: number };
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [cmd, setCmd] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-5 px-3 pb-6">
      {NAV.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-muted/80 uppercase">{g.title}</p>
          <ul className="grid gap-0.5">
            {g.items.map((it) => {
              const active = isActive(it.href);
              const n = it.badge ? badges[it.badge] : 0;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                      active ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl border border-line bg-surface shadow-card"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    {active && <motion.span layoutId="nav-bar" className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" />}
                    <it.icon className={cn("relative h-[18px] w-[18px]", active && "text-brand")} />
                    <span className="relative flex-1 truncate">{it.label}</span>
                    {n > 0 && <span className="relative rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-brand-ink">{n}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-3 px-5 py-5">
      <Logo className="h-10 w-10 shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-[17px] leading-tight font-bold">Espace Expédition</p>
        <p className="text-xs text-muted">Crouzil Boissons</p>
      </div>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface-2/40 lg:flex">
        {brand}
        {nav}
        <div className="mt-auto px-3 pb-4">
          <UserBox user={user} />
        </div>
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-[284px] flex-col overflow-y-auto bg-bg shadow-pop"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="flex items-center justify-between pr-3">
                {brand}
                <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface-2" onClick={() => setOpen(false)} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <div className="mt-auto px-3 pb-4">
                <UserBox user={user} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCmd(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-muted shadow-card transition-colors hover:border-brand/40 sm:max-w-md"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Rechercher un collaborateur, un client, un véhicule…</span>
            <kbd className="ml-auto hidden rounded-md border border-line bg-surface-2 px-1.5 text-[11px] font-semibold sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <motion.div key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}

function UserBox({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card">
      <Link href="/compte" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/12 font-bold text-brand">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </Link>
      <form action={signOut}>
        <button className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-bad" title="Se déconnecter" aria-label="Se déconnecter">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const d = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", d);
    try {
      localStorage.setItem("theme", d ? "dark" : "light");
    } catch {}
    setDark(d);
  };
  return (
    <>
      <Link href="/compte" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink lg:hidden" aria-label="Mon compte">
        <UserRound className="h-5 w-5" />
      </Link>
      <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink" aria-label="Changer de thème">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={String(dark)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </>
  );
}
