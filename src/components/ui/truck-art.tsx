/** Camion vu de trois quarts, dessiné comme le modèle 3D du plan du dépôt :
    caisse blanche, bandeau à la couleur de l'état en haut de la caisse, rond Crouzil côté cabine,
    cabine droite à pare-brise sombre, deux essieux, halo d'état au sol. */
export function TruckArt({ state, small, className }: { state: "ok" | "warn" | "bad"; small?: boolean; className?: string }) {
  const c = { ok: "#2f9e5b", warn: "#e08a1e", bad: "#d6333a" }[state];
  // proportions du modèle 3D : longueur 6,2 (VL 3,4), cabine 1,6 (1,2), hauteur 2,4 (1,7), cabine à 72 % de la hauteur
  const k = 22; // pixels par mètre
  const L = (small ? 3.4 : 6.2) * k, cab = (small ? 1.2 : 1.6) * k, H = (small ? 1.7 : 2.4) * k;
  const dx = 0.95 * k, dy = -0.5 * k; // profondeur de la caisse (vue de trois quarts)
  const x0 = (240 - L - dx) / 2, base = 96, wheel = 0.42 * k, lift = 0.45 * k;
  const yTop = base - lift - H, x1 = x0 + L - cab, x2 = x0 + L;
  const cabTop = base - lift - H * 0.72;
  const p = (pts: [number, number][]) => pts.map((q) => q.join(",")).join(" ");
  const side = "#f6f4f1", top = "#ffffff", front = "#d9d4cd", edge = "rgb(0 0 0 / .18)";
  return (
    <svg viewBox="0 0 240 118" className={className} aria-hidden>
      <ellipse cx={x0 + L / 2 + dx / 2} cy={base + 4} rx={L * 0.62} ry={11} fill={c} opacity=".22" />
      {/* roues côté caché */}
      {[x0 + 0.9 * k, x2 - 0.7 * k].map((x) => (
        <ellipse key={"b" + x} cx={x + dx} cy={base - wheel + dy} rx={wheel * 0.95} ry={wheel} fill="#1d1b19" />
      ))}
      {/* caisse */}
      <polygon points={p([[x0, yTop], [x1, yTop], [x1 + dx, yTop + dy], [x0 + dx, yTop + dy]])} fill={top} stroke={edge} />
      <polygon points={p([[x1, yTop], [x1 + dx, yTop + dy], [x1 + dx, base - lift + dy], [x1, base - lift]])} fill={front} stroke={edge} />
      <rect x={x0} y={yTop} width={L - cab} height={H} fill={side} stroke={edge} />
      <rect x={x0} y={yTop + H * 0.12} width={L - cab} height={0.28 * k} fill={c} />
      <polygon points={p([[x0, yTop + H * 0.12], [x0 + dx, yTop + H * 0.12 + dy], [x0 + dx, yTop + H * 0.12 + dy + 0.28 * k], [x0, yTop + H * 0.12 + 0.28 * k]])} fill={c} opacity=".8" />
      <circle cx={x1 - 0.85 * k} cy={yTop + H * 0.55} r={0.42 * k} fill="#ce0013" />
      <circle cx={x1 - 0.85 * k} cy={yTop + H * 0.55} r={0.27 * k} fill="none" stroke="#fff" strokeWidth="1.6" />
      {/* cabine */}
      <polygon points={p([[x1, cabTop], [x2, cabTop], [x2 + dx, cabTop + dy], [x1 + dx, cabTop + dy]])} fill={top} stroke={edge} />
      <polygon points={p([[x2, cabTop], [x2 + dx, cabTop + dy], [x2 + dx, base - lift + dy], [x2, base - lift]])} fill={front} stroke={edge} />
      <polygon points={p([[x2 + 1.5, cabTop + H * 0.1], [x2 + dx - 1.5, cabTop + dy + H * 0.1], [x2 + dx - 1.5, cabTop + dy + H * 0.4], [x2 + 1.5, cabTop + H * 0.4]])} fill="#2c3440" />
      <rect x={x1} y={cabTop} width={cab} height={base - lift - cabTop} fill={side} stroke={edge} />
      <rect x={x1 + cab * 0.22} y={cabTop + H * 0.1} width={cab * 0.6} height={H * 0.24} rx="2" fill="#2c3440" opacity=".85" />
      {/* châssis et roues visibles */}
      <rect x={x0} y={base - lift} width={L} height={lift * 0.45} fill="#3a3f4b" />
      {[x0 + 0.9 * k, x2 - 0.7 * k].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={base - wheel} rx={wheel * 0.95} ry={wheel} fill="#26221f" />
          <ellipse cx={x} cy={base - wheel} rx={wheel * 0.4} ry={wheel * 0.42} fill="#a9a39d" />
        </g>
      ))}
    </svg>
  );
}
