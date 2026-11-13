import type { Employee, Team } from "@/lib/types";

export type Gender = "F" | "H";

/** Avatar dessiné : tout est un indice dans les listes ci-dessous */
export interface AvatarStyle {
  skin: number;
  hair: number;
  hairColor: number;
  glasses?: boolean;
  beard?: boolean;
  /** Barbe de quelques jours */
  stubble?: boolean;
  mustache?: boolean;
  /** Femme ou homme : sert à proposer des coiffures et à générer l'avatar par défaut */
  gender?: Gender;
  /** Modèle d'origine, pour l'afficher dans l'éditeur */
  preset?: string;
}

export const SKINS = ["#f7dcc8", "#efc4a1", "#dba67f", "#bd8459", "#8f5b3a", "#5f3b25"];
/** Les indices existants ne bougent pas (avatars déjà enregistrés) : on ajoute en fin de liste */
export const HAIR_COLORS = ["#231914", "#5a3a22", "#8a5a2b", "#c99a4b", "#a9a39d", "#e9e1d4", "#a4492a", "#e6c57a"];
export const HAIRS = ["Court", "Long", "Chignon", "Rasé", "Bouclé", "Casquette", "Carré", "Afro", "Queue de cheval", "Dégarni", "Tresses"];
/** Coiffures proposées en premier selon le genre (toutes restent possibles) */
export const HAIRS_BY_GENDER: Record<Gender, number[]> = { H: [0, 3, 9, 4, 7, 5, 1, 10], F: [1, 6, 8, 2, 4, 7, 10, 0] };
/** Tenue de l'équipe : polo rouge Crouzil pour les chauffeurs, marine pour les préparateurs… */
export const TEAM_SHIRT: Record<Team, string> = { chauf: "#ce0013", prep: "#1c2f5c", commande: "#2f7d55", bureau: "#3a3f4b" };

/** Modèles inspirés de personnalités, dessinés au même style simple que les autres avatars */
export interface AvatarPreset {
  id: string;
  label: string;
  hint: string;
  style: AvatarStyle;
}
export const PRESETS: AvatarPreset[] = [
  { id: "zidane", label: "Zinédine Zidane", hint: "Football", style: { gender: "H", skin: 1, hair: 9, hairColor: 4, stubble: true } },
  { id: "mbappe", label: "Kylian Mbappé", hint: "Football", style: { gender: "H", skin: 4, hair: 3, hairColor: 0 } },
  { id: "omarsy", label: "Omar Sy", hint: "Cinéma", style: { gender: "H", skin: 5, hair: 3, hairColor: 0, stubble: true } },
  { id: "jamel", label: "Jamel Debbouze", hint: "Humour", style: { gender: "H", skin: 2, hair: 4, hairColor: 0, stubble: true } },
  { id: "dupont", label: "Antoine Dupont", hint: "Rugby", style: { gender: "H", skin: 1, hair: 0, hairColor: 1, beard: true } },
  { id: "riner", label: "Teddy Riner", hint: "Judo", style: { gender: "H", skin: 5, hair: 3, hairColor: 0 } },
  { id: "dujardin", label: "Jean Dujardin", hint: "Cinéma", style: { gender: "H", skin: 1, hair: 0, hairColor: 1, mustache: true } },
  { id: "pesquet", label: "Thomas Pesquet", hint: "Espace", style: { gender: "H", skin: 0, hair: 9, hairColor: 2 } },
  { id: "griezmann", label: "Antoine Griezmann", hint: "Football", style: { gender: "H", skin: 1, hair: 0, hairColor: 3, beard: true } },
  { id: "cyrilhanouna", label: "Cyril Hanouna", hint: "Télévision", style: { gender: "H", skin: 2, hair: 0, hairColor: 0, beard: true, glasses: true } },
  { id: "aya", label: "Aya Nakamura", hint: "Musique", style: { gender: "F", skin: 4, hair: 10, hairColor: 0 } },
  { id: "cotillard", label: "Marion Cotillard", hint: "Cinéma", style: { gender: "F", skin: 0, hair: 6, hairColor: 3 } },
  { id: "farmer", label: "Mylène Farmer", hint: "Musique", style: { gender: "F", skin: 0, hair: 1, hairColor: 6 } },
  { id: "zaz", label: "Zaz", hint: "Musique", style: { gender: "F", skin: 1, hair: 4, hairColor: 2 } },
  { id: "manaudou", label: "Laure Manaudou", hint: "Natation", style: { gender: "F", skin: 0, hair: 8, hairColor: 7 } },
  { id: "cottin", label: "Camille Cottin", hint: "Cinéma", style: { gender: "F", skin: 0, hair: 6, hairColor: 0 } },
  { id: "agbegnenou", label: "Clarisse Agbégnénou", hint: "Judo", style: { gender: "F", skin: 5, hair: 2, hairColor: 0 } },
  { id: "lea", label: "Léa Seydoux", hint: "Cinéma", style: { gender: "F", skin: 0, hair: 1, hairColor: 3 } },
  { id: "angele", label: "Angèle", hint: "Musique", style: { gender: "F", skin: 0, hair: 8, hairColor: 3 } },
  { id: "garcia", label: "Caroline Garcia", hint: "Tennis", style: { gender: "F", skin: 1, hair: 8, hairColor: 1 } },
];

/* Prénoms courants, pour deviner le genre tant que l'administrateur ne l'a pas choisi.
   Un prénom inconnu donne un avatar neutre (cheveux courts, sans barbe). */
const FEMALE = new Set(
  "marie anne sophie julie camille lea laura sarah emma chloe manon pauline claire celine nathalie isabelle sandrine stephanie valerie christine catherine sylvie patricia martine monique nadia fatima samira yasmine amina leila sonia karima malika naima houria khadija aicha salima nora ines lina rania myriam meriem sabrina jessica audrey elodie emilie aurelie melanie virginie caroline delphine veronique agnes brigitte corinne helene florence laetitia charlotte alice louise jade zoe lucie oceane mathilde justine margaux morgane marion amandine gaelle severine carole muriel annie josiane odile chantal danielle mireille pascale beatrice lisa elise eva clara romane anais estelle magali coralie cindy vanessa karine laurence fabienne nicole jacqueline francoise sabine aline noemie maeva nina olivia".split(" "),
);
const MALE = new Set(
  "jean pierre paul jacques michel philippe alain bernard patrick daniel christophe nicolas thomas julien sebastien stephane laurent olivier eric david frederic francois vincent pascal thierry didier denis gilles bruno marc luc yves herve serge gerard rene claude andre louis henri hugo lucas leo gabriel arthur jules adam raphael noah mathis nathan enzo theo tom maxime antoine alexandre romain kevin anthony jeremy jonathan florian guillaume benjamin quentin clement mathieu adrien damien cedric fabien ludovic loic franck gaultier gautier marcus christian dylan steven mohamed mohammed ahmed ali karim rachid said youssef mehdi samir nabil farid hassan omar bilal amine hamza ismael walid sofiane yassine reda hicham khalid mustapha abdel abdelkader jawad houssaine hussein larbi mourad nordine djamel kamel malik zinedine kylian jamel teddy cyril".split(" "),
);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Genre enregistré, sinon deviné à partir du prénom (null si on ne sait pas) */
export function genderOf(e: Pick<Employee, "name" | "avatar">): Gender | null {
  const saved = e.avatar && typeof e.avatar === "object" ? (e.avatar as AvatarStyle).gender : undefined;
  if (saved === "F" || saved === "H") return saved;
  const words = norm(e.name || "").split(/[^a-z]+/).filter(Boolean);
  for (const w of words) {
    if (FEMALE.has(w)) return "F";
    if (MALE.has(w)) return "H";
  }
  return null;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** Avatar enregistré, ou à défaut un avatar stable tiré du nom, cohérent avec le genre */
export function avatarOf(e: Pick<Employee, "name" | "avatar">): AvatarStyle {
  if (e.avatar && typeof e.avatar === "object" && typeof (e.avatar as AvatarStyle).hair === "number") return e.avatar as AvatarStyle;
  const h = hash(e.name || "?");
  const g = genderOf(e);
  const pool = g === "F" ? [1, 6, 8, 2, 4] : g === "H" ? [0, 3, 0, 4, 9] : [0, 4];
  const hair = pool[(h >> 3) % pool.length];
  const man = g === "H";
  return {
    gender: g || undefined,
    skin: h % 4,
    hair,
    hairColor: (h >> 6) % 4,
    glasses: (h >> 9) % 5 === 0,
    beard: man && (h >> 11) % 4 === 0,
    stubble: man && (h >> 11) % 4 === 1,
  };
}
