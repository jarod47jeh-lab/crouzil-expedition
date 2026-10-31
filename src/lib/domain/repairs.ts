import type { Repair } from "@/lib/types";
import { URGENCIES } from "./constants";

/** Immobilisés, puis par urgence, puis les plus anciens */
export const sortRepairs = (a: Repair, b: Repair) =>
  Number(b.immobilized) - Number(a.immobilized) || URGENCIES.indexOf(a.urgency) - URGENCIES.indexOf(b.urgency) || a.observed_on.localeCompare(b.observed_on);
