"use client";
/* Dépôt Crouzil en 3D : disposition d'après la vue satellite d'Ayguesvives.
   Unités : 1 = environ 1,5 m. Les zones sont cliquables, les véhicules viennent du parc. */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { DepotSummary, DepotVehicle, DepotZoneInfo } from "./summary";
import { ZONE_META } from "./overview";

type ZoneId = DepotZoneInfo["id"];
export type Selection = { type: "zone"; id: ZoneId } | { type: "vehicle"; id: string } | null;

export { Mat, Box };
export const ZONES: { id: ZoneId; x: number; z: number; w: number; d: number; color: string; walls?: boolean; low?: boolean; flat?: boolean }[] = [
  { id: "cour", x: -33, z: -7, w: 19.5, d: 14.5, color: "#c7bcb0" },
  { id: "racks", x: -13, z: -9.8, w: 19.8, d: 8.8, color: "#ddd4ca", walls: true },
  { id: "prepa", x: 6.8, z: -9.8, w: 10.7, d: 8.8, color: "#e6dcd1", walls: true },
  { id: "reserve", x: 6.5, z: -1, w: 11.5, d: 6, color: "#ded5cb", walls: true },
  { id: "quais", x: -13, z: -1, w: 19.5, d: 2.6, color: "#d3cabf", flat: true },
  { id: "bureau", x: 6.5, z: 5, w: 5.5, d: 3, color: "#f1e8de", walls: true, low: true },
  { id: "parking", x: 12.5, z: 6.4, w: 14.5, d: 4.4, color: "#bfb4a8", flat: true },
];
const center = (id: ZoneId) => {
  const z = ZONES.find((x) => x.id === id)!;
  return new THREE.Vector3(z.x + z.w / 2, 0, z.z + z.d / 2);
};
const STATE_COLOR = { ok: "#2f9e5b", warn: "#e08a1e", bad: "#d6333a" };

/* Emplacements des véhicules : 2 à quai, puis le parking */
const SPOTS: [number, number, number][] = [
  [-10.5, 2.7, -Math.PI / 2],
  [-1.2, 2.7, -Math.PI / 2],
  [14.0, 8.6, Math.PI / 2],
  [16.6, 8.6, Math.PI / 2],
  [19.2, 8.6, Math.PI / 2],
  [21.8, 8.6, Math.PI / 2],
  [24.4, 8.6, Math.PI / 2],
  [-20, 9.5, 0],
  [-26, 9.5, 0],
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

function Mat({ c, ...rest }: { c: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={c} roughness={0.85} {...rest} />;
}

function Box({ s, p, c, cast = true, ...rest }: { s: [number, number, number]; p: [number, number, number]; c: string; cast?: boolean } & Partial<THREE.MeshStandardMaterialParameters>) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <Mat c={c} {...rest} />
    </mesh>
  );
}

function Walls({ z }: { z: (typeof ZONES)[number] }) {
  const H = z.low ? 3.2 : 4.6, t = 0.35;
  return (
    <group>
      <Box s={[z.w, H, t]} p={[z.x + z.w / 2, H / 2, z.z]} c="#eee7de" />
      <Box s={[z.w, H * 0.3, t]} p={[z.x + z.w / 2, H * 0.15, z.z + z.d]} c="#eee7de" />
      <Box s={[t, H, z.d]} p={[z.x, H / 2, z.z + z.d / 2]} c="#eee7de" />
      <Box s={[t, H, z.d]} p={[z.x + z.w, H / 2, z.z + z.d / 2]} c="#eee7de" />
      <Box s={[z.w + 0.2, 0.22, 0.6]} p={[z.x + z.w / 2, H + 0.1, z.z]} c="#3a3f4b" />
    </group>
  );
}

/* Racks : montants bleus, lisses orange, palettes chargées */
function Racks() {
  const z = ZONES[1];
  const up = useRef<THREE.InstancedMesh>(null), beam = useRef<THREE.InstancedMesh>(null), pal = useRef<THREE.InstancedMesh>(null);
  const rows = 4, bays = 9, levels = 3;
  useLayoutEffect(() => {
    const o = new THREE.Object3D(), col = new THREE.Color();
    const cols = ["#d8b48a", "#eeeae4", "#c9a37a", "#9eb7c9", "#e9e3dc", "#b54d3a", "#d9cfbf", "#6f8f6a"];
    let iu = 0, ib = 0, ip = 0;
    for (let r = 0; r < rows; r++) {
      const zc = z.z + 1.3 + r * 2.0;
      for (let s = 0; s < 2; s++) {
        const zz = zc + s * 0.95;
        for (let b = 0; b <= bays; b++) {
          o.position.set(z.x + 0.9 + b * 2, 1.95, zz);
          o.updateMatrix();
          up.current!.setMatrixAt(iu++, o.matrix);
        }
        for (let b = 0; b < bays; b++)
          for (let l = 0; l < levels; l++) {
            o.position.set(z.x + 1.9 + b * 2, 0.35 + l * 1.25, zz);
            o.updateMatrix();
            beam.current!.setMatrixAt(ib++, o.matrix);
            if ((b * 7 + l * 3 + r * 5 + s) % 9 !== 0) {
              o.position.set(z.x + 1.9 + b * 2, 0.8 + l * 1.25, zz);
              o.updateMatrix();
              pal.current!.setMatrixAt(ip, o.matrix);
              pal.current!.setColorAt(ip, col.set(cols[(b * 7 + l * 3 + r) % cols.length]));
              ip++;
            }
          }
      }
    }
    pal.current!.count = ip;
    [up, beam, pal].forEach((m) => {
      m.current!.instanceMatrix.needsUpdate = true;
      if (m.current!.instanceColor) m.current!.instanceColor.needsUpdate = true;
    });
  }, [z.x, z.z]);
  const n = rows * 2;
  return (
    <group>
      <instancedMesh ref={up} args={[undefined, undefined, n * (bays + 1)]} castShadow>
        <boxGeometry args={[0.14, 3.8, 0.14]} />
        <Mat c="#23407a" />
      </instancedMesh>
      <instancedMesh ref={beam} args={[undefined, undefined, n * bays * levels]} castShadow>
        <boxGeometry args={[1.95, 0.14, 0.12]} />
        <Mat c="#e2721c" />
      </instancedMesh>
      <instancedMesh ref={pal} args={[undefined, undefined, n * bays * levels]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.75, 0.9]} />
        <Mat c="#ffffff" />
      </instancedMesh>
    </group>
  );
}

/* Cour : piles de fûts sur palettes */
function Kegs() {
  const z = ZONES[0];
  const keg = useRef<THREE.InstancedMesh>(null), pal = useRef<THREE.InstancedMesh>(null);
  const stacks = useMemo(() => {
    const s: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) s.push([z.x + 2.2 + i * 1.5, z.z + 1.6 + j * 1.5, 3 + ((i * 7 + j * 3) % 4)]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.push([z.x + 11.5 + i * 1.5, z.z + 6.5 + j * 1.5, 1 + ((i + j) % 3)]);
    for (let i = 0; i < 3; i++) s.push([z.x + 4 + i * 1.5, z.z + 11.5, 2]);
    return s;
  }, [z.x, z.z]);
  const nK = stacks.reduce((n, s) => n + s[2] * 4, 0), nP = stacks.reduce((n, s) => n + s[2], 0);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let ik = 0, ip = 0;
    stacks.forEach(([x, zz, h]) => {
      for (let l = 0; l < h; l++) {
        const y = l * 0.78;
        o.position.set(x, y + 0.07, zz);
        o.updateMatrix();
        pal.current!.setMatrixAt(ip++, o.matrix);
        for (let a = 0; a < 2; a++)
          for (let b = 0; b < 2; b++) {
            o.position.set(x - 0.28 + a * 0.56, y + 0.45, zz - 0.28 + b * 0.56);
            o.updateMatrix();
            keg.current!.setMatrixAt(ik++, o.matrix);
          }
      }
    });
    keg.current!.instanceMatrix.needsUpdate = true;
    pal.current!.instanceMatrix.needsUpdate = true;
  }, [stacks]);
  return (
    <group>
      <instancedMesh ref={keg} args={[undefined, undefined, nK]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.6, 12]} />
        <Mat c="#c9ced4" metalness={0.55} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={pal} args={[undefined, undefined, nP]} castShadow>
        <boxGeometry args={[1.2, 0.14, 1.2]} />
        <Mat c="#8e6a45" />
      </instancedMesh>
    </group>
  );
}

function Prepa() {
  const z = ZONES[2];
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const x = z.x + 2 + i * 3.1;
    items.push(<Box key={"a" + i} s={[0.12, 2, 4.6]} p={[x - 0.9, 1, z.z + 3.2]} c="#23407a" />);
    items.push(<Box key={"b" + i} s={[0.12, 2, 4.6]} p={[x + 0.9, 1, z.z + 3.2]} c="#23407a" />);
    for (let l = 0; l < 3; l++) items.push(<Box key={`p${i}${l}`} s={[1.9, 0.1, 4.6]} p={[x, 0.4 + l * 0.7, z.z + 3.2]} c="#e2721c" />);
    for (let k = 0; k < 6; k++) items.push(<Box key={`c${i}${k}`} s={[0.5, 0.4, 0.6]} p={[x - 0.4 + (k % 2) * 0.8, 0.65 + (k >> 1) * 0.7, z.z + 1.6 + (k % 3) * 1.5]} c={["#d8b48a", "#ffffff", "#c04a4a", "#3f6fb5"][k % 4]} />);
  }
  [[2.3, 7.4], [5.4, 7.6], [8.4, 7.2]].forEach(([dx, dz], i) => {
    items.push(<Box key={"pal" + i} s={[1.4, 0.18, 1]} p={[z.x + dx, 0.15, z.z + dz]} c="#b48a5a" />);
    items.push(<Box key={"load" + i} s={[1.3, 0.9 + i * 0.2, 0.95]} p={[z.x + dx, 0.7 + i * 0.1, z.z + dz]} c={["#e8e2da", "#d2a36d", "#a83a3a"][i]} />);
  });
  return <group>{items}</group>;
}

function Reserve() {
  const z = ZONES[3];
  return (
    <group>
      {[[2.7, 2.4], [7.6, 2.4]].map(([dx, dz], i) => (
        <group key={i} position={[z.x + dx, 0, z.z + dz]}>
          <mesh position={[0, 1.35, 0]}>
            <boxGeometry args={[3.6, 2.6, 3, 6, 4, 5]} />
            <meshBasicMaterial color="#7d8794" wireframe />
          </mesh>
          <Box s={[3.4, 0.1, 2.8]} p={[0, 0.9, 0]} c="#23407a" />
          <Box s={[3.4, 0.1, 2.8]} p={[0, 1.8, 0]} c="#23407a" />
          {[0, 1, 2, 3, 4].map((k) => (
            <Box key={k} s={[0.5, 0.5, 0.5]} p={[-1.2 + k * 0.6, 1.2, -0.5 + (k % 2) * 0.8]} c={["#6b3fb8", "#ffffff", "#3c8a5c", "#d0a02b", "#9d2b2b"][k]} />
          ))}
        </group>
      ))}
    </group>
  );
}

function Bureau() {
  const z = ZONES[5];
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const x = z.x + 1.1 + i * 1.65;
        return (
          <group key={i}>
            <Box s={[1.3, 0.08, 0.8]} p={[x, 0.75, z.z + 1.2]} c="#f8f5f0" />
            <Box s={[0.08, 0.7, 0.08]} p={[x, 0.38, z.z + 1.2]} c="#f8f5f0" />
            <Box s={[0.7, 0.45, 0.05]} p={[x, 1.05, z.z + 1]} c="#2a2d36" />
          </group>
        );
      })}
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
    <group position={[spot[0], 0, spot[1]]} rotation={[0, spot[2], 0]} onClick={onSelect}>
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
      <mesh position={[-cabL / 2 + (L - cabL) / 2 - 0.6, H * 0.45 + 0.45, 0]}>
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

function Forklift() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime * 0.35;
    g.current.position.set(-12 + ((Math.sin(t) + 1) / 2) * 17, 0, -1.6);
    g.current.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
  });
  return (
    <group ref={g}>
      <Box s={[1.2, 0.8, 0.8]} p={[0, 0.6, 0]} c="#e9b81f" />
      <Box s={[0.1, 2.2, 0.7]} p={[0.65, 1.1, 0]} c="#333333" />
      <Box s={[0.9, 0.9, 0.8]} p={[1.2, 0.55, 0]} c="#d2a36d" />
    </group>
  );
}

function Pin({ id, info, onClick, active }: { id: ZoneId; info: DepotZoneInfo; onClick: () => void; active: boolean }) {
  const z = ZONES.find((x) => x.id === id)!;
  const y = z.flat ? 1.6 : z.low ? 4.4 : z.walls ? 5.6 : 4.2;
  return (
    <Html position={[z.x + z.w / 2, y, z.z + z.d / 2]} center zIndexRange={[15, 0]}>
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
function Rig({ focus, home }: { focus: THREE.Vector3 | null; home: { pos: THREE.Vector3; target: THREE.Vector3 } }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const anim = useRef<{ t: number; fp: THREE.Vector3; tp: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!controls) return;
    const tt = focus ? focus.clone() : home.target.clone();
    let tp: THREE.Vector3;
    if (focus) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      tp = focus.clone().add(dir.multiplyScalar(26));
      tp.y = Math.max(tp.y, 15);
    } else tp = home.pos.clone();
    anim.current = { t: 0, fp: camera.position.clone(), tp, ft: controls.target.clone(), tt };
  }, [focus, controls, camera, home]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 1.1);
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
  const home = useMemo(() => ({ pos: new THREE.Vector3(22, 34, 46), target: new THREE.Vector3(-4, 0, 1) }), []);
  const placed = summary.vehicles.slice(0, SPOTS.length).map((v, i) => ({ v, spot: SPOTS[i] }));
  const focus = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "zone") return center(selection.id);
    const p = placed.find((x) => x.v.id === selection.id);
    return p ? new THREE.Vector3(p.spot[0], 0, p.spot[1]) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);
  const click = (s: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onSelect(s);
  };
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [70, 90, 110], fov: 36, near: 0.5, far: 400 }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => onSelect(null)}>
      <hemisphereLight args={["#fff4e8", "#6b5a4c", dark ? 0.5 : 0.8]} />
      <directionalLight position={[30, 60, 25]} intensity={dark ? 0.9 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0006}>
        <orthographicCamera attach="shadow-camera" args={[-50, 50, 40, -40, 1, 160]} />
      </directionalLight>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 140]} />
        <Mat c={dark ? "#2a2523" : "#e9e3db"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0, 1.5]} receiveShadow>
        <planeGeometry args={[64, 24]} />
        <Mat c={dark ? "#1f1c1b" : "#b3aba2"} />
      </mesh>
      <Box s={[110, 0.05, 3.6]} p={[0, 0.01, 12.8]} c="#5e5853" cast={false} />
      {Array.from({ length: 21 }, (_, i) => (
        <Box key={i} s={[2.2, 0.06, 0.18]} p={[-50 + i * 5, 0.03, 12.8]} c="#f2eee9" cast={false} />
      ))}
      <Box s={[13.6, 6.5, 15]} p={[25, 3.25, -3.5]} c={dark ? "#3b3633" : "#d4cec6"} />
      {[[-30, -12], [-25, -12.4], [-20, -12], [-34, -10], [-27, 15.8], [-6, 15.8], [6, 15.6], [22, 15.8]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box s={[0.4, 1.4, 0.4]} p={[0, 0.7, 0]} c="#6b5040" />
          <mesh position={[0, 2.8, 0]} castShadow>
            <icosahedronGeometry args={[1.8 + (i % 3) * 0.35, 0]} />
            <Mat c="#6f8f57" flatShading />
          </mesh>
        </group>
      ))}

      {ZONES.map((z) => {
        const info = summary.zones[z.id];
        const on = selection?.type === "zone" && selection.id === z.id;
        return (
          <group key={z.id}>
            <mesh position={[z.x + z.w / 2, 0.06, z.z + z.d / 2]} receiveShadow onClick={interactive ? click({ type: "zone", id: z.id }) : undefined}>
              <boxGeometry args={[z.w, 0.12, z.d]} />
              <Mat c={z.color} emissive={on ? "#ce0013" : info.alerts ? "#d6333a" : "#000000"} emissiveIntensity={on ? 0.3 : info.alerts ? 0.12 : 0} />
            </mesh>
            {z.walls && <Walls z={z} />}
          </group>
        );
      })}
      {[-1.4, 1.2].map((zz) => (
        <Box key={zz} s={[19, 0.04, 0.12]} p={[-3.1, 0.13, zz]} c="#e9c22b" cast={false} />
      ))}
      <Racks />
      <Kegs />
      <Prepa />
      <Reserve />
      <Bureau />
      <Forklift />
      {placed.map(({ v, spot }) => (
        <Truck key={v.id} v={v} spot={spot} selected={selection?.type === "vehicle" && selection.id === v.id} onSelect={click({ type: "vehicle", id: v.id })} />
      ))}
      {interactive && ZONES.filter((z) => !narrow || summary.zones[z.id].alerts > 0 || (selection?.type === "zone" && selection.id === z.id)).map((z) => <Pin key={z.id} id={z.id} info={summary.zones[z.id]} active={selection?.type === "zone" && selection.id === z.id} onClick={() => onSelect({ type: "zone", id: z.id })} />)}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.44} minDistance={12} maxDistance={110} enablePan={interactive} enableZoom={interactive} autoRotate={autoRotate} autoRotateSpeed={0.5} target={[-5, 0, 0]} />
      <Rig focus={focus} home={home} />
    </Canvas>
  );
}
