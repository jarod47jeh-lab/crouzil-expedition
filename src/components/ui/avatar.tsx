import { avatarOf, HAIR_COLORS, SKINS, TEAM_SHIRT, type AvatarStyle } from "@/lib/domain/avatar";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Visage dessiné, tenue aux couleurs de l'équipe */
export function AvatarFace({ style: a, shirt, size = 36, className, title, dim }: { style: AvatarStyle; shirt: string; size?: number; className?: string; title?: string; dim?: boolean }) {
  const skin = SKINS[a.skin] || SKINS[0], hc = HAIR_COLORS[a.hairColor] || HAIR_COLORS[0];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0 rounded-full", dim && "opacity-45 grayscale", className)} role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <circle cx="32" cy="32" r="32" fill="color-mix(in srgb, var(--surface-2) 80%, transparent)" />
      <clipPath id="av-clip">
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath="url(#av-clip)">
        {a.hair === 1 && <path d="M15 30c0-12 7-19 17-19s17 7 17 19v20H15z" fill={hc} />}
        <path d="M10 64c1-13 10-20 22-20s21 7 22 20z" fill={shirt} />
        <path d="M27 44h10v5c0 3-10 3-10 0z" fill={skin} />
        <path d="M26 45l6 7 6-7" fill="none" stroke="rgb(255 255 255 / .55)" strokeWidth="2" />
        <ellipse cx="32" cy="31" rx="12" ry="13.5" fill={skin} />
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
        {a.beard && <path d="M21 33c1 9 5.5 13 11 13s10-4 11-13c-2 3-5 4.5-11 4.5S23 36 21 33z" fill={hc} />}
        <circle cx="27" cy="31.5" r="1.6" fill="#2a211d" />
        <circle cx="37" cy="31.5" r="1.6" fill="#2a211d" />
        <path d="M28.5 38.5c2 1.6 5 1.6 7 0" fill="none" stroke="#7a3f30" strokeWidth="1.5" strokeLinecap="round" />
        {a.glasses && (
          <g fill="none" stroke="#2a211d" strokeWidth="1.4">
            <circle cx="27" cy="31.5" r="4" />
            <circle cx="37" cy="31.5" r="4" />
            <path d="M31 31.5h2" />
          </g>
        )}
      </g>
    </svg>
  );
}

export function Avatar({ e, size = 36, className, dim }: { e: Pick<Employee, "name" | "avatar" | "team">; size?: number; className?: string; dim?: boolean }) {
  return <AvatarFace style={avatarOf(e)} shirt={TEAM_SHIRT[e.team] || "#3a3f4b"} size={size} className={className} title={e.name} dim={dim} />;
}
