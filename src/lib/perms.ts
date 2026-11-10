export type Role = "admin" | "editor" | "contributor" | "reader";
export type ModuleKey = "conges" | "reparations" | "erreurs" | "remontees" | "journal" | "taches" | "equipe" | "parc" | "clients";

export const ROLES: Record<Role, { label: string; help: string }> = {
  admin: { label: "Administrateur", help: "Tout, y compris utilisateurs, réglages, historique complet et corbeille" },
  editor: { label: "Éditeur", help: "Crée, modifie et supprime dans ses menus" },
  contributor: { label: "Contributeur", help: "Ajoute des remontées livraison, consulte le reste de ses menus" },
  reader: { label: "Lecteur", help: "Consulte seulement" },
};

export const MODULES: { key: ModuleKey; label: string; href: string }[] = [
  { key: "remontees", label: "Remontées livraison", href: "/remontees" },
  { key: "conges", label: "Présences et congés", href: "/conges" },
  { key: "reparations", label: "Réparations", href: "/reparations" },
  { key: "erreurs", label: "Erreurs de livraison", href: "/erreurs" },
  { key: "journal", label: "Journal de bord", href: "/journal" },
  { key: "taches", label: "To do list", href: "/taches" },
  { key: "equipe", label: "Équipe", href: "/equipe" },
  { key: "parc", label: "Parc et matériel", href: "/parc" },
  { key: "clients", label: "Clients", href: "/clients" },
];

export const ADMIN_PATHS = ["/historique", "/corbeille", "/utilisateurs", "/reglages"];

/** Table de la base -> menu qui la gouverne (écriture) */
export const TABLE_MODULE: Record<string, ModuleKey | "any"> = {
  employees: "equipe",
  leave_requests: "conges",
  assets: "parc",
  repairs: "reparations",
  clients: "clients",
  delivery_errors: "erreurs",
  journal_entries: "journal",
  delivery_notes: "remontees",
  tasks: "taches",
  equipment_items: "equipe",
  equipment_issues: "equipe",
  announcements: "any",
};

export interface Perms {
  role: Role;
  modules: ModuleKey[] | null;
}

export const isAdmin = (p: Perms) => p.role === "admin";
export const canRead = (p: Perms, m: ModuleKey) => p.role === "admin" || p.modules == null || p.modules.includes(m);
export const canWrite = (p: Perms, m: ModuleKey | "any") =>
  (p.role === "admin" || p.role === "editor") && (m === "any" || canRead(p, m));
export const canContribute = (p: Perms) => canRead(p, "remontees") && p.role !== "reader";
