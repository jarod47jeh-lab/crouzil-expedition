import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
export const nf = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
export const pct = (n: number, d = 1) => `${nf(n, d)} %`;
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n > 1 ? many : one}`;
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
