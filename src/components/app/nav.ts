import {
  LayoutDashboard, CalendarCheck2, Wrench, PackageX, NotebookPen, Users, Truck, Building2, History, Trash2, ShieldCheck, Settings2,
} from "lucide-react";

export const NAV = [
  {
    title: "Pilotage",
    items: [{ href: "/", label: "Tableau de bord", icon: LayoutDashboard, badge: undefined as undefined | "leaves" | "repairs" }],
  },
  {
    title: "Opérations",
    items: [
      { href: "/conges", label: "Présences et congés", icon: CalendarCheck2, badge: "leaves" as const },
      { href: "/reparations", label: "Réparations", icon: Wrench, badge: "repairs" as const },
      { href: "/erreurs", label: "Erreurs de livraison", icon: PackageX, badge: undefined },
      { href: "/journal", label: "Journal de bord", icon: NotebookPen, badge: undefined },
    ],
  },
  {
    title: "Référentiels",
    items: [
      { href: "/equipe", label: "Équipe", icon: Users, badge: undefined },
      { href: "/parc", label: "Parc et matériel", icon: Truck, badge: undefined },
      { href: "/clients", label: "Clients", icon: Building2, badge: undefined },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/historique", label: "Historique", icon: History, badge: undefined },
      { href: "/corbeille", label: "Corbeille", icon: Trash2, badge: undefined },
      { href: "/utilisateurs", label: "Utilisateurs", icon: ShieldCheck, badge: undefined },
      { href: "/reglages", label: "Réglages", icon: Settings2, badge: undefined },
    ],
  },
];
