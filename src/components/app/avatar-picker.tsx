"use client";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFace } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { patchRows } from "@/lib/actions/crud";
import { avatarOf, genderOf, HAIR_COLORS, HAIRS, HAIRS_BY_GENDER, PRESETS, SKINS, TEAM_SHIRT, type AvatarStyle, type Gender } from "@/lib/domain/avatar";
import { TEAMS } from "@/lib/domain/constants";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

const chip = (on: boolean) => cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", on ? "border-brand bg-brand text-brand-ink" : "border-line hover:border-brand/50");

function Swatch({ c, on, onClick, label }: { c: string; on: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} className={cn("h-9 w-9 rounded-full border-2 transition-transform", on ? "scale-110 border-brand" : "border-line")} style={{ background: c }} />;
}

/** Éditeur d'avatar : genre, modèles inspirés de personnalités, puis réglages fins */
function AvatarEditor({ emp, value, onChange }: { emp: Employee; value: AvatarStyle; onChange: (a: AvatarStyle) => void }) {
  const a = value;
  const set = (patch: Partial<AvatarStyle>) => onChange({ ...a, ...patch, preset: undefined });
  const g: Gender | undefined = a.gender;
  const order = g ? [...HAIRS_BY_GENDER[g], ...HAIRS.map((_, i) => i).filter((i) => !HAIRS_BY_GENDER[g].includes(i))] : HAIRS.map((_, i) => i);
  const presets = PRESETS.filter((p) => !g || p.style.gender === g);
  const shirt = TEAM_SHIRT[emp.team];
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="grid place-items-center gap-2 sm:sticky sm:top-0">
        <AvatarFace style={a} shirt={shirt} size={132} />
        {a.preset && <span className="text-xs text-muted">Inspiré de {PRESETS.find((p) => p.id === a.preset)?.label}</span>}
      </div>
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Genre</p>
          <div className="flex flex-wrap gap-1.5">
            {(["F", "H"] as const).map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={g === x}
                className={chip(g === x)}
                onClick={() => {
                  // passer en « Femme » retire barbe et moustache, et propose une coiffure adaptée si besoin
                  const hair = HAIRS_BY_GENDER[x].includes(a.hair) ? a.hair : HAIRS_BY_GENDER[x][0];
                  set(x === "F" ? { gender: x, hair, beard: false, stubble: false, mustache: false } : { gender: x, hair });
                }}
              >
                {x === "F" ? "Femme" : "Homme"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Personnalités
            <span className="font-normal text-muted">· un clic pour partir d&apos;un modèle</span>
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ ...a, ...p.style, glasses: !!p.style.glasses, beard: !!p.style.beard, stubble: !!p.style.stubble, mustache: !!p.style.mustache, preset: p.id })}
                aria-pressed={a.preset === p.id}
                className={cn("grid justify-items-center gap-1 rounded-xl border p-2 text-center transition-colors", a.preset === p.id ? "border-brand bg-brand/5" : "border-line hover:border-brand/50")}
              >
                <AvatarFace style={p.style} shirt={shirt} size={48} />
                <span className="text-[11.5px] leading-tight font-semibold">{p.label}</span>
                <span className="text-[10.5px] leading-none text-muted">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Teint</p>
          <div className="flex flex-wrap gap-2">{SKINS.map((c, i) => <Swatch key={c} c={c} on={a.skin === i} onClick={() => set({ skin: i })} label={`Teint ${i + 1}`} />)}</div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Coiffure</p>
          <div className="flex flex-wrap gap-1.5">
            {order.map((i) => (
              <button key={HAIRS[i]} type="button" onClick={() => set({ hair: i })} aria-pressed={a.hair === i} className={chip(a.hair === i)}>
                {HAIRS[i]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Couleur des cheveux</p>
          <div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c, i) => <Swatch key={c} c={c} on={a.hairColor === i} onClick={() => set({ hairColor: i })} label={`Couleur ${i + 1}`} />)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(g === "F" ? (["glasses"] as const) : (["glasses", "beard", "stubble", "mustache"] as const)).map((k) => (
            <button key={k} type="button" onClick={() => set({ [k]: !a[k] })} aria-pressed={!!a[k]} className={chip(!!a[k])}>
              {{ glasses: "Lunettes", beard: "Barbe", stubble: "Barbe de 3 jours", mustache: "Moustache" }[k]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
