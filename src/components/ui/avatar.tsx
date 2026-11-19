import { avatarOf, EYE_COLORS, HAIR_COLORS, SKINS, TEAM_SHIRT, type AvatarStyle } from "@/lib/domain/avatar";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Formes du visage (le haut de la tête reste vers y = 17,5 pour que les coiffures s'y posent) */
function FaceShape({ face = 0, woman, fill }: { face?: number; woman: boolean; fill: string }) {
  if (face === 1) return <ellipse cx="32" cy="31.5" rx="13" ry="13" fill={fill} />;
  if (face === 2) return <rect x="20" y="17.5" width="24" height="27" rx="8.5" fill={fill} />;
  if (face === 3) return <ellipse cx="32" cy="31.5" rx={woman ? 10.8 : 11.2} ry="14.2" fill={fill} />;
  if (face === 4) return <path d="M19.5 28c0-6.5 5.5-10.5 12.5-10.5S44.5 21.5 44.5 28c0 8-6 16.5-12.5 16.5S19.5 36 19.5 28z" fill={fill} />;
  return <ellipse cx="32" cy="31" rx={woman ? 11.5 : 12} ry="13.5" fill={fill} />;
}

/** Visage dessiné, tenue aux couleurs de l'équipe */
export function AvatarFace({ style: a, shirt, size = 36, className, title, dim }: { style: AvatarStyle; shirt: string; size?: number; className?: string; title?: string; dim?: boolean }) {
  const skin = SKINS[a.skin] || SKINS[0], hc = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const iris = EYE_COLORS[a.eyeColor ?? 0] ?? EYE_COLORS[0];
  // sourcils : couleur des cheveux, foncée si les cheveux sont très clairs (blancs, gris)
  const browC = a.hairColor === 4 || a.hairColor === 5 ? "#7d756d" : hc;
  const woman = a.gender === "F";
  // même dessin = même identifiant : deux avatars différents ne partagent jamais leur découpe
  const clip =
    "av-" +
    [a.skin, a.hair, a.hairColor, a.gender, a.face, a.brows, a.eyes, a.eyeColor, a.nose, a.mouth, a.glassesStyle, +!!a.beard, +!!a.stubble, +!!a.mustache, +!!a.glasses, +!!a.longBeard, +!!a.goatee, +!!a.wrinkles, +!!a.freckles, +!!a.earrings, shirt.slice(1)].join("-");
  const line = "rgb(42 33 29 / .55)";
  const eyes = a.eyes ?? 0;
  const ey = eyes === 3 ? 32 : 31.5;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0 rounded-full", dim && "opacity-45 grayscale", className)} role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <circle cx="32" cy="32" r="32" fill="color-mix(in srgb, var(--surface-2) 80%, transparent)" />
      <clipPath id={clip}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {/* cheveux et foulard derrière la tête */}
        {a.hair === 1 && <path d="M15 30c0-12 7-19 17-19s17 7 17 19v20H15z" fill={hc} />}
        {a.hair === 6 && <path d="M17 30c0-11 6.5-17 15-17s15 6 15 17v12c-4 2-26 2-30 0z" fill={hc} />}
        {a.hair === 7 && <circle cx="32" cy="26" r="17" fill={hc} />}
        {a.hair === 8 && <path d="M40 18c8 2 9 10 6 18-1 3-3 4-4 3 2-6 2-13-2-17z" fill={hc} />}
        {a.hair === 10 && (
          <>
            <path d="M16 28c0-10 7-16 16-16s16 6 16 16v24h-4V30H20v22h-4z" fill={hc} />
            {[18, 22, 42, 46].map((x) => <path key={x} d={`M${x} 34v18`} stroke="rgb(0 0 0 / .25)" strokeWidth="1" />)}
          </>
        )}
        {a.hair === 12 && <path d="M16.5 30c0-11 6.5-17 15.5-17s15.5 6 15.5 17v9c-2 1.5-5 1.5-6 0V30H23v9c-1 1.5-4 1.5-6.5 0z" fill={hc} />}
        {a.hair === 14 && <path d="M17 30c0-11 6.5-17 15-17s15 6 15 17v10c-4 2-26 2-30 0z" fill={hc} />}
        {a.hair === 15 && <path d="M13.5 35c0-13.5 8-22 18.5-22s18.5 8.5 18.5 22v29h-37z" fill={hc} />}
        <path d="M10 64c1-13 10-20 22-20s21 7 22 20z" fill={shirt} />
        <path d="M27 44h10v5c0 3-10 3-10 0z" fill={skin} />
        {a.hair === 15 ? (
          <path d="M22 44c3 4 6.5 6 10 6s7-2 10-6l3 5c-4 3-8.5 4.5-13 4.5s-9-1.5-13-4.5z" fill={hc} />
        ) : (
          <path d="M26 45l6 7 6-7" fill="none" stroke="rgb(255 255 255 / .55)" strokeWidth="2" />
        )}
        {/* oreilles */}
        {a.hair !== 15 && (
          <>
            <ellipse cx="20" cy="32.5" rx="2.4" ry="3.2" fill={skin} />
            <ellipse cx="44" cy="32.5" rx="2.4" ry="3.2" fill={skin} />
            {a.earrings && (
              <>
                <circle cx="20" cy="36.6" r="1.1" fill="#d9b25c" />
                <circle cx="44" cy="36.6" r="1.1" fill="#d9b25c" />
              </>
            )}
          </>
        )}
        <FaceShape face={a.face} woman={woman} fill={skin} />
        {/* coiffures (devant) */}
        {a.hair === 0 && <path d="M19.5 29c0-9 5.5-14 12.5-14s12.5 5 12.5 14c-3-5-7-6.5-12.5-6.5S22.5 24 19.5 29z" fill={hc} />}
        {a.hair === 1 && <path d="M19.5 30c0-10 5.5-15 12.5-15s12.5 5 12.5 15c-4-4-8-7-12.5-7s-8.5 3-12.5 7z" fill={hc} />}
        {a.hair === 2 && (
          <>
            <circle cx="32" cy="14" r="5.5" fill={hc} />
            <path d="M19.5 29c0-9 5.5-13.5 12.5-13.5S44.5 20 44.5 29c-3-4-7-6-12.5-6s-9.5 2-12.5 6z" fill={hc} />
          </>
        )}
        {a.hair === 3 && <path d="M20 26c1-7 6-10.5 12-10.5S43 19 44 26c-3-3-7-4.5-12-4.5S23 23 20 26z" fill={hc} opacity=".55" />}
        {a.hair === 4 && <path d="M18.5 30c-2-11 5-16 13.5-16s15.5 5 13.5 16c-1-4-3-6-5-6.5-2 2-5 2-8.5 2s-6.5 0-8.5-2c-2 .5-4 2.5-5 6.5z" fill={hc} />}
        {a.hair === 5 && (
          <>
            <path d="M19 27c0-8 6-12.5 13-12.5S45 19 45 27z" fill="#ce0013" />
            <path d="M30 26.5h21c0 2-1.5 3-3.5 3H30z" fill="#a8000f" />
            <circle cx="32" cy="16.5" r="1.4" fill="#fff" />
          </>
        )}
        {a.hair === 6 && <path d="M19.5 31c0-10 5.5-15.5 12.5-15.5S44.5 21 44.5 31c-2-5-5-7-8-7.5-3 3-12 4-17 7.5z" fill={hc} />}
        {a.hair === 7 && <path d="M19 30c-1-9 5-14.5 13-14.5S46 21 45 30c-3-4-7-6-13-6s-10 2-13 6z" fill={hc} />}
        {a.hair === 8 && <path d="M19.5 29c0-9 5.5-14 12.5-14s12.5 5 12.5 14c-3-4.5-7-6-12.5-6s-9.5 1.5-12.5 6z" fill={hc} />}
        {a.hair === 9 && (
          <>
            <path d="M19.6 33c-.8-4 .2-7 1.6-8.5 0 3 .3 5.5 1.2 8.5zM44.4 33c.8-4-.2-7-1.6-8.5 0 3-.3 5.5-1.2 8.5z" fill={hc} />
            <ellipse cx="32" cy="20" rx="7" ry="3" fill="#fff" opacity=".18" />
          </>
        )}
        {a.hair === 10 && <path d="M19.5 29c0-9 5.5-14 12.5-14s12.5 5 12.5 14c-3-4.5-7-6-12.5-6s-9.5 1.5-12.5 6z" fill={hc} />}
        {a.hair === 11 && (
          <>
            <path d="M20.3 27c1-7 5.7-10.5 11.7-10.5S42.7 20 43.7 27c-3-3.2-7-4.4-11.7-4.4S23.3 23.8 20.3 27z" fill={hc} />
            <path d="M20.2 28.5c-.3-1.6-.2-3 .3-4.3M43.8 28.5c.3-1.6.2-3-.3-4.3" stroke={hc} strokeWidth="1.2" opacity=".5" />
          </>
        )}
        {a.hair === 12 && <path d="M19.5 30c0-10 5.5-15 12.5-15s12.5 5 12.5 15c-2.5-4-6-6.5-12.5-6.5-4 2.5-8.5 3.5-12.5 6.5z" fill={hc} />}
        {a.hair === 13 && (
          <>
            <path d="M19.8 27.5c0-8 5.5-12.5 12.2-12.5s12.2 4.5 12.2 12.5c-1.5-3.6-5.5-5.6-12.2-5.6s-10.7 2-12.2 5.6z" fill={hc} />
            <path d="M25 19.5c3-1.4 9-1.6 14 .3M24 22c3.5-1.2 11-1.3 16 .4" stroke="rgb(0 0 0 / .22)" strokeWidth=".8" fill="none" />
          </>
        )}
        {a.hair === 14 && <path d="M19.5 31c0-10 5.5-15.5 12.5-15.5S44.5 21 44.5 31c-1-3-2-4.5-3-5-3.5 1-15.5 1-19 0-1 .5-2 2-3 5z" fill={hc} />}
        {a.hair === 15 && <path d="M18.5 33c0-11 6-17.5 13.5-17.5S45.5 22 45.5 33l-1.5.5c0-8.5-5.3-13-12-13s-12 4.5-12 13z" fill={hc} />}
        {/* rides, taches de rousseur */}
        {a.wrinkles && (
          <g stroke={line} strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".7">
            <path d="M27 23.4c3-.8 7-.8 10 0M28 25c2.5-.5 5.5-.5 8 0" />
            <path d="M22.6 32.4l-1.2.8M22.8 33.8l-1.3.3M41.4 32.4l1.2.8M41.2 33.8l1.3.3" />
            <path d="M27.2 37.2c-.6 1-.6 2.1-.2 3M36.8 37.2c.6 1 .6 2.1.2 3" />
          </g>
        )}
        {a.freckles && (
          <g fill="#a0603f" opacity=".55">
            {[[24.5, 35.2], [26, 36.3], [27.3, 35.4], [36.7, 35.4], [38, 36.3], [39.5, 35.2], [31, 34.3], [33, 34.3]].map(([x, y]) => (
              <circle key={x + "-" + y} cx={x} cy={y} r=".45" />
            ))}
          </g>
        )}
        {/* pilosité */}
        {a.stubble && !a.beard && !a.longBeard && <path d="M21.5 34c1.5 7.5 5.5 11 10.5 11s9-3.5 10.5-11c-2 2.5-5 3.5-10.5 3.5S23.5 36.5 21.5 34z" fill={hc} opacity=".38" />}
        {a.longBeard && <path d="M20.5 33c0 12 5 18 11.5 18s11.5-6 11.5-18c-2 3-5 4.5-11.5 4.5S22.5 36 20.5 33z" fill={hc} />}
        {a.beard && !a.longBeard && <path d="M21 33c1 9 5.5 13 11 13s10-4 11-13c-2 3-5 4.5-11 4.5S23 36 21 33z" fill={hc} />}
        {a.goatee && !a.beard && !a.longBeard && <path d="M29 40c.4 3 1.5 4.8 3 4.8s2.6-1.8 3-4.8c-1 .7-2 1-3 1s-2-.3-3-1z" fill={hc} />}
        {/* sourcils */}
        <g stroke={browC} strokeLinecap="round" fill="none">
          {(a.brows ?? 0) === 0 && <path d="M24.2 27.7c1.8-1 4-1.1 5.6-.3M39.8 27.7c-1.8-1-4-1.1-5.6-.3" strokeWidth="1" />}
          {a.brows === 1 && <path d="M24 27.8c1.8-1.1 4.2-1.2 6-.4M40 27.8c-1.8-1.1-4.2-1.2-6-.4" strokeWidth="2.1" />}
          {a.brows === 2 && <path d="M24.2 28.4c1.2-2.2 3.8-2.6 5.8-1.4M39.8 28.4c-1.2-2.2-3.8-2.6-5.8-1.4" strokeWidth="1.3" />}
          {a.brows === 3 && <path d="M24 27.5h6M34 27.5h6" strokeWidth="1.9" />}
          {a.brows === 4 && <path d="M24 26.8l6 1.4M40 26.8l-6 1.4" strokeWidth="1.8" />}
        </g>
        {/* yeux */}
        {eyes === 2 ? (
          <g stroke="#2a211d" strokeWidth="1.3" strokeLinecap="round" fill="none">
            <path d="M24.8 32.2c1.3-1.5 3.2-1.5 4.5 0M34.7 32.2c1.3-1.5 3.2-1.5 4.5 0" />
          </g>
        ) : (
          [27, 37].map((x) => {
            const rx = eyes === 1 ? 2.7 : eyes === 4 ? 2.6 : 2.2;
            const ry = eyes === 1 ? 1.45 : eyes === 4 ? 2.3 : eyes === 3 ? 1.55 : 1.9;
            const ir = eyes === 4 ? 1.65 : eyes === 1 ? 1.25 : 1.35;
            return (
              <g key={x}>
                <ellipse cx={x} cy={ey} rx={rx} ry={ry} fill="#fbfaf7" />
                <circle cx={x} cy={ey} r={ir} fill={iris} />
                <circle cx={x} cy={ey} r={ir * 0.5} fill="#15100d" />
                <circle cx={x + 0.45} cy={ey - 0.45} r=".35" fill="#fff" />
                {eyes === 3 && <path d={`M${x - rx} ${ey - 0.4}c1.5-1.2 ${rx * 2 - 3} -1.2 ${rx * 2} 0`} fill={skin} stroke={line} strokeWidth=".6" />}
              </g>
            );
          })
        )}
        {woman && eyes !== 2 && (
          <g stroke="#2a211d" strokeWidth=".9" strokeLinecap="round">
            <path d="M24.6 30l-.9-.9M39.4 30l.9-.9" />
          </g>
        )}
        {/* nez */}
        <g stroke={line} strokeWidth="1" strokeLinecap="round" fill="none">
          {(a.nose ?? 0) === 0 && <path d="M31.4 34.6c.4 1 1.3 1.3 2.2.9" />}
          {a.nose === 1 && <path d="M32.2 30.8v4.3c0 .9-.9 1.4-1.8 1.2" />}
          {a.nose === 2 && <path d="M29.4 35.4c.6 1.1 1.6 1.4 2.6 1.2 1 .2 2-.1 2.6-1.2M30.6 33.4v1.4M33.4 33.4v1.4" />}
          {a.nose === 3 && <path d="M32.3 29.8v6c0 1-1 1.5-2 1.2" />}
          {a.nose === 4 && <path d="M32 32.6c-.2 1.6-.9 2.6-1.6 3 .9.6 2.1.6 3 0" />}
        </g>
        {a.mustache && <path d="M27 36.6c2-1.6 3.6-1.2 5 0 1.4-1.2 3-1.6 5 0-1.6 1.6-3.6 1.6-5 .6-1.4 1-3.4 1-5-.6z" fill={hc} />}
        {/* bouche */}
        {(() => {
          const m = a.mouth ?? 0;
          const lip = woman ? "#b0473f" : "#7a3f30";
          if (m === 1) return <path d="M29 39h6" stroke={lip} strokeWidth="1.5" strokeLinecap="round" />;
          if (m === 2) return <path d="M28 38.2h8c-.5 2.6-2.3 3.8-4 3.8s-3.5-1.2-4-3.8z" fill="#fff" stroke={lip} strokeWidth="1.1" strokeLinejoin="round" />;
          if (m === 3) return <path d="M28.4 38.6c1.2-.9 2.4-1 3.6-.4 1.2-.6 2.4-.5 3.6.4-1 1.9-2.3 2.6-3.6 2.6s-2.6-.7-3.6-2.6z" fill={woman ? "#c2564c" : "#9a5040"} />;
          if (m === 4) return <path d="M29 39.6c1.9-.9 4.1-.9 6 0" stroke={lip} strokeWidth="1.4" strokeLinecap="round" fill="none" />;
          return <path d="M28.5 38.5c2 1.6 5 1.6 7 0" fill="none" stroke={lip} strokeWidth={woman ? 1.8 : 1.5} strokeLinecap="round" />;
        })()}
        {/* lunettes */}
        {a.glasses && (
          <g fill="none" stroke="#2a211d" strokeWidth={a.glassesStyle === 2 ? 0.8 : 1.4}>
            {(a.glassesStyle ?? 0) === 1 ? (
              <>
                <rect x="22.6" y={ey - 3} width="8.4" height="6" rx="1.4" />
                <rect x="33" y={ey - 3} width="8.4" height="6" rx="1.4" />
              </>
            ) : (
              <>
                <circle cx="27" cy={ey} r="4" />
                <circle cx="37" cy={ey} r="4" />
              </>
            )}
            <path d={`M31 ${ey}h2`} />
          </g>
        )}
      </g>
    </svg>
  );
}

export function Avatar({ e, size = 36, className, dim }: { e: Pick<Employee, "name" | "avatar" | "team">; size?: number; className?: string; dim?: boolean }) {
  return <AvatarFace style={avatarOf(e)} shirt={TEAM_SHIRT[e.team] || "#3a3f4b"} size={size} className={className} title={e.name} dim={dim} />;
}
