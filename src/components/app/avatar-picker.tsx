"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AvatarFace } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { patchRows } from "@/lib/actions/crud";
import { avatarOf, HAIR_COLORS, HAIRS, SKINS, TEAM_SHIRT, type AvatarStyle } from "@/lib/domain/avatar";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Personnaliser l'avatar d'un collaborateur */
export function AvatarPicker({ emp, open, onClose }: { emp: Employee; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [a, setA] = useState<AvatarStyle>(avatarOf(emp));
  const [pending, start] = useTransition();
  const set = (k: keyof AvatarStyle, v: number | boolean) => setA((o) => ({ ...o, [k]: v }));
  const save = () =>
    start(async () => {
      const r = await patchRows("employees", [emp.id], { avatar: a });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Avatar enregistré");
      router.refresh();
      onClose();
    });
  const Swatch = ({ c, on, onClick, label }: { c: string; on: boolean; onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} className={cn("h-9 w-9 rounded-full border-2 transition-transform", on ? "scale-110 border-brand" : "border-line")} style={{ background: c }} />
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Avatar"
      subtitle={`${emp.name} · la tenue prend la couleur de l'équipe`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={pending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="grid place-items-center">
          <AvatarFace style={a} shirt={TEAM_SHIRT[emp.team]} size={132} />
        </div>
        <div className="grid gap-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Teint</p>
            <div className="flex flex-wrap gap-2">{SKINS.map((c, i) => <Swatch key={c} c={c} on={a.skin === i} onClick={() => set("skin", i)} label={`Teint ${i + 1}`} />)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Coiffure</p>
            <div className="flex flex-wrap gap-1.5">
              {HAIRS.map((h, i) => (
                <button key={h} type="button" onClick={() => set("hair", i)} aria-pressed={a.hair === i} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", a.hair === i ? "border-brand bg-brand text-brand-ink" : "border-line")}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Couleur des cheveux</p>
            <div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c, i) => <Swatch key={c} c={c} on={a.hairColor === i} onClick={() => set("hairColor", i)} label={`Couleur ${i + 1}`} />)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["glasses", "beard"] as const).map((k) => (
              <button key={k} type="button" onClick={() => set(k, !a[k])} aria-pressed={!!a[k]} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", a[k] ? "border-brand bg-brand text-brand-ink" : "border-line")}>
                {k === "glasses" ? "Lunettes" : "Barbe"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
