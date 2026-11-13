"use client";
/* Dépôt Crouzil d'Ayguesvives en 3D, d'après le plan annoté (vue aérienne).
   Unité : 1 = 1 mètre. x vers l'est, z vers le sud (la route est au sud).
   Bâtiment clair : soft, vins, sirop, alcool, 3 rideaux de quai en façade.
   Bâtiments sombres : verres et fûts, fûts, dépose commandes, bureau téléachat. */
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { DepotStaff, DepotSummary, DepotVehicle, ZoneId } from "./summary";
import { avatarOf, HAIR_COLORS, SKINS, TEAM_SHIRT } from "@/lib/domain/avatar";
import { ZONE_META } from "./overview";

export type Selection =
  | { type: "zone"; id: ZoneId }
  | { type: "vehicle"; id: string }
  | { type: "staff"; id: string }
  | null;

type Zone = {
  id: ZoneId;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
  pinY: number;
};
/* Emprise au sol de chaque zone (m) */
export const ZONES: Zone[] = [
  { id: "vide", x: -178, z: -16, w: 80, d: 46, color: "#cfc4b6", pinY: 4 },
  { id: "verres", x: -95, z: -22, w: 80, d: 36, color: "#ddd5cb", pinY: 11 },
  { id: "futs", x: -15, z: -26, w: 22, d: 30, color: "#ddd5cb", pinY: 11 },
  { id: "patio", x: 7, z: -26, w: 21, d: 18, color: "#cbbfb1", pinY: 5 },
  { id: "depose", x: 7, z: -8, w: 21, d: 14, color: "#e3dacf", pinY: 9 },
  { id: "bureau", x: -2, z: 6, w: 16, d: 11, color: "#9a958f", pinY: 6 },
  // salle café : sol stratifié gris, côté ouest, le bureau dans son prolongement
  { id: "cafe", x: -12, z: 6, w: 10, d: 11, color: "#9a958f", pinY: 6 },
  { id: "soft", x: 28, z: -35, w: 30, d: 47, color: "#e6ded4", pinY: 12 },
  { id: "vins", x: 58, z: -35, w: 42, d: 36, color: "#e6ded4", pinY: 12 },
  { id: "sirop", x: 58, z: 1, w: 26, d: 11, color: "#ece4da", pinY: 6 },
  { id: "alcool", x: 84, z: 1, w: 16, d: 11, color: "#ece4da", pinY: 6 },
  { id: "quais", x: 28, z: 12, w: 34, d: 9, color: "#c9bfb3", pinY: 6 },
  { id: "parking", x: 62, z: 14, w: 40, d: 16, color: "#bdb2a5", pinY: 4 },
];
const zoneOf = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
const center = (id: ZoneId) => {
  const z = zoneOf(id);
  return new THREE.Vector3(z.x + z.w / 2, 0, z.z + z.d / 2);
};
const STATE_COLOR = { ok: "#2f9e5b", warn: "#e08a1e", bad: "#d6333a" };
const ROAD_Z = 42;

/* Emplacements des véhicules : devant les 3 rideaux, puis le stationnement */
const SPOTS: [number, number, number][] = [
  [34, 18.5, Math.PI / 2],
  [45, 18.5, Math.PI / 2],
  [56, 18.5, Math.PI / 2],
  [68, 22, Math.PI / 2],
  [74, 22, Math.PI / 2],
  [80, 22, Math.PI / 2],
  [86, 22, Math.PI / 2],
  [92, 22, Math.PI / 2],
  [98, 22, Math.PI / 2],
  [20, 26, 0],
  [8, 26, 0],
];

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const f = () => setDark(el.classList.contains("dark"));
    f();
    const mo = new MutationObserver(f);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function Mat({
  c,
  ...rest
}: { c: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={c} roughness={0.85} {...rest} />;
}

export function Box({
  s,
  p,
  c,
  cast = true,
  ...rest
}: {
  s: [number, number, number];
  p: [number, number, number];
  c: string;
  cast?: boolean;
} & Partial<THREE.MeshStandardMaterialParameters>) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <Mat c={c} {...rest} />
    </mesh>
  );
}

/* Boîtes instanciées : une seule géométrie pour des centaines d'objets */
function useBoxes(
  list: {
    p: [number, number, number];
    s: [number, number, number];
    c?: string;
  }[],
) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(),
      col = new THREE.Color();
    list.forEach((b, i) => {
      o.position.set(...b.p);
      o.scale.set(...b.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (b.c) m.setColorAt(i, col.set(b.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list]);
  return ref;
}
function Boxes({
  list,
  c = "#ffffff",
  cast = true,
  ...rest
}: {
  list: {
    p: [number, number, number];
    s: [number, number, number];
    c?: string;
  }[];
  c?: string;
  cast?: boolean;
} & Partial<THREE.MeshStandardMaterialParameters>) {
  const ref = useBoxes(list);
  if (!list.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, list.length]}
      castShadow={cast}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <Mat c={c} {...rest} />
    </instancedMesh>
  );
}
function Kegs({ list }: { list: [number, number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    list.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [list]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, list.length]}
      castShadow
    >
      <cylinderGeometry args={[0.27, 0.27, 0.6, 10]} />
      <Mat c="#c4cad2" metalness={0.55} roughness={0.35} />
    </instancedMesh>
  );
}

/* Pile de fûts sur palettes : 4 fûts par palette, h palettes */
function kegStack(
  x: number,
  z: number,
  h: number,
  kegs: [number, number, number][],
  pals: { p: [number, number, number]; s: [number, number, number] }[],
) {
  for (let l = 0; l < h; l++) {
    const y = l * 0.78;
    pals.push({ p: [x, y + 0.07, z], s: [1.2, 0.14, 1.2] });
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++)
        kegs.push([x - 0.28 + a * 0.56, y + 0.45, z - 0.28 + b * 0.56]);
  }
}

/* Bâtiment en coupe : murs du fond et des côtés pleine hauteur, façade basse pour voir dedans */
function Shell({
  x,
  z,
  w,
  d,
  h,
  roof,
  wall = "#ece5dc",
  front = 2.2,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  roof: string;
  wall?: string;
  front?: number;
}) {
  const t = 0.4;
  return (
    <group>
      <Box s={[w, h, t]} p={[x + w / 2, h / 2, z]} c={wall} />
      <Box s={[t, h, d]} p={[x, h / 2, z + d / 2]} c={wall} />
      <Box s={[t, h, d]} p={[x + w, h / 2, z + d / 2]} c={wall} />
      <Box s={[w, front, t]} p={[x + w / 2, front / 2, z + d]} c={wall} />
      {/* rive de toit, rappel de la couleur vue du ciel */}
      <Box s={[w + 0.6, 0.5, 1.2]} p={[x + w / 2, h + 0.25, z]} c={roof} />
      <Box s={[1.2, 0.5, d]} p={[x, h + 0.25, z + d / 2]} c={roof} />
      <Box s={[1.2, 0.5, d]} p={[x + w, h + 0.25, z + d / 2]} c={roof} />
    </group>
  );
}

/* Racks : 30 m de long, 6 m de haut, 3 niveaux, en double rangée dos à dos */
function useRacks() {
  return useMemo(() => {
    const up: { p: [number, number, number]; s: [number, number, number] }[] =
      [];
    const beam: typeof up = [];
    const pal: {
      p: [number, number, number];
      s: [number, number, number];
      c: string;
    }[] = [];
    const cols = [
      "#d8b48a",
      "#efebe5",
      "#c9a37a",
      "#9eb7c9",
      "#e9e3dc",
      "#b54d3a",
      "#d9cfbf",
      "#7f9a6f",
      "#e8c3c8",
    ];
    const run = (x: number, z0: number) => {
      const bays = 11,
        bay = 2.7;
      for (let s = 0; s < 2; s++) {
        const xx = x + s * 1.2;
        for (let b = 0; b <= bays; b++)
          up.push({ p: [xx, 3, z0 + b * bay], s: [0.12, 6, 0.12] });
        for (let b = 0; b < bays; b++)
          for (let l = 0; l < 3; l++) {
            const y = 0.15 + l * 2;
            beam.push({
              p: [xx, y + (l ? 0 : 0), z0 + b * bay + bay / 2],
              s: [0.1, 0.14, bay],
            });
            for (let k = 0; k < 2; k++) {
              const seed =
                (Math.round(x) * 7 + b * 13 + l * 5 + k * 3 + s) % 17;
              if (seed === 0 || seed === 9) continue;
              pal.push({
                p: [xx, y + 0.85, z0 + b * bay + 0.68 + k * 1.34],
                s: [1.0, 1.4 - (seed % 3) * 0.15, 1.15],
                c: cols[seed % cols.length],
              });
            }
          }
      }
    };
    // Soft : 4 doubles rangées ; vins : 6 doubles rangées (30 m le long de z)
    [31.5, 37.5, 43.5, 49.5].forEach((x) => run(x, -33));
    [61, 67, 73, 79, 85, 91].forEach((x) => run(x, -33));
    return { up, beam, pal };
  }, []);
}

function Interior() {
  const racks = useRacks();
  const { kegs, pals, loads, glass } = useMemo(() => {
    const kegs: [number, number, number][] = [];
    const pals: { p: [number, number, number]; s: [number, number, number] }[] =
      [];
    const loads: {
      p: [number, number, number];
      s: [number, number, number];
      c: string;
    }[] = [];
    const glass: typeof loads = [];
    // Fûts (bâtiment) : blocs de fûts sur palettes
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 9; j++)
        if ((i + j) % 5)
          kegStack(
            -12 + i * 2.6,
            -23 + j * 2.8,
            2 + ((i * 3 + j) % 3),
            kegs,
            pals,
          );
    // Patio : fûts au pied du bardage, comme sur la photo
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++)
        kegStack(
          9.5 + i * 2.9,
          -23.5 + j * 3.3,
          3 + ((i + j * 2) % 4),
          kegs,
          pals,
        );
    // Verres et fûts : palettes de verres filmées et fûts
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 5; j++) {
        const x = -91 + i * 4.6,
          z = -18 + j * 5.5;
        if (i < 9)
          glass.push(
            {
              p: [x, 0.85, z],
              s: [1.2, 1.6, 1.0],
              c: ["#f3f1ec", "#e7ecef", "#ecdfc8"][(i + j) % 3],
            },
            { p: [x + 1.5, 0.85, z], s: [1.2, 1.6, 1.0], c: "#f3f1ec" },
          );
        else kegStack(x, z, 2 + ((i + j) % 3), kegs, pals);
      }
    // Vides : retours éparpillés dans la cour
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 6; j++) {
        const r = (i * 31 + j * 17) % 11;
        if (r > 6) continue;
        const x = -172 + i * 5.4 + (r % 3),
          z = -10 + j * 6.5 + (r % 2) * 1.5;
        if (r % 2) kegStack(x, z, 1 + (r % 3), kegs, pals);
        else
          loads.push({
            p: [x, 0.5 + r * 0.1, z],
            s: [1.2, 1 + r * 0.2, 1.0],
            c: ["#5f7fa0", "#b7a07a", "#7a8f5a", "#a35a4a"][r % 4],
          });
      }
    // Dépose commandes : palettes préparées, filmées, alignées
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++)
        loads.push({
          p: [10 + i * 3, 0.8, -5.5 + j * 3.6],
          s: [1.2, 1.5, 1.0],
          c: ["#e9e3dc", "#d2a36d", "#c4a882", "#b9cfe0"][(i + j) % 4],
        });
    // Devant les quais, dans le soft : palettes en attente de chargement
    for (let i = 0; i < 8; i++)
      loads.push({
        p: [31 + i * 3.4, 0.8, 7],
        s: [1.2, 1.5, 1.0],
        c: ["#e9e3dc", "#d2a36d", "#9eb7c9"][i % 3],
      });
    return { kegs, pals, loads, glass };
  }, []);
  // Sirop : étagères basses ; alcool : 2 niveaux, 2 m maxi, en cage
  const shelves = useMemo(() => {
    const frame: {
      p: [number, number, number];
      s: [number, number, number];
    }[] = [];
    const goods: {
      p: [number, number, number];
      s: [number, number, number];
      c: string;
    }[] = [];
    const runs = (
      x0: number,
      z0: number,
      n: number,
      len: number,
      h: number,
      levels: number,
      palette: string[],
    ) => {
      for (let r = 0; r < n; r++) {
        const z = z0 + r * 3;
        frame.push({ p: [x0 + len / 2, h / 2, z - 0.45], s: [len, h, 0.06] });
        for (let l = 0; l < levels; l++) {
          frame.push({
            p: [x0 + len / 2, 0.2 + (l * h) / levels, z],
            s: [len, 0.06, 0.9],
          });
          for (let k = 0; k < len / 0.7 - 1; k++)
            goods.push({
              p: [x0 + 0.5 + k * 0.7, 0.45 + (l * h) / levels, z],
              s: [0.5, 0.45, 0.6],
              c: palette[(k + l + r) % palette.length],
            });
        }
      }
    };
    runs(60, 3.5, 3, 22, 2.2, 3, [
      "#e4572e",
      "#f2a541",
      "#c8e087",
      "#76b041",
      "#ffffff",
    ]);
    runs(86, 3.5, 3, 12, 2, 2, [
      "#6b3fb8",
      "#ffffff",
      "#3c8a5c",
      "#d0a02b",
      "#9d2b2b",
      "#2a3a6b",
    ]);
    return { frame, goods };
  }, []);
  return (
    <group>
      <Boxes list={racks.up} c="#23407a" />
      <Boxes list={racks.beam} c="#e2721c" />
      <Boxes list={racks.pal} />
      <Kegs list={kegs} />
      <Boxes list={pals} c="#8e6a45" />
      <Boxes list={loads} />
      <Boxes list={glass} />
      <Boxes list={shelves.frame} c="#2c3e66" />
      <Boxes list={shelves.goods} cast={false} />
      {/* cage grillagée de l'alcool */}
      <mesh position={[92, 1.4, 6.5]}>
        <boxGeometry args={[15, 2.8, 10, 15, 3, 10]} />
        <meshBasicMaterial color="#7d8794" wireframe />
      </mesh>
      {/* bureau à l'est, salle café à l'ouest : le bureau est dessiné pour x -12..4 et décalé de 10 m,
          la salle café dessinée pour x 4..14 est retournée en miroir (x' = 2 - x), cloison à x = -2 */}
      <group position={[10, 0, 0]}>
        <Office />
      </group>
      <group position={[2, 0, 0]} scale={[-1, 1, 1]}>
        <CafeRoom />
      </group>
    </group>
  );
}

/* Salle café, d'après photo : grande table bois et 8 chaises, chaise bleue en bout,
   table d'appoint avec micro-ondes côté fenêtres, comptoir bois et affiche à l'entrée */
function Chair({ p, r = 0, c = "#3a3d44" }: { p: [number, number]; r?: number; c?: string }) {
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, r, 0]}>
      <Box s={[0.45, 0.06, 0.45]} p={[0, 0.46, 0]} c={c} />
      <Box s={[0.45, 0.5, 0.05]} p={[0, 0.78, 0.2]} c={c} />
      {[-0.19, 0.19].map((x) => [-0.19, 0.19].map((z) => <Box key={x + "/" + z} s={[0.04, 0.46, 0.04]} p={[x, 0.23, z]} c="#8d9096" cast={false} />))}
    </group>
  );
}
/* Bureau téléachat, d'après photo : îlots de bureaux bois clair face à face, écrans noirs,
   fauteuils noirs, caissons blancs, poteau central, tableau blanc et vitre sur le dépôt */
function Office() {
  return (
    <group>
      {/* un seul îlot de 4 postes, dans la longueur de la pièce, poteau au milieu */}
      <group position={[-4, 0, 10.2]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.82, 0.82].map((dx) => [-0.42, 0.42].map((dz) => (
          <group key={dx + "/" + dz} position={[dx, 0, dz]}>
            <Box s={[1.6, 0.05, 0.8]} p={[0, 0.74, 0]} c="#ecd9b8" />
            <Box s={[0.1, 0.72, 0.1]} p={[0, 0.36, 0]} c="#f2f0ec" cast={false} />
            {/* deux écrans sur bras, clavier */}
            {[-0.3, 0.3].map((m) => <Box key={m} s={[0.55, 0.34, 0.03]} p={[m, 1.1, dz > 0 ? -0.28 : 0.28]} c="#17181c" />)}
            <Box s={[0.06, 0.24, 0.06]} p={[0, 0.88, dz > 0 ? -0.3 : 0.3]} c="#17181c" cast={false} />
            <Box s={[0.42, 0.02, 0.14]} p={[0, 0.78, dz > 0 ? 0.08 : -0.08]} c="#1d1e22" cast={false} />
            <Box s={[0.3, 0.01, 0.42]} p={[0.5, 0.775, 0]} c="#f7f6f3" cast={false} />
            {/* fauteuil noir */}
            <group position={[0, 0, dz > 0 ? 0.8 : -0.8]} rotation={[0, dz > 0 ? 0 : Math.PI, 0]}>
              <Box s={[0.48, 0.07, 0.46]} p={[0, 0.48, 0]} c="#1d1e22" />
              <Box s={[0.46, 0.66, 0.06]} p={[0, 0.9, 0.22]} c="#1d1e22" />
              <Box s={[0.07, 0.44, 0.07]} p={[0, 0.24, 0]} c="#3a3d44" cast={false} />
              <Box s={[0.5, 0.04, 0.5]} p={[0, 0.03, 0]} c="#1d1e22" cast={false} />
              {/* gilet haute visibilité posé sur un dossier */}
              {dx < 0 && dz < 0 && <Box s={[0.5, 0.5, 0.1]} p={[0, 0.95, 0.25]} c="#d7f03c" emissive="#b8d41f" emissiveIntensity={0.15} />}
            </group>
          </group>
        )))}
      </group>
      <Box s={[0.2, 4.5, 0.2]} p={[-4, 2.25, 10.2]} c="#c9cdd2" />
      {/* deux caissons blancs à plateau bois, en bout d'îlot */}
      {[-4.55, -3.45].map((x) => (
        <group key={x}>
          <Box s={[0.9, 0.62, 0.6]} p={[x, 0.31, 12.3]} c="#f7f6f3" />
          <Box s={[0.94, 0.04, 0.64]} p={[x, 0.64, 12.3]} c="#ecd9b8" />
          <Box s={[0.35, 0.18, 0.28]} p={[x, 0.75, 12.3]} c="#26272b" />
        </group>
      ))}
      {/* dalles lumineuses du plafond */}
      <pointLight position={[-8, 3.9, 11]} intensity={40} distance={16} color="#fff6e8" />
      <pointLight position={[-1, 3.9, 11]} intensity={40} distance={16} color="#fff6e8" />
      {/* mur du fond : tableau blanc, vitre sur le dépôt */}
      <Box s={[1.5, 1.9, 0.05]} p={[-5.3, 1.75, 6.26]} c="#fbfbfa" cast={false} />
      <Box s={[1.6, 0.06, 0.07]} p={[-5.3, 2.72, 6.27]} c="#aeb2b8" cast={false} />
      <Box s={[3.4, 0.95, 0.05]} p={[-1.6, 1.95, 6.26]} c="#4d5a66" cast={false} roughness={0.2} />
      {[-2.9, -2.2, -1.5, -0.8, -0.2].map((x) => <Box key={x} s={[0.4, 0.5, 0.02]} p={[x, 1.8, 6.3]} c="#c9ced4" cast={false} metalness={0.5} roughness={0.35} />)}
      <Box s={[3.6, 0.06, 0.2]} p={[-1.6, 1.45, 6.34]} c="#fbfaf8" cast={false} />
      {/* à droite : armoires blanches à rideaux, cartons, extincteur */}
      <Box s={[0.5, 2, 2.6]} p={[3.6, 1, 7.7]} c="#f4f3ef" />
      {[6.9, 7.7, 8.5].map((z) => <Box key={z} s={[0.02, 1.95, 0.03]} p={[3.34, 1, z]} c="#b9bcc0" cast={false} />)}
      <Box s={[0.5, 0.3, 0.7]} p={[3.6, 2.15, 7.4]} c="#c9a37a" cast={false} />
      <Box s={[0.6, 0.5, 0.6]} p={[1.7, 0.25, 6.8]} c="#c9a37a" />
      <Box s={[0.55, 0.45, 0.55]} p={[1.7, 0.73, 6.8]} c="#b98f62" />
      <Box s={[0.5, 0.4, 0.5]} p={[2.4, 0.2, 6.8]} c="#efe9df" />
      <mesh position={[3.6, 0.32, 13.6]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
        <Mat c="#c0262d" />
      </mesh>
      {/* à gauche : paperboard avec la carte des secteurs, table noire, table d'appoint, cartons */}
      <Box s={[0.75, 1, 0.04]} p={[-9.6, 1.45, 6.9]} c="#fbfbfa" />
      <Box s={[0.4, 0.3, 0.02]} p={[-9.6, 1.6, 6.93]} c="#8fb37a" cast={false} />
      <Box s={[0.4, 0.3, 0.02]} p={[-9.6, 1.2, 6.93]} c="#8fb37a" cast={false} />
      <Box s={[0.05, 0.95, 0.05]} p={[-9.6, 0.48, 6.9]} c="#3a3d44" cast={false} />
      <Box s={[2.2, 0.9, 0.7]} p={[-7.4, 0.45, 6.8]} c="#26272b" />
      <Box s={[0.7, 0.05, 1.8]} p={[-11.3, 0.74, 9.2]} c="#ecd9b8" />
      <Box s={[0.1, 0.72, 0.1]} p={[-11.3, 0.36, 9.2]} c="#f2f0ec" cast={false} />
      {[[-11.2, 10.9, 0.5], [-10.6, 11.3, 0.35], [-11.2, 11.7, 0.4], [-10.5, 10.6, 0.3]].map(([x, z, h], i) => <Box key={i} s={[0.5, h, 0.45]} p={[x, h / 2, z]} c={i % 2 ? "#b98f62" : "#c9a37a"} />)}
      {/* porte vers le dépôt, armoire noire et meuble bois côté entrée */}
      <Box s={[0.9, 2.05, 0.06]} p={[-10.9, 1.03, 6.26]} c="#2a2c31" cast={false} />
      <Box s={[0.5, 1.9, 1.4]} p={[-11.5, 0.95, 13.6]} c="#26272b" />
      <Box s={[0.6, 1.3, 2.2]} p={[-11.4, 0.65, 15.6]} c="#e3caa4" />
    </group>
  );
}
function CafeRoom() {
  return (
    <group>
      {/* cloison avec le bureau, passage ouvert */}
      <Box s={[0.2, 3, 3]} p={[4, 1.5, 7.5]} c="#f1ebe3" />
      <Box s={[0.2, 3, 6]} p={[4, 1.5, 14]} c="#f1ebe3" />
      {/* comptoir bois et affiche du château, côté bureau */}
      <Box s={[0.7, 1.35, 1.8]} p={[3.3, 0.68, 12.2]} c="#e3caa4" />
      <Box s={[0.06, 1.1, 1.7]} p={[3.3, 2.0, 12.2]} c="#a9c3d6" cast={false} />
      <Box s={[0.08, 0.7, 0.5]} p={[3.3, 1.85, 12.5]} c="#d8b784" cast={false} />
      <Box s={[0.08, 0.5, 0.9]} p={[3.3, 1.75, 11.9]} c="#7f9a6f" cast={false} />
      {/* grande table (deux plateaux bout à bout) */}
      <Box s={[4.4, 0.06, 1.1]} p={[10.2, 0.75, 10]} c="#c9965a" />
      {[8.7, 10.2, 11.7].map((x) => <Box key={x} s={[0.12, 0.72, 0.7]} p={[x, 0.36, 10]} c="#e9e7e3" cast={false} />)}
      {[8.6, 9.65, 10.7, 11.75].map((x) => (
        <group key={x}>
          <Chair p={[x, 9.05]} r={Math.PI} />
          <Chair p={[x, 10.95]} />
        </group>
      ))}
      <Chair p={[7.5, 10]} r={-Math.PI / 2} c="#6f7fc4" />
      {/* dalles lumineuses du plafond */}
      <pointLight position={[9, 3.9, 11]} intensity={40} distance={16} color="#fff6e8" />
      {/* fenêtres côté nord, table d'appoint, micro-ondes, poubelle, cartons */}
      <Box s={[5, 1, 0.06]} p={[8.5, 2.1, 6.25]} c="#bcd3e0" cast={false} emissive="#bcd3e0" emissiveIntensity={0.25} />
      <Box s={[1.6, 0.05, 0.7]} p={[7.4, 0.72, 6.8]} c="#efece7" />
      <Box s={[0.1, 0.7, 0.1]} p={[7.4, 0.35, 6.8]} c="#a7a9ad" cast={false} />
      <Box s={[0.5, 0.3, 0.38]} p={[7.1, 0.9, 6.8]} c="#f4f2ee" />
      <Box s={[0.3, 0.2, 0.02]} p={[7.05, 0.9, 7.0]} c="#2a2d36" cast={false} />
      <Box s={[0.4, 0.6, 0.4]} p={[8.8, 0.3, 6.8]} c="#1d1e22" />
      <Box s={[0.5, 0.4, 0.4]} p={[5.6, 0.2, 7]} c="#c9a37a" />
      <Box s={[0.5, 0.45, 0.4]} p={[5.6, 0.23, 7.7]} c="#efe9df" />
      <Box s={[0.12, 0.25, 0.02]} p={[5.6, 0.25, 7.91]} c="#b3202a" cast={false} />
      {/* coin boissons au fond à droite, porte du fond */}
      <Box s={[0.5, 0.5, 0.5]} p={[12.6, 0.75, 13.2]} c="#1d1e22" />
      <Box s={[0.6, 0.5, 0.5]} p={[12.6, 0.25, 13.2]} c="#b3202a" />
      <Box s={[0.5, 0.3, 0.4]} p={[12.9, 0.15, 14.1]} c="#c9a37a" />
      <Box s={[0.06, 2.05, 0.9]} p={[13.75, 1.03, 11.6]} c="#fbfaf8" cast={false} />
      <Box s={[0.02, 0.25, 0.22]} p={[13.7, 1.6, 11.6]} c="#e9c22b" cast={false} />
    </group>
  );
}

/* Les 3 rideaux de quai en façade du bâtiment clair */
function Doors() {
  return (
    <group>
      {[34, 45, 56].map((x) => (
        <group key={x} position={[x, 0, 12]}>
          <Box
            s={[4.4, 5, 0.3]}
            p={[0, 2.5, 0]}
            c="#9aa3ad"
            metalness={0.4}
            roughness={0.5}
          />
          {[0.6, 1.4, 2.2, 3, 3.8, 4.6].map((y) => (
            <Box
              key={y}
              s={[4.4, 0.05, 0.34]}
              p={[0, y, 0]}
              c="#7d868f"
              cast={false}
            />
          ))}
          <Box s={[5.2, 0.5, 0.6]} p={[0, 5.3, 0]} c="#ce0013" />
          <Box s={[4.6, 1.2, 3]} p={[0, 0.6, 1.6]} c="#8d857c" />
        </group>
      ))}
    </group>
  );
}

export function Truck({
  v,
  spot,
  selected,
  onSelect,
}: {
  v: DepotVehicle;
  spot: [number, number, number];
  selected: boolean;
  onSelect?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const small = /vl|utilitaire|fourgon/i.test(v.kind + v.name);
  const L = small ? 3.4 : 6.2,
    cabL = small ? 1.2 : 1.6,
    H = small ? 1.7 : 2.4;
  const col = STATE_COLOR[v.state];
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (halo.current)
      (halo.current.material as THREE.MeshBasicMaterial).opacity = selected
        ? 0.5
        : v.state === "bad"
          ? 0.22 + Math.sin(clock.elapsedTime * 3) * 0.12
          : 0.2;
  });
  return (
    <group
      position={[spot[0], 0, spot[1]]}
      rotation={[0, spot[2], 0]}
      scale={1.45}
      onClick={onSelect}
    >
      <mesh position={[-cabL / 2, H / 2 + 0.45, 0]} castShadow>
        <boxGeometry args={[L - cabL, H, 1.9]} />
        <Mat c="#f6f4f1" />
      </mesh>
      <mesh position={[(L - cabL) / 2, H * 0.36 + 0.45, 0]} castShadow>
        <boxGeometry args={[cabL, H * 0.72, 1.9]} />
        <Mat c="#f6f4f1" />
      </mesh>
      <mesh position={[L / 2 + 0.01, H * 0.52 + 0.45, 0]}>
        <boxGeometry args={[0.06, H * 0.28, 1.6]} />
        <Mat c="#2c3440" roughness={0.2} />
      </mesh>
      <mesh position={[-cabL / 2, H * 0.82 + 0.45, 0]}>
        <boxGeometry args={[L - cabL + 0.02, 0.28, 1.92]} />
        <Mat c={col} />
      </mesh>
      <mesh
        position={[-cabL / 2 + (L - cabL) / 2 - 0.6, H * 0.45 + 0.45, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.42, 0.42, 1.94, 24]} />
        <Mat c="#ce0013" />
      </mesh>
      {[
        [L / 2 - 0.7, 0.95],
        [L / 2 - 0.7, -0.95],
        [-L / 2 + 0.9, 0.95],
        [-L / 2 + 0.9, -0.95],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          position={[x, 0.42, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.42, 0.42, 0.3, 14]} />
          <Mat c="#26221f" />
        </mesh>
      ))}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[L * 0.62, 32]} />
        <meshBasicMaterial
          color={col}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Forklift({ path }: { path: [number, number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const [x0, z0, x1, z1] = path;
    const t = (Math.sin(clock.elapsedTime * 0.25) + 1) / 2;
    g.current.position.set(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t);
    g.current.rotation.y =
      Math.atan2(-(z1 - z0), x1 - x0) +
      (Math.cos(clock.elapsedTime * 0.25) > 0 ? 0 : Math.PI);
  });
  return (
    <group ref={g} scale={1.3}>
      <Box s={[1.2, 0.8, 0.8]} p={[0, 0.6, 0]} c="#e9b81f" />
      <Box s={[0.1, 2.2, 0.7]} p={[0.65, 1.1, 0]} c="#333333" />
      <Box s={[0.9, 0.9, 0.8]} p={[1.2, 0.55, 0]} c="#d2a36d" />
    </group>
  );
}

/* Où se tiennent les gens dans chaque zone (allées, devant les postes…) */
const STAND: Partial<Record<ZoneId, [number, number, number, number]>> = {
  soft: [30, -2.2, 56, -0.5],
  vins: [60, -2.2, 98, -0.5],
  sirop: [59, 9.8, 82, 11],
  alcool: [85, 10, 98, 11],
  quais: [30, 14.5, 60, 16],
  parking: [64, 17, 100, 18.5],
  bureau: [1, 13.4, 11.5, 15.6],
  cafe: [-9.5, 12.6, -4, 15],
  depose: [9, 1.5, 26, 4.5],
  futs: [-13, -2, 5, 2],
  patio: [9, -11, 26, -9],
  verres: [-90, 8, -20, 11],
  vide: [-170, 22, -105, 26],
};
export function standingSpots(staff: DepotStaff[]) {
  const out = new Map<string, [number, number, number]>();
  const byZone = new Map<ZoneId, DepotStaff[]>();
  staff
    .filter((s) => s.present)
    .forEach((s) => byZone.set(s.zone, [...(byZone.get(s.zone) || []), s]));
  byZone.forEach((list, zid) => {
    const z = zoneOf(zid);
    const [x0, z0, x1, z1] = STAND[zid] || [
      z.x + 2,
      z.z + z.d - 4,
      z.x + z.w - 2,
      z.z + z.d - 2,
    ];
    list.forEach((s, i) => {
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      const jitter = ((s.id.charCodeAt(0) + s.id.charCodeAt(1)) % 7) / 7;
      out.set(s.id, [
        x0 + (x1 - x0) * t,
        z0 + (z1 - z0) * jitter,
        (jitter - 0.5) * 2.4,
      ]);
    });
  });
  return out;
}

/* Un collaborateur : silhouette aux couleurs de son avatar et de son équipe */
function Person({
  s,
  at,
  selected,
  onSelect,
}: {
  s: DepotStaff;
  at: [number, number, number];
  selected: boolean;
  onSelect?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const a = avatarOf({ name: s.name, avatar: s.avatar });
  const skin = SKINS[a.skin] || SKINS[0],
    hair = HAIR_COLORS[a.hairColor] || HAIR_COLORS[0],
    shirt = TEAM_SHIRT[s.team];
  const phase = (s.id.charCodeAt(2) % 10) / 10;
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase * 6;
    g.current.rotation.y = at[2] + Math.sin(t * 0.4) * 0.6;
    g.current.position.y = Math.abs(Math.sin(t * 1.6)) * 0.04;
  });
  return (
    <group position={[at[0], 0, at[1]]} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[selected ? 1.2 : 0.85, 24]} />
        <meshBasicMaterial
          color={selected ? "#ce0013" : shirt}
          transparent
          opacity={selected ? 0.55 : 0.28}
          depthWrite={false}
        />
      </mesh>
      <group ref={g} scale={1.15}>
        <mesh position={[-0.13, 0.42, 0]} castShadow>
          <boxGeometry args={[0.2, 0.84, 0.24]} />
          <Mat c="#2d3340" />
        </mesh>
        <mesh position={[0.13, 0.42, 0]} castShadow>
          <boxGeometry args={[0.2, 0.84, 0.24]} />
          <Mat c="#2d3340" />
        </mesh>
        <mesh position={[0, 1.12, 0]} castShadow>
          <capsuleGeometry args={[0.27, 0.45, 4, 12]} />
          <Mat c={shirt} />
        </mesh>
        <mesh position={[0, 1.66, 0]} castShadow>
          <sphereGeometry args={[0.2, 16, 12]} />
          <Mat c={skin} />
        </mesh>
        {a.hair !== 3 && a.hair !== 9 && (
          <mesh
            position={[0, 1.72, -0.02]}
            scale={a.hair === 7 ? [1.45, 1.35, 1.45] : [1, a.hair === 1 || a.hair === 6 || a.hair === 10 ? 1.15 : 0.8, 1]}
          >
            <sphereGeometry
              args={[0.215, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <Mat c={a.hair === 5 ? "#ce0013" : hair} />
          </mesh>
        )}
        {/* cheveux longs, carré et tresses : dans le dos */}
        {(a.hair === 1 || a.hair === 6 || a.hair === 10) && (
          <mesh position={[0, a.hair === 6 ? 1.6 : 1.46, -0.1]}>
            <boxGeometry args={[0.38, a.hair === 6 ? 0.22 : 0.5, 0.14]} />
            <Mat c={hair} />
          </mesh>
        )}
        {a.hair === 2 && (
          <mesh position={[0, 1.9, -0.1]}>
            <sphereGeometry args={[0.09, 12, 8]} />
            <Mat c={hair} />
          </mesh>
        )}
        {a.hair === 8 && (
          <mesh position={[0, 1.62, -0.24]} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
            <Mat c={hair} />
          </mesh>
        )}
        {a.beard && (
          <mesh position={[0, 1.58, 0.1]} scale={[1, 0.7, 0.6]}>
            <sphereGeometry args={[0.17, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <Mat c={hair} />
          </mesh>
        )}
        {/* gilet haute visibilité pour les chauffeurs et préparateurs */}
        {(s.team === "chauf" || s.team === "prep") && (
          <mesh position={[0, 1.15, 0]}>
            <capsuleGeometry args={[0.285, 0.3, 4, 12]} />
            <Mat
              c="#d7f03c"
              emissive="#b8d41f"
              emissiveIntensity={0.15}
              transparent
              opacity={0.92}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

/* Étiquettes de zone : des boutons HTML posés sur le canevas, déplacés à chaque image */
type PinRefs = React.MutableRefObject<Map<ZoneId, HTMLButtonElement>>;
function PinProjector({ refs }: { refs: PinRefs }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    refs.current.forEach((el, id) => {
      const z = zoneOf(id);
      v.set(z.x + z.w / 2, z.pinY, z.z + z.d / 2).project(camera);
      const show = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      el.style.visibility = show ? "visible" : "hidden";
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`;
    });
  });
  return null;
}
function Pin({
  id,
  info,
  onClick,
  active,
  refs,
}: {
  id: ZoneId;
  info: DepotSummary["zones"][ZoneId];
  onClick: () => void;
  active: boolean;
  refs: PinRefs;
}) {
  return (
    <button
      ref={(el) => {
        if (el) refs.current.set(id, el);
        else refs.current.delete(id);
      }}
      onClick={onClick}
      style={{ visibility: "hidden" }}
      className={
        "absolute top-0 left-0 z-[5] flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-ink shadow-[0_6px_18px_rgba(40,25,15,.2)] " +
        (active ? "border-brand" : "border-line hover:border-brand/50")
      }
    >
      <span
        className={
          "h-2 w-2 rounded-full " + (info.alerts ? "bg-bad" : "bg-navy")
        }
      />
      {ZONE_META[id].name}
      {info.alerts > 0 && (
        <span className="rounded-full bg-bad px-1.5 text-[10px] leading-4 text-white">
          {info.alerts}
        </span>
      )}
    </button>
  );
}

/* ---------- Visite à pied : on entre dans une pièce et on s'y promène ---------- */
type Rect = [number, number, number, number]; // x0, z0, x1, z1
/* Bâtiments (même emprise que les coques dessinées) : à l'intérieur, on se promène dans tout le bâtiment */
const BUILDINGS: Rect[] = [
  [28, -35, 100, 12], // soft, vins, sirop, alcool
  [-95, -22, -15, 14], // verres et fûts
  [-15, -26, 7, 4], // fûts
  [7, -8, 28, 6], // dépose commandes
  [-12, 6, 14, 17], // bureau téléachat
];
const inRect = (r: Rect, x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
/* Rangées de racks (double rangée dos à dos), à contourner */
const RACKS: Rect[] = [
  ...[31.5, 37.5, 43.5, 49.5, 61, 67, 73, 79, 85, 91].map((x): Rect => [x - 0.55, -33.2, x + 1.75, -3.1]),
  // bureau et salle café : cloison (passage ouvert entre z 9 et 11), comptoir, grande table
  [4.7, 8.5, 7.3, 12.7],
  [1.4, 6, 3.8, 7.3],
  [13.2, 6, 14, 9],
  [-2.1, 6, -1.9, 9],
  [-2.1, 11, -1.9, 17],
  [-1.65, 11.3, -0.95, 13.1],
  [-10.4, 9.45, -6, 10.55],
];
const EYE = 1.65;
const R = 0.35; // « épaisseur » du visiteur

/** Zone où l'on marche : le bâtiment qui contient la pièce, sinon la zone extérieure elle-même */
function walkArea(id: ZoneId): Rect {
  const z = zoneOf(id);
  const cx = z.x + z.w / 2, cz = z.z + z.d / 2;
  return BUILDINGS.find((b) => inRect(b, cx, cz)) || [z.x, z.z, z.x + z.w, z.z + z.d];
}
/** Point d'entrée : devant la pièce, côté façade (sud), en regardant vers le fond */
function entryOf(id: ZoneId): [number, number, number?] {
  const z = zoneOf(id);
  const a = walkArea(id);
  // dans les halls de racks, on entre par l'allée transversale, face à une allée entre deux rangées
  if (id === "soft") return [41.1, -1.4];
  if (id === "vins") return [76.6, -1.4];
  // salle café : on entre par le passage depuis le bureau, comme sur la photo (regard vers l'ouest)
  if (id === "cafe") return [-2.9, 10, Math.PI / 2];
  return [z.x + z.w / 2, Math.min(z.z + z.d - 2.5, a[3] - 1.2)];
}
function blocked(x: number, z: number, area: Rect) {
  if (x < area[0] + R || x > area[2] - R || z < area[1] + R || z > area[3] - R) return true;
  return RACKS.some((r) => x > r[0] - R && x < r[2] + R && z > r[1] - R && z < r[3] + R);
}
export type WalkInput = { f: number; s: number; turn: number; run: boolean };

function Walker({ zone, input, onZone }: { zone: ZoneId; input: React.MutableRefObject<WalkInput>; onZone: (z: ZoneId | null) => void }) {
  const { camera, gl } = useThree() as unknown as { camera: THREE.PerspectiveCamera; gl: THREE.WebGLRenderer };
  const st = useRef({
    yaw: 0,
    pitch: -0.06,
    x: 0,
    z: 0,
    intro: 0,
    fromP: new THREE.Vector3(),
    fromQ: new THREE.Quaternion(),
    keys: new Set<string>(),
    last: null as ZoneId | null,
  });
  const area = useMemo(() => walkArea(zone), [zone]);
  useEffect(() => {
    const s = st.current;
    const [x, z, yaw0 = 0] = entryOf(zone);
    Object.assign(s, { x, z, yaw: yaw0, pitch: -0.06, intro: 0, last: null });
    s.fromP.copy(camera.position);
    s.fromQ.copy(camera.quaternion);
    const fov = camera.fov, near = camera.near;
    camera.fov = 62;
    camera.near = 0.1; // au plus près des racks sans les « traverser » à l'écran
    camera.updateProjectionMatrix();
    // regarder : glisser avec la souris ou le doigt
    const el = gl.domElement;
    let drag: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const k = e.pointerType === "touch" ? 0.006 : 0.004;
      s.yaw += (e.clientX - drag.x) * k;
      s.pitch = Math.max(-1.1, Math.min(0.9, s.pitch + (e.clientY - drag.y) * k));
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null;
    };
    // e.code = position physique : ZQSD sur clavier AZERTY, WASD sur QWERTY
    const MOVE = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (MOVE.includes(e.code)) {
        s.keys.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => s.keys.delete(e.code);
    const blur = () => s.keys.clear();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    };
  }, [zone, camera, gl]);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dtRaw) => {
    const s = st.current;
    const dt = Math.min(dtRaw, 0.05);
    const k = s.keys, i = input.current;
    const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + i.f;
    const side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + i.s;
    const turn = (k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0) + i.turn;
    const speed = (k.has("ShiftLeft") || k.has("ShiftRight") || i.run ? 5 : 2.2) * dt;
    s.yaw -= turn * 1.8 * dt;
    if (s.intro >= 1 && (fwd || side)) {
      // yaw = 0 : on regarde vers le nord (z négatif)
      const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
      const dx = (-sin * fwd + cos * side) * speed, dz = (-cos * fwd - sin * side) * speed;
      // on glisse le long des obstacles : chaque axe est testé séparément
      if (!blocked(s.x + dx, s.z, area)) s.x += dx;
      if (!blocked(s.x, s.z + dz, area)) s.z += dz;
    }
    e.set(s.pitch, s.yaw, 0, "YXZ");
    q.setFromEuler(e);
    p.set(s.x, EYE + (fwd || side ? Math.abs(Math.sin(performance.now() / 160)) * 0.03 : 0), s.z);
    if (s.intro < 1) {
      // arrivée : la caméra descend jusqu'à hauteur d'yeux
      s.intro = Math.min(1, s.intro + Math.min(dtRaw, 0.25) / 1.1);
      const t = 1 - Math.pow(1 - s.intro, 3);
      camera.position.lerpVectors(s.fromP, p, t);
      camera.quaternion.slerpQuaternions(s.fromQ, q, t);
    } else {
      camera.position.copy(p);
      camera.quaternion.copy(q);
    }
    // pièce où l'on se trouve, pour l'affichage
    const here = ZONES.find((z) => s.x >= z.x && s.x <= z.x + z.w && s.z >= z.z && s.z <= z.z + z.d)?.id || null;
    if (here !== s.last) {
      s.last = here;
      onZone(here);
    }
  });
  return null;
}

function HoldButton({ label, onHold, children, className }: { label: string; onHold: (on: boolean) => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={
        "grid h-12 w-12 touch-none place-items-center rounded-2xl border border-line bg-surface/90 text-ink shadow-[0_6px_18px_rgba(40,25,15,.2)] select-none active:bg-brand active:text-white " +
        (className || "")
      }
    >
      {children}
    </button>
  );
}

/* Commandes affichées pendant la visite */
function WalkHud({ zone, here, input, onExit }: { zone: ZoneId; here: ZoneId | null; input: React.MutableRefObject<WalkInput>; onExit: () => void }) {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    const k = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [onExit]);
  const hold = (key: keyof WalkInput, v: number) => (on: boolean) => {
    (input.current[key] as number) = on ? v : 0;
  };
  const arrow = (r: number) => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: `rotate(${r}deg)` }} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
  const turnIcon = (flip: boolean) => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: flip ? "scaleX(-1)" : undefined }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
    </svg>
  );
  return (
    <>
      <div className="absolute top-3 left-3 z-[6] flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[13px] font-semibold shadow-[0_6px_18px_rgba(40,25,15,.2)]">
          {here ? ZONE_META[here].name : `Près de : ${ZONE_META[zone].name}`}
        </span>
        <button type="button" onClick={onExit} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-surface shadow-[0_6px_18px_rgba(40,25,15,.25)]">
          Sortir de la visite
        </button>
      </div>
      {hint && (
        <div className="pointer-events-none absolute top-14 left-1/2 z-[6] -translate-x-1/2 rounded-full bg-ink/90 px-3.5 py-1.5 text-center text-[12.5px] text-surface">
          <span className="hidden sm:inline">Z Q S D ou flèches pour marcher · Maj pour courir · glissez pour regarder · Échap pour sortir</span>
          <span className="sm:hidden">Boutons pour marcher · glissez pour regarder</span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-[6] grid grid-cols-3 gap-1.5">
        <HoldButton label="Tourner à gauche" onHold={hold("turn", -1)}>{turnIcon(true)}</HoldButton>
        <HoldButton label="Avancer" onHold={hold("f", 1)}>{arrow(0)}</HoldButton>
        <HoldButton label="Tourner à droite" onHold={hold("turn", 1)}>{turnIcon(false)}</HoldButton>
        <HoldButton label="Pas de côté à gauche" onHold={hold("s", -1)}>{arrow(-90)}</HoldButton>
        <HoldButton label="Reculer" onHold={hold("f", -1)}>{arrow(180)}</HoldButton>
        <HoldButton label="Pas de côté à droite" onHold={hold("s", 1)}>{arrow(90)}</HoldButton>
      </div>
    </>
  );
}

/* Caméra : glisse vers la sélection */
function Rig({
  focus,
  home,
  paused,
}: {
  focus: { p: THREE.Vector3; dist: number } | null;
  home: { pos: THREE.Vector3; target: THREE.Vector3 };
  paused: boolean;
}) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: OrbitControlsImpl | null;
  };
  const anim = useRef<{
    t: number;
    fp: THREE.Vector3;
    tp: THREE.Vector3;
    ft: THREE.Vector3;
    tt: THREE.Vector3;
  } | null>(null);
  useEffect(() => {
    if (!controls || paused) return;
    const tt = focus ? focus.p.clone() : home.target.clone();
    let tp: THREE.Vector3;
    if (focus) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      tp = focus.p.clone().add(dir.multiplyScalar(focus.dist));
      tp.y = Math.max(tp.y, focus.dist * 0.55);
    } else tp = home.pos.clone();
    anim.current = {
      t: 0,
      fp: camera.position.clone(),
      tp,
      ft: controls.target.clone(),
      tt,
    };
  }, [focus, controls, camera, home, paused]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls || paused) return;
    a.t = Math.min(1, a.t + dt / 1.2);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.fp, a.tp, k);
    controls.target.lerpVectors(a.ft, a.tt, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

export default function DepotScene({
  summary,
  selection,
  onSelect,
  interactive = true,
  autoRotate = false,
}: {
  summary: DepotSummary;
  selection: Selection;
  onSelect: (s: Selection) => void;
  interactive?: boolean;
  autoRotate?: boolean;
}) {
  const dark = useDark();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = matchMedia("(max-width: 640px)");
    const f = () => setNarrow(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  // sur téléphone, l'écran est étroit : on recule et on centre sur les bâtiments
  const home = useMemo(
    () =>
      narrow
        ? {
            pos: new THREE.Vector3(150, 210, 215),
            target: new THREE.Vector3(10, 0, -2),
          }
        : {
            pos: new THREE.Vector3(-8, 100, 148),
            target: new THREE.Vector3(-36, 0, 2),
          },
    [narrow],
  );
  const placed = summary.vehicles
    .slice(0, SPOTS.length)
    .map((v, i) => ({ v, spot: SPOTS[i] }));
  const pinRefs = useRef(new Map<ZoneId, HTMLButtonElement>());
  // visite à pied : la pièce où l'on est entré (null = vue d'en haut)
  const [walk, setWalk] = useState<ZoneId | null>(null);
  const [here, setHere] = useState<ZoneId | null>(null);
  const walkInput = useRef<WalkInput>({ f: 0, s: 0, turn: 0, run: false });
  const enter = (id: ZoneId) => {
    walkInput.current = { f: 0, s: 0, turn: 0, run: false };
    setHere(id);
    setWalk(id);
    // la fiche de la zone se ferme pendant la visite (elle cacherait les commandes) et revient à la sortie
    onSelect(null);
  };
  const walkRef = useRef<ZoneId | null>(null);
  walkRef.current = here || walk;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const exitWalk = useCallback(() => {
    const z = walkRef.current;
    setWalk(null);
    if (z) onSelectRef.current({ type: "zone", id: z });
  }, []);
  const staff = useMemo(() => summary.staff || [], [summary.staff]);
  const spots = useMemo(() => standingSpots(staff), [staff]);
  const focus = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "zone") {
      const z = zoneOf(selection.id);
      return { p: center(selection.id), dist: Math.max(z.w, z.d) * 1.25 + 22 };
    }
    if (selection.type === "staff") {
      const at = spots.get(selection.id);
      return at ? { p: new THREE.Vector3(at[0], 0, at[1]), dist: 16 } : null;
    }
    const p = placed.find((x) => x.v.id === selection.id);
    return p
      ? { p: new THREE.Vector3(p.spot[0], 0, p.spot[1]), dist: 28 }
      : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);
  const click = (s: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onSelect(s);
  };
  const pinned = ZONES.filter(
    (z) =>
      !narrow ||
      summary.zones[z.id]?.alerts > 0 ||
      (selection?.type === "zone" && selection.id === z.id),
  );
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [80, 260, 330], fov: 36, near: 1, far: 1200 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => !walk && onSelect(null)}
      >
        <hemisphereLight args={["#fff4e8", "#6b5a4c", dark ? 0.5 : 0.8]} />
        <directionalLight
          position={[60, 140, 70]}
          intensity={dark ? 0.9 : 1.25}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
        >
          <orthographicCamera
            attach="shadow-camera"
            args={[-200, 200, 90, -90, 1, 500]}
          />
        </directionalLight>
        {/* sol, cour et route */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-40, -0.03, 5]}
          receiveShadow
        >
          <planeGeometry args={[420, 200]} />
          <Mat c={dark ? "#2a2523" : "#e7e1d8"} />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-40, 0, 8]}
          receiveShadow
        >
          <planeGeometry args={[290, 72]} />
          <Mat c={dark ? "#211e1c" : "#b9b1a7"} />
        </mesh>
        <Box
          s={[420, 0.05, 8]}
          p={[-40, 0.02, ROAD_Z]}
          c="#5e5853"
          cast={false}
        />
        {Array.from({ length: 40 }, (_, i) => (
          <Box
            key={i}
            s={[4, 0.06, 0.25]}
            p={[-245 + i * 10.5, 0.05, ROAD_Z]}
            c="#f2eee9"
            cast={false}
          />
        ))}
        {/* haie et arbres (bois au nord-ouest, comme sur la vue aérienne) */}
        {[
          [-170, -28],
          [-160, -30],
          [-148, -27],
          [-136, -30],
          [-124, -28],
          [-112, -30],
          [-176, -18],
          [-120, 50],
          [-60, 50],
          [10, 50],
          [70, 50],
          [112, 30],
          [110, -10],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <Box s={[0.7, 2.6, 0.7]} p={[0, 1.3, 0]} c="#6b5040" />
            <mesh position={[0, 5.5, 0]} castShadow>
              <icosahedronGeometry args={[3.6 + (i % 3) * 0.8, 0]} />
              <Mat c="#6f8f57" flatShading />
            </mesh>
          </group>
        ))}

        {/* bâtiments : clair (soft, vins, sirop, alcool) et sombres */}
        <Shell
          x={28}
          z={-35}
          w={72}
          d={47}
          h={8.5}
          roof="#cfc8bf"
          wall="#efe9e1"
          front={2.4}
        />
        <Box
          s={[0.15, 0.05, 36]}
          p={[58, 0.14, -17]}
          c="#2f9e5b"
          cast={false}
        />
        <Shell x={-95} z={-22} w={80} d={36} h={9} roof="#2d2f36" />
        <Shell x={-15} z={-26} w={22} d={30} h={9} roof="#2d2f36" />
        <Shell x={7} z={-8} w={21} d={14} h={8} roof="#2d2f36" />
        <Shell
          x={-12}
          z={6}
          w={26}
          d={11}
          h={4.5}
          roof="#2d2f36"
          wall="#f1ebe3"
          front={1.2}
        />

        {ZONES.map((z) => {
          const info = summary.zones[z.id];
          const on = selection?.type === "zone" && selection.id === z.id;
          return (
            <mesh
              key={z.id}
              position={[z.x + z.w / 2, 0.06, z.z + z.d / 2]}
              receiveShadow
              onClick={
                interactive && !walk ? click({ type: "zone", id: z.id }) : undefined
              }
              onDoubleClick={
                interactive && !walk
                  ? (e: ThreeEvent<MouseEvent>) => {
                      e.stopPropagation();
                      enter(z.id);
                    }
                  : undefined
              }
            >
              <boxGeometry args={[z.w, 0.12, z.d]} />
              <Mat
                c={z.color}
                emissive={on ? "#ce0013" : info?.alerts ? "#d6333a" : "#000000"}
                emissiveIntensity={on ? 0.28 : info?.alerts ? 0.12 : 0}
              />
            </mesh>
          );
        })}
        {/* marquage au sol des quais */}
        {[29, 39.5, 50.5, 61].map((x) => (
          <Box
            key={x}
            s={[0.25, 0.04, 9]}
            p={[x, 0.14, 16.5]}
            c="#e9c22b"
            cast={false}
          />
        ))}
        <Doors />
        <Interior />
        <Forklift path={[30, -1, 56, -1]} />
        <Forklift path={[-85, 10, -30, 10]} />
        {staff
          .filter((s) => s.present && spots.has(s.id))
          .map((s) => (
            <Person
              key={s.id}
              s={s}
              at={spots.get(s.id)!}
              selected={selection?.type === "staff" && selection.id === s.id}
              onSelect={click({ type: "staff", id: s.id })}
            />
          ))}
        {placed.map(({ v, spot }) => (
          <Truck
            key={v.id}
            v={v}
            spot={spot}
            selected={selection?.type === "vehicle" && selection.id === v.id}
            onSelect={click({ type: "vehicle", id: v.id })}
          />
        ))}
        {interactive && !walk && <PinProjector refs={pinRefs} />}
        {walk && <Walker zone={walk} input={walkInput} onZone={setHere} />}
        <OrbitControls
          makeDefault
          enabled={!walk}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.45}
          minDistance={18}
          maxDistance={420}
          enablePan={interactive}
          enableZoom={interactive}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          target={[-30, 0, 0]}
        />
        <Rig focus={focus} home={home} paused={!!walk} />
      </Canvas>
      {walk && <WalkHud zone={walk} here={here} input={walkInput} onExit={exitWalk} />}
      {interactive &&
        !walk &&
        pinned.map((z) => (
          <Pin
            key={z.id}
            refs={pinRefs}
            id={z.id}
            info={summary.zones[z.id]}
            active={selection?.type === "zone" && selection.id === z.id}
            onClick={() => enter(z.id)}
          />
        ))}
    </div>
  );
}
