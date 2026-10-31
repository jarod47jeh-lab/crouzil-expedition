import type { AssetKind, LeaveStatus, LeaveType, RepairStatus, Urgency } from "@/lib/types";

export const LEAVE_TYPES: { k: LeaveType; label: string; color: string }[] = [
  { k: "CP", label: "Congés payés", color: "#2F6FDE" },
  { k: "RTT", label: "RTT", color: "#0E9AA7" },
  { k: "REC", label: "Récupération", color: "#6B4FC8" },
  { k: "MAL", label: "Maladie / arrêt", color: "#C93022" },
  { k: "FOR", label: "Formation", color: "#B7791F" },
  { k: "EVT", label: "Événement familial", color: "#D6457F" },
  { k: "CSS", label: "Congé sans solde", color: "#6B7588" },
  { k: "AUI", label: "Absence injustifiée", color: "#8A1C1C" },
  { k: "RDV", label: "RDV médical", color: "#23853F" },
  { k: "ABS", label: "Absent", color: "#E8590C" },
];
export const LEAVE_LABEL = Object.fromEntries(LEAVE_TYPES.map((t) => [t.k, t.label])) as Record<LeaveType, string>;
export const LEAVE_COLOR = Object.fromEntries(LEAVE_TYPES.map((t) => [t.k, t.color])) as Record<LeaveType, string>;

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  pending: { label: "En attente", tone: "warn" },
  approved: { label: "Validé", tone: "ok" },
  rejected: { label: "Refusé", tone: "muted" },
};

export const TEAMS = { chauf: "Chauffeurs", prep: "Préparateurs" } as const;

export const ASSET_KINDS: Record<AssetKind, { label: string; plural: string }> = {
  VEH: { label: "Véhicule", plural: "Véhicules" },
  TRP: { label: "Transpalette", plural: "Transpalettes" },
  DIA: { label: "Diable", plural: "Diables" },
  MAN: { label: "Autre matériel", plural: "Autre matériel" },
};

export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "brand" | "violet";

export const REPAIR_STATUS: Record<RepairStatus, { label: string; tone: Tone }> = {
  A: { label: "À traiter", tone: "warn" },
  T: { label: "Transmis", tone: "info" },
  V: { label: "Validé", tone: "ok" },
  R: { label: "En réparation", tone: "brand" },
  F: { label: "Terminé", tone: "muted" },
  X: { label: "Refusé", tone: "muted" },
};
export const REPAIR_OPEN: RepairStatus[] = ["A", "T", "V", "R"];
export const REPAIR_CATS = ["Panne", "Casse", "Usure", "Sécurité", "Entretien", "Autre"];
export const URGENCIES: Urgency[] = ["Bloquant", "Urgent", "Normal"];
export const URGENCY_TONE: Record<Urgency, Tone> = { Bloquant: "bad", Urgent: "warn", Normal: "muted" };

export const ERROR_TYPES = [
  "Manquant", "Produit en trop", "Erreur produit (mauvais article)", "Casse", "Livraison non conforme",
  "DLUO / périmé", "Marchandise défectueuse", "Erreur de commande client", "Pas de reprise vide", "Chargement", "Autre", "Inconnu",
];
export const ERROR_ORIGINS = [
  "Intégration Préparateur", "Livreur", "Plan de chargement", "Intégration Commercial", "Intégration Télévendeur",
  "Web (commande client)", "Commande SMS", "Commande papier", "Dépose palette", "Palette pas ou non filmé", "Remplacement refusé", "Inconnu",
];
export const isPickerOrigin = (o?: string | null) => /Pr[ée]parateur/.test(o || "");
export const isDriverOrigin = (o?: string | null) => o === "Livreur";

export const JUSTIF_QUESTIONS: [key: string, label: string][] = [
  ["q_ordre", "A-t-on demandé à l'employé de remplacer ou modifier le produit ?"],
  ["q_accord", "Le client avait-il été prévenu et avait-il donné son accord ?"],
  ["q_double", "L'employé a-t-il fait une double vérification (bon de préparation, scan, pointage) ?"],
  ["q_bon", "Le produit figurait-il sur le bon ou la commande tels que reçus ?"],
  ["q_rupture", "Y avait-il une rupture ou un produit indisponible ?"],
  ["q_consigne", "La consigne ou la procédure était-elle connue et claire ?"],
];
export const JUSTIF_CONCLUSIONS: Record<string, { label: string; tone: Tone }> = {
  "": { label: "À instruire", tone: "info" },
  imput: { label: "Imputable", tone: "bad" },
  partag: { label: "Partagée", tone: "info" },
  nonimp: { label: "Non imputable", tone: "ok" },
};

export const JOURNAL_CATS = {
  evt: { label: "Événement", tone: "info" as Tone },
  rem: { label: "Remarque", tone: "warn" as Tone },
  note: { label: "Note", tone: "violet" as Tone },
  inc: { label: "Incident", tone: "bad" as Tone },
};

export const ANNOUNCEMENT_KINDS = {
  prio: { label: "Priorité", tone: "bad" as Tone },
  new: { label: "Nouveauté", tone: "ok" as Tone },
  info: { label: "Info", tone: "info" as Tone },
};

export const TABLE_LABELS: Record<string, string> = {
  employees: "Collaborateur",
  leave_requests: "Congé",
  day_marks: "Planning",
  freelance_calls: "Freelance",
  assets: "Parc",
  repairs: "Réparation",
  clients: "Client",
  delivery_errors: "Erreur de livraison",
  delivery_volumes: "Volume livré",
  error_justifications: "Justification",
  journal_entries: "Journal",
  announcements: "À la une",
  settings: "Réglages",
};
