import type { ModuleKey } from "@/lib/perms";
import {
  Megaphone,
  LayoutDashboard, CalendarCheck2, Wrench, PackageX, NotebookPen, Users, Truck, Building2, History, Trash2, ShieldCheck, Settings2,
} from "lucide-react";

export const NAV = [
  {
    title: "Pilotage",
    items: [{ href: "/", label: "Tableau de bord", icon: LayoutDashboard, badge: undefined as undefined | "leaves" | "repairs" | "notes", module: undefined as undefined | ModuleKey | "admin" }],
  },
  {
    title: "Opérations",
    items: [
      { href: "/remontees", label: "Remontées livraison", icon: Megaphone, badge: "notes" as const, module: "remontees" as const },
      { href: "/conges", label: "Présences et congés", icon: CalendarCheck2, badge: "leaves" as const, module: "conges" as const },
      { href: "/reparations", label: "Réparations", icon: Wrench, badge: "repairs" as const, module: "reparations" as const },
      { href: "/erreurs", label: "Erreurs de livraison", icon: PackageX, badge: undefined, module: "erreurs" as const },
      { href: "/journal", label: "Journal de bord", icon: NotebookPen, badge: undefined, module: "journal" as const },
    ],
  },
  {
    title: "Référentiels",
    items: [
      { href: "/equipe", label: "Équipe", icon: Users, badge: undefined, module: "equipe" as const },
      { href: "/parc", label: "Parc et matériel", icon: Truck, badge: undefined, module: "parc" as const },
      { href: "/clients", label: "Clients", icon: Building2, badge: undefined, module: "clients" as const },
    ],
  },
  {
    title: "Administration",
    items: [
      { module: "admin" as const, href: "/historique", label: "Historique", icon: History, badge: undefined },
      { module: "admin" as const, href: "/corbeille", label: "Corbeille", icon: Trash2, badge: undefined },
      { module: "admin" as const, href: "/utilisateurs", label: "Utilisateurs", icon: ShieldCheck, badge: undefined },
      { module: "admin" as const, href: "/reglages", label: "Réglages", icon: Settings2, badge: undefined },
    ],
  },
];
