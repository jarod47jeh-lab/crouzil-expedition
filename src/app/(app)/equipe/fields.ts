import type { FieldDef } from "@/components/ui/entity-form";
import type { Employee } from "@/lib/types";

export const EMPLOYEE_FIELDS: FieldDef[] = [
  { name: "name", label: "Nom affiché", required: true },
  { name: "job_title", label: "Fonction", placeholder: "Chauffeur-livreur" },
  { name: "team", label: "Équipe", type: "select", required: true, options: [["chauf", "Chauffeurs"], ["prep", "Préparateurs"]] },
  { name: "sort_order", label: "Ordre d'affichage", type: "number" },
  { name: "freelance", label: "Freelance (déclenché à la journée)", type: "checkbox", full: true },
  { name: "cp_annual", label: "CP annuels (jours)", type: "number", step: "0.5", when: (v) => !v.freelance },
  { name: "cp_carryover", label: "Report N-1 (jours)", type: "number", step: "0.5", when: (v) => !v.freelance },
  { name: "rtt_annual", label: "RTT annuels (jours)", type: "number", step: "0.5", when: (v) => !v.freelance },
  { name: "rec_due", label: "Récupération due (jours)", type: "number", step: "0.5", when: (v) => !v.freelance },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "hired_on", label: "Date d'entrée", type: "date" },
  { name: "active", label: "Toujours dans l'équipe", type: "checkbox" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const employeeInitial = (e: Employee | null): Record<string, unknown> =>
  e
    ? { ...e }
    : { team: "chauf", freelance: false, cp_annual: 25, cp_carryover: 0, rtt_annual: 10, rec_due: 0, active: true, sort_order: 0 };
