import type { FieldDef } from "@/components/ui/entity-form";

export const CLIENT_FIELDS: FieldDef[] = [
  { name: "name", label: "Nom du client", required: true, full: true },
  { name: "contact_name", label: "Contact" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "route", label: "Tournée habituelle", placeholder: "TM10" },
  { name: "address", label: "Adresse", type: "textarea" },
  { name: "notes", label: "Notes (consignes de livraison, horaires, accès…)", type: "textarea" },
];
