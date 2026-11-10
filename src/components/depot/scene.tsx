"use client";
/* Dépôt Crouzil d'Ayguesvives en 3D, d'après le plan annoté (vue aérienne).
   Unité : 1 = 1 mètre. x vers l'est, z vers le sud (la route est au sud).
   Bâtiment clair : soft, vins, sirop, alcool, 3 rideaux de quai en façade.
   Bâtiments sombres : verres et fûts, fûts, dépose commandes, bureau téléachat. */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { DepotSummary, DepotVehicle, ZoneId } from "./summary";
import { ZONE_META } from "./overview";

export type Selection = { type: "zone"; id: ZoneId } | { type: "vehicle"; id: string } | null;

type Zone = { id: ZoneId; x: number; z: number; w: number; d: number; color: string; pinY: number };
/* Emprise au sol de chaque zone (m) */
export const ZONES: Zone[] = [
  { id: "vide", x: -178, z: -16, w: 80, d: 46, color: "#cfc4b6", pinY: 4 },
  { id: "verres", x: -95, z: -22, w: 80, d: 36, color: "#ddd5cb", pinY: 11 },
  { id: "futs", x: -15, z: -26, w: 22, d: 30, color: "#ddd5cb", pinY: 11 },
  { id: "patio", x: 7, z: -26, w: 21, d: 18, color: "#cbbfb1", pinY: 5 },
  { id: "depose", x: 7, z: -8, w: 21, d: 14, color: "#e3dacf", pinY: 9 },
  { id: "bureau", x: -12, z: 6, w: 26, d: 11, color: "#f1e8de", pinY: 6 },
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

export function Mat({ c, ...rest }: { c: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={c} roughness={0.85} {...rest} />;
}

export function Box({ s, p, c, cast = true, ...rest }: { s: [number, number, number]; p: [number, number, number]; c: string; cast?: boolean } & Partial<THREE.MeshStandardMaterialParameters>) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <Mat c={c} {...rest} />
    </mesh>
  );
}

/* Boîtes instanciées : une seule géométrie pour des centaines d'objets */
function useBoxes(list: { p: [number, number, number]; s: [number, number, number]; c?: string }[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
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
function Boxes({ list, c = "#ffffff", cast = true, ...rest }: { list: { p: [number, number, number]; s: [number, number, number]; c?: string }[]; c?: string; cast?: boolean } & Partial<THREE.MeshStandardMaterialParameters>) {
  const ref = useBoxes(list);
  if (!list.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow={cast} receiveShadow>
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
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow>
      <cylinderGeometry args={[0.27, 0.27, 0.6, 10]} />
      <Mat c="#c4cad2" metalness={0.55} roughness={0.35} />
    </instancedMesh>
  );
}

/* Pile de fûts sur palettes : 4 fûts par palette, h palettes */
function kegStack(x: number, z: number, h: number, kegs: [number, number, number][], pals: { p: [number, number, number]; s: [number, number, number] }[]) {
  for (let l = 0; l < h; l++) {
    const y = l * 0.78;
    pals.push({ p: [x, y + 0.07, z], s: [1.2, 0.14, 1.2] });
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) kegs.push([x - 0.28 + a * 0.56, y + 0.45, z - 0.28 + b * 0.56]);
  }
}

/* Bâtiment en coupe : murs du fond et des côtés pleine hauteur, façade basse pour voir dedans */
function Shell({ x, z, w, d, h, roof, wall = "#ece5dc", front = 2.2 }: { x: number; z: number; w: number; d: number; h: number; roof: string; wall?: string; front?: number }) {
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
    const up: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const beam: typeof up = [];
    const pal: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const cols = ["#d8b48a", "#efebe5", "#c9a37a", "#9eb7c9", "#e9e3dc", "#b54d3a", "#d9cfbf", "#7f9a6f", "#e8c3c8"];
    const run = (x: number, z0: number) => {
      const bays = 11, bay = 2.7;
      for (let s = 0; s < 2; s++) {
        const xx = x + s * 1.2;
        for (let b = 0; b <= bays; b++) up.push({ p: [xx, 3, z0 + b * bay], s: [0.12, 6, 0.12] });
        for (let b = 0; b < bays; b++)
          for (let l = 0; l < 3; l++) {
            const y = 0.15 + l * 2;
            beam.push({ p: [xx, y + (l ? 0 : 0), z0 + b * bay + bay / 2], s: [0.1, 0.14, bay] });
            for (let k = 0; k < 2; k++) {
              const seed = (Math.round(x) * 7 + b * 13 + l * 5 + k * 3 + s) % 17;
              if (seed === 0 || seed === 9) continue;
              pal.push({ p: [xx, y + 0.85, z0 + b * bay + 0.68 + k * 1.34], s: [1.0, 1.4 - (seed % 3) * 0.15, 1.15], c: cols[seed % cols.length] });
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
    const pals: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const loads: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const glass: typeof loads = [];
    // Fûts (bâtiment) : blocs de fûts sur palettes
    for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) if ((i + j) % 5) kegStack(-12 + i * 2.6, -23 + j * 2.8, 2 + ((i * 3 + j) % 3), kegs, pals);
    // Patio : fûts au pied du bardage, comme sur la photo
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) kegStack(9.5 + i * 2.9, -23.5 + j * 3.3, 3 + ((i + j * 2) % 4), kegs, pals);
    // Verres et fûts : palettes de verres filmées et fûts
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 5; j++) {
        const x = -91 + i * 4.6, z = -18 + j * 5.5;
        if (i < 9) glass.push({ p: [x, 0.85, z], s: [1.2, 1.6, 1.0], c: ["#f3f1ec", "#e7ecef", "#ecdfc8"][(i + j) % 3] }, { p: [x + 1.5, 0.85, z], s: [1.2, 1.6, 1.0], c: "#f3f1ec" });
        else kegStack(x, z, 2 + ((i + j) % 3), kegs, pals);
      }
    // Vides : retours éparpillés dans la cour
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 6; j++) {
        const r = (i * 31 + j * 17) % 11;
        if (r > 6) continue;
        const x = -172 + i * 5.4 + (r % 3), z = -10 + j * 6.5 + (r % 2) * 1.5;
        if (r % 2) kegStack(x, z, 1 + (r % 3), kegs, pals);
        else loads.push({ p: [x, 0.5 + r * 0.1, z], s: [1.2, 1 + r * 0.2, 1.0], c: ["#5f7fa0", "#b7a07a", "#7a8f5a", "#a35a4a"][r % 4] });
      }
    // Dépose commandes : palettes préparées, filmées, alignées
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) loads.push({ p: [10 + i * 3, 0.8, -5.5 + j * 3.6], s: [1.2, 1.5, 1.0], c: ["#e9e3dc", "#d2a36d", "#c4a882", "#b9cfe0"][(i + j) % 4] });
    // Devant les quais, dans le soft : palettes en attente de chargement
    for (let i = 0; i < 8; i++) loads.push({ p: [31 + i * 3.4, 0.8, 7], s: [1.2, 1.5, 1.0], c: ["#e9e3dc", "#d2a36d", "#9eb7c9"][i % 3] });
    return { kegs, pals, loads, glass };
  }, []);
  // Sirop : étagères basses ; alcool : 2 niveaux, 2 m maxi, en cage
  const shelves = useMemo(() => {
    const frame: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const goods: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const runs = (x0: number, z0: number, n: number, len: number, h: number, levels: number, palette: string[]) => {
      for (let r = 0; r < n; r++) {
        const z = z0 + r * 3;
        frame.push({ p: [x0 + len / 2, h / 2, z - 0.45], s: [len, h, 0.06] });
        for (let l = 0; l < levels; l++) {
          frame.push({ p: [x0 + len / 2, 0.2 + (l * h) / levels, z], s: [len, 0.06, 0.9] });
          for (let k = 0; k < len / 0.7 - 1; k++) goods.push({ p: [x0 + 0.5 + k * 0.7, 0.45 + (l * h) / levels, z], s: [0.5, 0.45, 0.6], c: palette[(k + l + r) % palette.length] });
        }
      }
    };
    runs(60, 3.5, 3, 22, 2.2, 3, ["#e4572e", "#f2a541", "#c8e087", "#76b041", "#ffffff"]);
    runs(86, 3.5, 3, 12, 2, 2, ["#6b3fb8", "#ffffff", "#3c8a5c", "#d0a02b", "#9d2b2b", "#2a3a6b"]);
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
      {/* bureau téléachat : postes */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} position={[-8 + (i % 3) * 7, 0, 9 + Math.floor(i / 3) * 4.5]}>
          <Box s={[2.4, 0.08, 1.2]} p={[0, 0.75, 0]} c="#f8f5f0" />
          <Box s={[0.9, 0.55, 0.05]} p={[0, 1.1, -0.3]} c="#2a2d36" />
          <Box s={[0.6, 0.9, 0.6]} p={[0, 0.45, 0.9]} c="#3a3f4b" />
        </group>
      ))}
    </group>
  );
}

/* Les 3 rideaux de quai en façade du bâtiment clair */
function Doors() {
  return (
    <group>
      {[34, 45, 56].map((x) => (
        <group key={x} position={[x, 0, 12]}>
          <Box s={[4.4, 5, 0.3]} p={[0, 2.5, 0]} c="#9aa3ad" metalness={0.4} roughness={0.5} />
          {[0.6, 1.4, 2.2, 3, 3.8, 4.6].map((y) => (
            <Box key={y} s={[4.4, 0.05, 0.34]} p={[0, y, 0]} c="#7d868f" cast={false} />
          ))}
          <Box s={[5.2, 0.5, 0.6]} p={[0, 5.3, 0]} c="#ce0013" />
          <Box s={[4.6, 1.2, 3]} p={[0, 0.6, 1.6]} c="#8d857c" />
        </group>
      ))}
    </group>
  );
}

export function Truck({ v, spot, selected, onSelect }: { v: DepotVehicle; spot: [number, number, number]; selected: boolean; onSelect?: (e: ThreeEvent<MouseEvent>) => void }) {
  const small = /vl|utilitaire|fourgon/i.test(v.kind + v.name);
  const L = small ? 3.4 : 6.2, cabL = small ? 1.2 : 1.6, H = small ? 1.7 : 2.4;
  const col = STATE_COLOR[v.state];
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = selected ? 0.5 : v.state === "bad" ? 0.22 + Math.sin(clock.elapsedTime * 3) * 0.12 : 0.2;
  });
  return (
    <group position={[spot[0], 0, spot[1]]} rotation={[0, spot[2], 0]} scale={1.45} onClick={onSelect}>
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
      <mesh position={[-cabL / 2 + (L - cabL) / 2 - 0.6, H * 0.45 + 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 1.94, 24]} />
        <Mat c="#ce0013" />
      </mesh>
      {[[L / 2 - 0.7, 0.95], [L / 2 - 0.7, -0.95], [-L / 2 + 0.9, 0.95], [-L / 2 + 0.9, -0.95]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.42, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.3, 14]} />
          <Mat c="#26221f" />
        </mesh>
      ))}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[L * 0.62, 32]} />
        <meshBasicMaterial color={col} transparent opacity={0.2} depthWrite={false} />
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
    g.current.rotation.y = Math.atan2(-(z1 - z0), x1 - x0) + (Math.cos(clock.elapsedTime * 0.25) > 0 ? 0 : Math.PI);
  });
  return (
    <group ref={g} scale={1.3}>
      <Box s={[1.2, 0.8, 0.8]} p={[0, 0.6, 0]} c="#e9b81f" />
      <Box s={[0.1, 2.2, 0.7]} p={[0.65, 1.1, 0]} c="#333333" />
      <Box s={[0.9, 0.9, 0.8]} p={[1.2, 0.55, 0]} c="#d2a36d" />
    </group>
  );
}

function Pin({ id, info, onClick, active }: { id: ZoneId; info: DepotSummary["zones"][ZoneId]; onClick: () => void; active: boolean }) {
  const z = zoneOf(id);
  return (
    <Html position={[z.x + z.w / 2, z.pinY, z.z + z.d / 2]} center zIndexRange={[15, 0]}>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={
          "flex -translate-y-1/2 items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-ink shadow-[0_6px_18px_rgba(40,25,15,.2)] transition-transform hover:-translate-y-[60%] " +
          (active ? "border-brand" : "border-line")
        }
      >
        <span className={"h-2 w-2 rounded-full " + (info.alerts ? "bg-bad" : "bg-navy")} />
        {ZONE_META[id].name}
        {info.alerts > 0 && <span className="rounded-full bg-bad px-1.5 text-[10px] leading-4 text-white">{info.alerts}</span>}
      </button>
    </Html>
  );
}

/* Caméra : glisse vers la sélection */
function Rig({ focus, home }: { focus: { p: THREE.Vector3; dist: number } | null; home: { pos: THREE.Vector3; target: THREE.Vector3 } }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const anim = useRef<{ t: number; fp: THREE.Vector3; tp: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!controls) return;
    const tt = focus ? focus.p.clone() : home.target.clone();
    let tp: THREE.Vector3;
    if (focus) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      tp = focus.p.clone().add(dir.multiplyScalar(focus.dist));
      tp.y = Math.max(tp.y, focus.dist * 0.55);
    } else tp = home.pos.clone();
    anim.current = { t: 0, fp: camera.position.clone(), tp, ft: controls.target.clone(), tt };
  }, [focus, controls, camera, home]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
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
    () => (narrow ? { pos: new THREE.Vector3(150, 210, 215), target: new THREE.Vector3(10, 0, -2) } : { pos: new THREE.Vector3(-8, 100, 148), target: new THREE.Vector3(-36, 0, 2) }),
    [narrow],
  );
  const placed = summary.vehicles.slice(0, SPOTS.length).map((v, i) => ({ v, spot: SPOTS[i] }));
  const focus = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "zone") {
      const z = zoneOf(selection.id);
      return { p: center(selection.id), dist: Math.max(z.w, z.d) * 1.25 + 22 };
    }
    const p = placed.find((x) => x.v.id === selection.id);
    return p ? { p: new THREE.Vector3(p.spot[0], 0, p.spot[1]), dist: 28 } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);
  const click = (s: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onSelect(s);
  };
  const pinned = ZONES.filter((z) => !narrow || summary.zones[z.id]?.alerts > 0 || (selection?.type === "zone" && selection.id === z.id));
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [80, 260, 330], fov: 36, near: 1, far: 1200 }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => onSelect(null)}>
      <hemisphereLight args={["#fff4e8", "#6b5a4c", dark ? 0.5 : 0.8]} />
      <directionalLight position={[60, 140, 70]} intensity={dark ? 0.9 : 1.25} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}>
        <orthographicCamera attach="shadow-camera" args={[-200, 200, 90, -90, 1, 500]} />
      </directionalLight>
      {/* sol, cour et route */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40, -0.03, 5]} receiveShadow>
        <planeGeometry args={[420, 200]} />
        <Mat c={dark ? "#2a2523" : "#e7e1d8"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40, 0, 8]} receiveShadow>
        <planeGeometry args={[290, 72]} />
        <Mat c={dark ? "#211e1c" : "#b9b1a7"} />
      </mesh>
      <Box s={[420, 0.05, 8]} p={[-40, 0.02, ROAD_Z]} c="#5e5853" cast={false} />
      {Array.from({ length: 40 }, (_, i) => (
        <Box key={i} s={[4, 0.06, 0.25]} p={[-245 + i * 10.5, 0.05, ROAD_Z]} c="#f2eee9" cast={false} />
      ))}
      {/* haie et arbres (bois au nord-ouest, comme sur la vue aérienne) */}
      {[[-170, -28], [-160, -30], [-148, -27], [-136, -30], [-124, -28], [-112, -30], [-176, -18], [-120, 50], [-60, 50], [10, 50], [70, 50], [112, 30], [110, -10]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box s={[0.7, 2.6, 0.7]} p={[0, 1.3, 0]} c="#6b5040" />
          <mesh position={[0, 5.5, 0]} castShadow>
            <icosahedronGeometry args={[3.6 + (i % 3) * 0.8, 0]} />
            <Mat c="#6f8f57" flatShading />
          </mesh>
        </group>
      ))}

      {/* bâtiments : clair (soft, vins, sirop, alcool) et sombres */}
      <Shell x={28} z={-35} w={72} d={47} h={8.5} roof="#cfc8bf" wall="#efe9e1" front={2.4} />
      <Box s={[0.15, 0.05, 36]} p={[58, 0.14, -17]} c="#2f9e5b" cast={false} />
      <Shell x={-95} z={-22} w={80} d={36} h={9} roof="#2d2f36" />
      <Shell x={-15} z={-26} w={22} d={30} h={9} roof="#2d2f36" />
      <Shell x={7} z={-8} w={21} d={14} h={8} roof="#2d2f36" />
      <Shell x={-12} z={6} w={26} d={11} h={4.5} roof="#2d2f36" wall="#f1ebe3" front={1.2} />

      {ZONES.map((z) => {
        const info = summary.zones[z.id];
        const on = selection?.type === "zone" && selection.id === z.id;
        return (
          <mesh key={z.id} position={[z.x + z.w / 2, 0.06, z.z + z.d / 2]} receiveShadow onClick={interactive ? click({ type: "zone", id: z.id }) : undefined}>
            <boxGeometry args={[z.w, 0.12, z.d]} />
            <Mat c={z.color} emissive={on ? "#ce0013" : info?.alerts ? "#d6333a" : "#000000"} emissiveIntensity={on ? 0.28 : info?.alerts ? 0.12 : 0} />
          </mesh>
        );
      })}
      {/* marquage au sol des quais */}
      {[29, 39.5, 50.5, 61].map((x) => (
        <Box key={x} s={[0.25, 0.04, 9]} p={[x, 0.14, 16.5]} c="#e9c22b" cast={false} />
      ))}
      <Doors />
      <Interior />
      <Forklift path={[30, -1, 56, -1]} />
      <Forklift path={[-85, 10, -30, 10]} />
      {placed.map(({ v, spot }) => (
        <Truck key={v.id} v={v} spot={spot} selected={selection?.type === "vehicle" && selection.id === v.id} onSelect={click({ type: "vehicle", id: v.id })} />
      ))}
      {/* le tout premier repère HTML de drei ne s'affiche pas toujours : on lui donne un repère vide */}
      {interactive && (
        <Html position={[0, -50, 0]}>
          <span />
        </Html>
      )}
      {interactive && pinned.map((z) => <Pin key={z.id} id={z.id} info={summary.zones[z.id]} active={selection?.type === "zone" && selection.id === z.id} onClick={() => onSelect({ type: "zone", id: z.id })} />)}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.45} minDistance={18} maxDistance={420} enablePan={interactive} enableZoom={interactive} autoRotate={autoRotate} autoRotateSpeed={0.4} target={[-30, 0, 0]} />
      <Rig focus={focus} home={home} />
    </Canvas>
  );
}
