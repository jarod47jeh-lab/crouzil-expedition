"use client";
import { Dices, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { AvatarFace } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BROWS, EYE_COLOR_NAMES, EYE_COLORS, EYES, FACES, GLASSES, HAIR_COLORS, HAIRS, HAIRS_BY_GENDER, MOUTHS, NOSES, PRESETS, SKINS, TEAM_SHIRT, type AvatarStyle, type Gender } from "@/lib/domain/avatar";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

export const chip = (on: boolean) => cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", on ? "border-brand bg-brand text-brand-ink" : "border-line hover:border-brand/50");

function Swatch({ c, on, onClick, label }: { c: string; on: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} title={label} className={cn("h-9 w-9 rounded-full border-2 transition-transform", on ? "scale-110 border-brand" : "border-line")} style={{ background: c }} />;
}

/** Choix en miniatures : chaque option est dessinée sur l'avatar en cours, pour comparer d'un coup d'œil */
function Thumbs({ label, names, value, make, shirt, onPick, order }: { label: string; names: string[]; value: number; make: (i: number) => AvatarStyle; shirt: string; onPick: (i: number) => void; order?: number[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold">{label}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-1.5">
        {(order || names.map((_, i) => i)).map((i) => (
          <button key={i} type="button" onClick={() => onPick(i)} aria-pressed={value === i} className={cn("grid justify-items-center gap-0.5 rounded-xl border p-1.5 transition-colors", value === i ? "border-brand bg-brand/5" : "border-line hover:border-brand/50")}>
            <AvatarFace style={make(i)} shirt={shirt} size={46} />
            <span className="w-full truncate text-center text-[11px] leading-tight font-semibold">{names[i]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const SECTIONS = [
  ["visage", "Visage"],
  ["yeux", "Yeux et sourcils"],
  ["cheveux", "Cheveux"],
  ["barbe", "Barbe"],
  ["details", "Détails"],
  ["modeles", "Personnalités"],
] as const;
type Section = (typeof SECTIONS)[number][0];

const rnd = (n: number) => Math.floor(Math.random() * n);
const NO_BEARD = { stubble: false, beard: false, longBeard: false, goatee: false };

/** Éditeur d'avatar : chaque trait se règle en miniatures, en regardant le vrai visage */
export function AvatarEditor({ emp, value, onChange }: { emp: Employee; value: AvatarStyle; onChange: (a: AvatarStyle) => void }) {
  const [sec, setSec] = useState<Section>("visage");
  const a = value;
  const set = (patch: Partial<AvatarStyle>) => onChange({ ...a, ...patch, preset: undefined });
  const g: Gender | undefined = a.gender;
  const man = g !== "F";
  const hairOrder = g ? [...HAIRS_BY_GENDER[g], ...HAIRS.map((_, i) => i).filter((i) => !HAIRS_BY_GENDER[g].includes(i))] : HAIRS.map((_, i) => i);
  const presets = PRESETS.filter((p) => !g || p.style.gender === g);
  const shirt = TEAM_SHIRT[emp.team] || "#3a3f4b";
  const random = () => {
    const gg: Gender = g || (Math.random() < 0.5 ? "H" : "F");
    const pool = HAIRS_BY_GENDER[gg].slice(0, 8);
    const m = gg === "H", b = rnd(5);
    onChange({
      gender: gg, skin: rnd(SKINS.length), hair: pool[rnd(pool.length)], hairColor: rnd(5), face: rnd(FACES.length), brows: rnd(BROWS.length), eyes: rnd(EYES.length),
      eyeColor: rnd(EYE_COLORS.length), nose: rnd(NOSES.length), mouth: rnd(MOUTHS.length), glasses: rnd(4) === 0, glassesStyle: rnd(GLASSES.length),
      ...NO_BEARD, beard: m && b === 1, stubble: m && b === 2, goatee: m && b === 3, mustache: m && rnd(5) === 0, earrings: !m && rnd(3) === 0, freckles: rnd(8) === 0, wrinkles: false,
    });
  };
  const beards: [keyof typeof NO_BEARD | "none", string][] = [["none", "Rasé de près"], ["stubble", "3 jours"], ["beard", "Courte"], ["longBeard", "Longue"], ["goatee", "Bouc"]];
  const beardNow = (Object.keys(NO_BEARD) as (keyof typeof NO_BEARD)[]).find((k) => a[k]) || "none";
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="grid place-items-center gap-2 sm:sticky sm:top-0">
        <AvatarFace style={a} shirt={shirt} size={150} />
        {a.preset && <span className="text-xs text-muted">Inspiré de {PRESETS.find((p) => p.id === a.preset)?.label}</span>}
        <div className="flex gap-1.5">
          {(["F", "H"] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={g === x}
              className={chip(g === x)}
              onClick={() => {
                // passer en « Femme » retire la pilosité, et propose une coiffure adaptée si besoin
                const hair = HAIRS_BY_GENDER[x].includes(a.hair) ? a.hair : HAIRS_BY_GENDER[x][0];
                set(x === "F" ? { gender: x, hair, ...NO_BEARD, mustache: false } : { gender: x, hair, earrings: false });
                if (x === "F" && sec === "barbe") setSec("visage");
              }}
            >
              {x === "F" ? "Femme" : "Homme"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={random}>
            <Dices className="h-4 w-4" /> Au hasard
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ gender: g, skin: a.skin, hair: g === "F" ? 1 : 0, hairColor: a.hairColor })}>
            <RotateCcw className="h-4 w-4" /> Neutre
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 gap-4">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2/60 p-1 [scrollbar-width:none]" role="tablist">
          {SECTIONS.filter(([k]) => k !== "barbe" || man).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={sec === k} onClick={() => setSec(k)} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold", sec === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>

        {sec === "visage" && (
          <>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Teint</p>
              <div className="flex flex-wrap gap-2">{SKINS.map((c, i) => <Swatch key={c} c={c} on={a.skin === i} onClick={() => set({ skin: i })} label={`Teint ${i + 1}`} />)}</div>
            </div>
            <Thumbs label="Forme du visage" names={FACES} value={a.face ?? 0} make={(i) => ({ ...a, face: i })} shirt={shirt} onPick={(i) => set({ face: i })} />
            <Thumbs label="Nez" names={NOSES} value={a.nose ?? 0} make={(i) => ({ ...a, nose: i })} shirt={shirt} onPick={(i) => set({ nose: i })} />
            <Thumbs label="Bouche" names={MOUTHS} value={a.mouth ?? 0} make={(i) => ({ ...a, mouth: i })} shirt={shirt} onPick={(i) => set({ mouth: i })} />
          </>
        )}

        {sec === "yeux" && (
          <>
            <Thumbs label="Yeux" names={EYES} value={a.eyes ?? 0} make={(i) => ({ ...a, eyes: i })} shirt={shirt} onPick={(i) => set({ eyes: i })} />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Couleur des yeux</p>
              <div className="flex flex-wrap gap-2">{EYE_COLORS.map((c, i) => <Swatch key={c} c={c} on={(a.eyeColor ?? 0) === i} onClick={() => set({ eyeColor: i })} label={EYE_COLOR_NAMES[i]} />)}</div>
            </div>
            <Thumbs label="Sourcils" names={BROWS} value={a.brows ?? 0} make={(i) => ({ ...a, brows: i })} shirt={shirt} onPick={(i) => set({ brows: i })} />
          </>
        )}

        {sec === "cheveux" && (
          <>
            <Thumbs label="Coiffure" names={HAIRS} value={a.hair} order={hairOrder} make={(i) => ({ ...a, hair: i })} shirt={shirt} onPick={(i) => set({ hair: i })} />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Couleur des cheveux{a.hair === 15 ? " et du foulard" : ""}</p>
              <div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c, i) => <Swatch key={c} c={c} on={a.hairColor === i} onClick={() => set({ hairColor: i })} label={`Couleur ${i + 1}`} />)}</div>
            </div>
          </>
        )}

        {sec === "barbe" && man && (
          <>
            <Thumbs
              label="Barbe"
              names={beards.map(([, l]) => l)}
              value={beards.findIndex(([k]) => k === beardNow)}
              make={(i) => ({ ...a, ...NO_BEARD, ...(beards[i][0] === "none" ? {} : { [beards[i][0]]: true }) })}
              shirt={shirt}
              onPick={(i) => set({ ...NO_BEARD, ...(beards[i][0] === "none" ? {} : { [beards[i][0]]: true }) })}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set({ mustache: !a.mustache })} aria-pressed={!!a.mustache} className={chip(!!a.mustache)}>
                Moustache
              </button>
            </div>
          </>
        )}

        {sec === "details" && (
          <>
            <div className="flex flex-wrap gap-2">
              {([["glasses", "Lunettes"], ["earrings", "Boucles d'oreilles"], ["freckles", "Taches de rousseur"], ["wrinkles", "Rides"]] as [keyof AvatarStyle, string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set({ [k]: !a[k] })} aria-pressed={!!a[k]} className={chip(!!a[k])}>
                  {l}
                </button>
              ))}
            </div>
            {a.glasses && <Thumbs label="Lunettes" names={GLASSES} value={a.glassesStyle ?? 0} make={(i) => ({ ...a, glassesStyle: i })} shirt={shirt} onPick={(i) => set({ glassesStyle: i })} />}
          </>
        )}

        {sec === "modeles" && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> Personnalités
              <span className="font-normal text-muted">· un point de départ, à retoucher ensuite</span>
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ ...a, ...NO_BEARD, ...p.style, glasses: !!p.style.glasses, mustache: !!p.style.mustache, preset: p.id })}
                  aria-pressed={a.preset === p.id}
                  className={cn("grid justify-items-center gap-1 rounded-xl border p-2 text-center transition-colors", a.preset === p.id ? "border-brand bg-brand/5" : "border-line hover:border-brand/50")}
                >
                  <AvatarFace style={p.style} shirt={shirt} size={48} />
                  <span className="text-xs leading-tight font-semibold">{p.label}</span>
                  <span className="text-[11px] leading-none text-muted">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
