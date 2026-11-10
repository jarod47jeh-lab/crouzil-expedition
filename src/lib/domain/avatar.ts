import type { Employee, Team } from "@/lib/types";

/** Avatar dessiné : tout est un indice dans les listes ci-dessous */
export interface AvatarStyle {
  skin: number;
  hair: number;
  hairColor: number;
  glasses?: boolean;
  beard?: boolean;
}

export const SKINS = ["#f7dcc8", "#efc4a1", "#dba67f", "#bd8459", "#8f5b3a", "#5f3b25"];
export const HAIR_COLORS = ["#231914", "#5a3a22", "#8a5a2b", "#c99a4b", "#a9a39d", "#e9e1d4"];
export const HAIRS = ["Court", "Long", "Chignon", "Rasé", "Bouclé", "Casquette"];
/** Tenue de l'équipe : polo rouge Crouzil pour les chauffeurs, marine pour les préparateurs… */
export const TEAM_SHIRT: Record<Team, string> = { chauf: "#ce0013", prep: "#1c2f5c", commande: "#2f7d55", bureau: "#3a3f4b" };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** Avatar enregistré, ou à défaut un avatar stable tiré du nom */
export function avatarOf(e: Pick<Employee, "name" | "avatar">): AvatarStyle {
  if (e.avatar && typeof e.avatar === "object") return e.avatar as AvatarStyle;
  const h = hash(e.name || "?");
  return { skin: h % 4, hair: (h >> 3) % 5, hairColor: (h >> 6) % 4, glasses: (h >> 9) % 5 === 0, beard: (h >> 11) % 4 === 0 && (h >> 3) % 5 !== 1 && (h >> 3) % 5 !== 2 };
}
