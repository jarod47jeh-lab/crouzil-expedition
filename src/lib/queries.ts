import "server-only";
import { getMarks } from "@/lib/data";

export const yearRange = (y: number): [string, string] => [`${y}-01-01`, `${y}-12-31`];
export const getDayMarksYear = (y: number) => getMarks(undefined, ...yearRange(y));
