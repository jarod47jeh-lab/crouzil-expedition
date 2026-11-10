"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Menu, Moon, Search, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { ADMIN, SPACES, isActive, spaceOf, type Badge, type NavItem, type Space } from "./nav";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";
import { usePerms } from "./perms-context";
import { QuickCreateButton, QuickCreateFab } from "./quick-create";

type Badges = Record<Badge, number>;

export function Shell({ children, user, badges }: { children: React.ReactNode; user: { name: string; email: string }; badges: Badges }) {
  const path = usePathname();
  const perms = usePerms();
  const visible = (m: NavItem["module"]) => !m || (m === "admin" ? perms.admin : perms.read(m));
  const spaces = SPACES.map((s) => ({ ...s, items: s.items.filter((i) => visible(i.module)) })).filter((s) => s.items.length);
  const admin = perms.admin ? ADMIN : null;
  const current = spaceOf(path);
  const currentItems = spaces.find((s) => s.key === current?.key)?.items || (current?.key === "admin" ? ADMIN.items : []);
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

  const count = (s: Space) => s.items.reduce((n, i) => n + (i.badge ? badges[i.badge] : 0), 0);

  const nav = (
    <nav className="flex flex-col gap-4 px-3 pb-4" aria-label="Menu principal">
      {spaces.map((s) => (
        <SpaceGroup key={s.key} s={s} path={path} badges={badges} />
      ))}
      {admin && <AdminGroup path={path} />}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-3 px-5 pt-5 pb-4">
      <Logo className="h-11 w-11 shrink-0 drop-shadow-sm" />
      <div className="min-w-0">
        <p className="font-display text-[17px] leading-tight font-extrabold tracking-tight">Espace Expédition</p>
        <p className="text-xs text-muted">Crouzil Boissons · Ayguesvives</p>
      </div>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
        {brand}
        {nav}
        <div className="mt-auto px-3 pb-4">
          <UserBox user={user} />
        </div>
      </aside>

      {/* Menu complet sur téléphone (administration comprise) */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-[290px] flex-col overflow-y-auto bg-surface shadow-pop"
              initial={{ x: -310 }}
              animate={{ x: 0 }}
              exit={{ x: -310 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="flex items-center justify-between pr-3">
                {brand}
                <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2" onClick={() => setOpen(false)} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <div className="mt-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <UserBox user={user} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="shrink-0 lg:hidden" aria-label="Accueil">
              <Logo className="h-9 w-9" />
            </Link>
            <button
              onClick={() => setCmd(true)}
              className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-muted transition-colors hover:border-brand/40 sm:max-w-md"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Rechercher…</span>
                <span className="hidden sm:inline">Chercher un collaborateur, un client, un véhicule…</span>
              </span>
              <kbd className="ml-auto hidden rounded-md border border-line bg-surface-2 px-1.5 text-[11px] font-semibold sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <QuickCreateButton />
              <ThemeToggle />
              <Link href="/compte" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink lg:hidden" aria-label="Mon compte">
                <UserRound className="h-5 w-5" />
              </Link>
            </div>
          </div>
          {/* Pages de l'espace courant, sur téléphone */}
          {currentItems.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] lg:hidden">
              {currentItems.map((i) => {
                const on = isActive(path, i.href);
                const n = i.badge ? badges[i.badge] : 0;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                      on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-muted",
                    )}
                  >
                    {i.label}
                    {n > 0 && <span className={cn("rounded-full px-1.5 text-[10px] leading-4", on ? "bg-bg text-ink" : "bg-brand text-brand-ink")}>{n}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1360px] px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
          <motion.div key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </main>
      </div>

      {/* Barre d'onglets par espace, sur téléphone */}
      <nav
        aria-label="Espaces"
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        style={{ gridTemplateColumns: `repeat(${spaces.length}, minmax(0,1fr))` }}
      >
        {spaces.map((s) => {
          const on = current?.key === s.key;
          const n = count(s);
          return (
            <Link key={s.key} href={s.items[0].href} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", on ? "text-brand" : "text-muted")}>
              {on && <motion.span layoutId="tab-on" className="absolute top-0 h-[3px] w-10 rounded-b-full bg-brand" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">
                <s.icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.8} />
                {n > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 text-brand-ink">{n}</span>}
              </span>
              <span className="max-w-full truncate px-0.5">{s.short}</span>
            </Link>
          );
        })}
      </nav>
      {path !== "/signaler" && <QuickCreateFab />}
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}

function NavLink({ i, path, badges, layout }: { i: NavItem; path: string; badges: Badges; layout: string }) {
  const active = isActive(path, i.href);
  const n = i.badge ? badges[i.badge] : 0;
  return (
    <li>
      <Link
        href={i.href}
        aria-current={active ? "page" : undefined}
        className={cn("relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors", active ? "text-brand" : "text-muted hover:bg-surface-2 hover:text-ink")}
      >
        {active && <motion.span layoutId={layout} className="absolute inset-0 rounded-xl bg-brand/8" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
        <i.icon className="relative h-[18px] w-[18px]" />
        <span className={cn("relative flex-1 truncate", active && "font-semibold")}>{i.label}</span>
        {n > 0 && <span className="relative rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-brand-ink">{n}</span>}
      </Link>
    </li>
  );
}

function SpaceGroup({ s, path, badges }: { s: Space; path: string; badges: Badges }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 px-3 text-[11px] font-bold tracking-[0.09em] text-muted/80 uppercase">
        <s.icon className="h-3.5 w-3.5" /> {s.title}
      </p>
      <ul className="grid gap-0.5">
        {s.items.map((i) => (
          <NavLink key={i.href} i={i} path={path} badges={badges} layout="nav-on" />
        ))}
      </ul>
    </div>
  );
}

function AdminGroup({ path }: { path: string }) {
  const inside = ADMIN.items.some((i) => isActive(path, i.href));
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  return (
    <div className="border-t border-line pt-3">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg px-3 py-1 text-[11px] font-bold tracking-[0.09em] text-muted/80 uppercase hover:text-ink">
        <ADMIN.icon className="h-3.5 w-3.5" /> {ADMIN.title}
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1 grid gap-0.5 overflow-hidden">
            {ADMIN.items.map((i) => (
              <NavLink key={i.href} i={i} path={path} badges={{ leaves: 0, repairs: 0, notes: 0, tasks: 0 }} layout="nav-on" />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserBox({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg p-2">
      <Link href="/compte" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand font-bold text-brand-ink">{(user.name || user.email).charAt(0).toUpperCase()}</span>
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
    <button onClick={toggle} className="hidden h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink sm:grid" aria-label="Changer de thème">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(dark)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
