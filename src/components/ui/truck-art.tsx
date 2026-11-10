/** Camion vu de profil : couleur d'état sur la caisse, capsule Crouzil */
export function TruckArt({ state, small, className }: { state: "ok" | "warn" | "bad"; small?: boolean; className?: string }) {
  const c = { ok: "#2f9e5b", warn: "#e08a1e", bad: "#d6333a" }[state];
  const L = small ? 130 : 190;
  return (
    <svg viewBox="0 0 220 96" className={className} aria-hidden>
      <ellipse cx={110} cy={88} rx={small ? 70 : 100} ry={5} fill="rgb(0 0 0 / .08)" />
      <g transform={`translate(${(220 - L - 40) / 2} 0)`}>
        <rect x="0" y={small ? 30 : 12} width={L - 40} height={small ? 46 : 64} rx="6" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
        <rect x="0" y={small ? 30 : 12} width={L - 40} height="9" rx="4" fill={c} />
        <circle cx={(L - 40) / 2} cy={small ? 54 : 46} r={small ? 11 : 15} fill="#ce0013" />
        <circle cx={(L - 40) / 2} cy={small ? 54 : 46} r={small ? 7 : 10} fill="none" stroke="#fff" strokeWidth="2" />
        <path d={`M${L - 38} 34h24l16 22v20h-40z`} fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
        <path d={`M${L - 32} 39h16l11 15h-27z`} fill="#2c3440" opacity=".85" />
        <rect x={L - 38} y="70" width="40" height="6" fill="#3a3f4b" />
        {[22, L - 70, L - 8].filter((x, i) => !(small && i === 1)).map((x) => (
          <g key={x}>
            <circle cx={x} cy="78" r="10" fill="#26221f" />
            <circle cx={x} cy="78" r="4" fill="#a9a39d" />
          </g>
        ))}
      </g>
    </svg>
  );
}
