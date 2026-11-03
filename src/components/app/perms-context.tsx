"use client";
import { createContext, useContext } from "react";
import { canContribute, canRead, canWrite, isAdmin, TABLE_MODULE, type ModuleKey, type Perms } from "@/lib/perms";

const Ctx = createContext<Perms>({ role: "reader", modules: [] });

export function PermsProvider({ value, children }: { value: Perms; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePerms() {
  const p = useContext(Ctx);
  return {
    ...p,
    admin: isAdmin(p),
    read: (m: ModuleKey) => canRead(p, m),
    write: (m: ModuleKey | "any") => canWrite(p, m),
    writeTable: (t: string) => canWrite(p, TABLE_MODULE[t] || "any"),
    contribute: canContribute(p),
  };
}

/** Affiche les enfants seulement si l'utilisateur peut modifier dans ce menu */
export function CanWrite({ module, children }: { module: ModuleKey | "any"; children: React.ReactNode }) {
  const p = usePerms();
  return p.write(module) ? <>{children}</> : null;
}
