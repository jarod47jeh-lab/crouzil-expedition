"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { patchRows } from "@/lib/actions/crud";
import { avatarOf, genderOf, type AvatarStyle } from "@/lib/domain/avatar";
import { AvatarEditor } from "./avatar-editor";
import { TEAMS } from "@/lib/domain/constants";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Style de départ : l'avatar enregistré, ou celui généré avec le genre deviné */
const startOf = (emp: Employee): AvatarStyle => {
  const a = avatarOf(emp);
  return { ...a, gender: a.gender || genderOf(emp) || undefined };
};

function useSave(onDone: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (emp: Employee, a: AvatarStyle) =>
    start(async () => {
      const r = await patchRows("employees", [emp.id], { avatar: a });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Avatar de ${emp.name} enregistré`);
      router.refresh();
      onDone();
    });
  return { save, pending };
}

/** Personnaliser l'avatar d'un collaborateur (réservé aux administrateurs) */
export function AvatarPicker({ emp, open, onClose }: { emp: Employee; open: boolean; onClose: () => void }) {
  const [a, setA] = useState<AvatarStyle>(startOf(emp));
  useEffect(() => {
    if (open) setA(startOf(emp));
  }, [open, emp]);
  const { save, pending } = useSave(onClose);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Avatar"
      subtitle={`${emp.name} · la tenue prend la couleur de l'équipe`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => save(emp, a)} loading={pending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <AvatarEditor emp={emp} value={a} onChange={setA} />
    </Dialog>
  );
}

/** Galerie de tous les avatars : l'administrateur passe d'un collaborateur à l'autre */
export function AvatarStudio({ employees, open, onClose }: { employees: Employee[]; open: boolean; onClose: () => void }) {
  const list = employees.filter((e) => e.active);
  const [cur, setCur] = useState<Employee | null>(null);
  const [a, setA] = useState<AvatarStyle | null>(null);
  const pick = (e: Employee) => {
    setCur(e);
    setA(startOf(e));
  };
  useEffect(() => {
    if (open && !cur && list.length) pick(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const next = () => {
    const i = list.findIndex((e) => e.id === cur?.id);
    if (i >= 0 && i < list.length - 1) pick(list[i + 1]);
  };
  const { save, pending } = useSave(next);
  const unsure = list.filter((e) => !(e.avatar && (e.avatar as AvatarStyle).gender) && !genderOf(e)).length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Avatars de l'équipe"
      subtitle={unsure ? `${unsure} collaborateur(s) dont le genre n'est pas encore choisi` : "Choisissez un collaborateur, puis son avatar"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {cur && a && (
            <Button onClick={() => save(cur, a)} loading={pending}>
              Enregistrer et suivant
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {list.map((e) => {
          const set = !!(e.avatar && typeof (e.avatar as AvatarStyle).hair === "number");
          return (
            <button key={e.id} type="button" onClick={() => pick(e)} aria-pressed={cur?.id === e.id} className={cn("grid w-[72px] shrink-0 justify-items-center gap-1 rounded-xl border p-1.5", cur?.id === e.id ? "border-brand bg-brand/5" : "border-line")}>
              <Avatar e={e} size={40} />
              <span className="w-full truncate text-[11px] font-semibold">{e.name.split(" ")[0]}</span>
              <span className={cn("text-[10px]", set ? "text-ok" : "text-muted")}>{set ? "Fait" : TEAMS[e.team]}</span>
            </button>
          );
        })}
      </div>
      {cur && a ? <AvatarEditor key={cur.id} emp={cur} value={a} onChange={setA} /> : <p className="text-sm text-muted">Aucun collaborateur actif.</p>}
    </Dialog>
  );
}
