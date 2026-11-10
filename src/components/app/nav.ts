import type { ModuleKey } from "@/lib/perms";
import {
  Megaphone, LayoutDashboard, CalendarCheck2, Wrench, PackageX, NotebookPen, Users, Truck, Building2, History, Trash2, ShieldCheck, Settings2,
  ListTodo, Sun, Warehouse, UsersRound, CheckSquare, HardHat, type LucideIcon,
} from "lucide-react";

export type Badge = "leaves" | "repairs" | "notes" | "tasks";
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: Badge;
  module?: ModuleKey | "admin";
}
export interface Space {
  key: string;
  title: string;
  /** Nom court pour la barre d'onglets du téléphone */
  short: string;
  icon: LucideIcon;
  items: NavItem[];
}

/** Espaces métier : l'appli est organisée par usage, pas par table. */
export const SPACES: Space[] = [
  { key: "jour", title: "Aujourd'hui", short: "Aujourd'hui", icon: Sun, items: [{ href: "/", label: "Accueil", icon: LayoutDashboard }] },
  {
    key: "livraisons",
    title: "Livraisons",
    short: "Livraisons",
    icon: Truck,
    items: [
      { href: "/remontees", label: "Remontées clients", icon: Megaphone, badge: "notes", module: "remontees" },
      { href: "/erreurs", label: "Erreurs et conformité", icon: PackageX, module: "erreurs" },
      { href: "/clients", label: "Clients", icon: Building2, module: "clients" },
    ],
  },
  {
    key: "depot",
    title: "Dépôt",
    short: "Dépôt",
    icon: Warehouse,
    items: [
      { href: "/depot", label: "Plan du dépôt", icon: Warehouse, module: "parc" },
      { href: "/parc", label: "Véhicules et matériel", icon: Truck, module: "parc" },
      { href: "/reparations", label: "Réparations", icon: Wrench, badge: "repairs", module: "reparations" },
    ],
  },
  {
    key: "equipes",
    title: "Équipes",
    short: "Équipes",
    icon: UsersRound,
    items: [
      { href: "/conges", label: "Planning et congés", icon: CalendarCheck2, badge: "leaves", module: "conges" },
      { href: "/equipe", label: "Collaborateurs", icon: Users, module: "equipe" },
      { href: "/equipements", label: "Tenues et équipements", icon: HardHat, module: "equipe" },
    ],
  },
  {
    key: "actions",
    title: "Actions",
    short: "Actions",
    icon: CheckSquare,
    items: [
      { href: "/taches", label: "To do list", icon: ListTodo, badge: "tasks", module: "taches" },
      { href: "/journal", label: "Journal de bord", icon: NotebookPen, module: "journal" },
    ],
  },
];

export const ADMIN: Space = {
  key: "admin",
  title: "Administration",
  short: "Admin",
  icon: ShieldCheck,
  items: [
    { module: "admin", href: "/utilisateurs", label: "Utilisateurs et droits", icon: ShieldCheck },
    { module: "admin", href: "/reglages", label: "Réglages", icon: Settings2 },
    { module: "admin", href: "/historique", label: "Historique", icon: History },
    { module: "admin", href: "/corbeille", label: "Corbeille", icon: Trash2 },
  ],
};

/** Ancien format, utilisé par la recherche */
export const NAV = [...SPACES, ADMIN].map((s) => ({ title: s.title, items: s.items }));

export const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
export const spaceOf = (path: string) => [...SPACES, ADMIN].find((s) => s.items.some((i) => isActive(path, i.href)));
