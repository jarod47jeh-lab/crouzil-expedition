"use client";
/* Vie du dépôt : circulation sur la route, livraison qui entre et ressort, chariots élévateurs
   dans les allées et devant les quais, préparateurs à pied. Décor d'ambiance (non relié aux données),
   à l'arrêt si l'utilisateur a demandé moins d'animations. */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Pt = [number, number, number?]; // x, z, attente en secondes à ce point

/** Parcours à vitesse constante le long d'une ligne brisée, avec arrêts ; boucle ou aller-retour */
function useTrack(points: Pt[], speed: number, mode: "loop" | "bounce", phase = 0) {
  return useMemo(() => {
    const pts = mode === "bounce" ? [...points, ...points.slice(0, -1).reverse()] : points;
    const legs: { a: Pt; b: Pt; t0: number; dur: number; wait: number }[] = [];
    let t = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dur = Math.hypot(b[0] - a[0], b[1] - a[1]) / speed;
      const wait = a[2] || 0;
      legs.push({ a, b, t0: t, dur, wait });
      t += wait + dur;
    }
    const total = t;
    return (time: number, out: { x: number; z: number; yaw: number; moving: boolean }) => {
      let u = (time + phase * total) % total;
      for (const l of legs) {
        if (u <= l.wait + l.dur) {
          const k = u <= l.wait ? 0 : (u - l.wait) / l.dur;
          out.x = l.a[0] + (l.b[0] - l.a[0]) * k;
          out.z = l.a[1] + (l.b[1] - l.a[1]) * k;
          out.yaw = Math.atan2(-(l.b[1] - l.a[1]), l.b[0] - l.a[0]);
          out.moving = u > l.wait;
          return out;
        }
        u -= l.wait + l.dur;
      }
      return out;
    };
  }, [points, speed, mode, phase]);
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setR(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/** Fait suivre un parcours à son contenu (l'avant du modèle est vers +x) */
function Follow({ points, speed, mode, phase, frozen, children, onMove }: { points: Pt[]; speed: number; mode: "loop" | "bounce"; phase?: number; frozen: boolean; children: React.ReactNode; onMove?: (moving: boolean, dt: number) => void }) {
  const g = useRef<THREE.Group>(null);
  const at = useTrack(points, speed, mode, phase);
  const o = useMemo(() => ({ x: 0, z: 0, yaw: 0, moving: false }), []);
  const yaw = useRef<number | null>(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    at(frozen ? 0 : clock.elapsedTime, o);
    g.current.position.set(o.x, 0, o.z);
    // virage en douceur
    if (yaw.current == null) yaw.current = o.yaw;
    let d = o.yaw - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * Math.min(1, dt * 5);
    g.current.rotation.y = yaw.current;
    onMove?.(o.moving && !frozen, dt);
  });
  return <group ref={g}>{children}</group>;
}

const M = ({ c, ...r }: { c: string } & Partial<THREE.MeshStandardMaterialParameters>) => <meshStandardMaterial color={c} roughness={0.8} {...r} />;

/* Camion Crouzil de livraison (même allure que les camions de la flotte) */
function RoadTruck({ points, speed, mode = "loop", phase = 0, frozen, stripe = "#ce0013" }: { points: Pt[]; speed: number; mode?: "loop" | "bounce"; phase?: number; frozen: boolean; stripe?: string }) {
  const wheels = useRef<THREE.Group>(null);
  const L = 6.2, cab = 1.6, H = 2.4;
  return (
    <Follow points={points} speed={speed} mode={mode} phase={phase} frozen={frozen} onMove={(m, dt) => wheels.current?.children.forEach((w) => m && (w.rotation.y -= dt * speed * 2.4))}>
      <group scale={1.45}>
        <mesh position={[-cab / 2, H / 2 + 0.45, 0]} castShadow>
          <boxGeometry args={[L - cab, H, 1.9]} />
          <M c="#f6f4f1" />
        </mesh>
        <mesh position={[(L - cab) / 2, H * 0.36 + 0.45, 0]} castShadow>
          <boxGeometry args={[cab, H * 0.72, 1.9]} />
          <M c="#f6f4f1" />
        </mesh>
        <mesh position={[L / 2 + 0.01, H * 0.52 + 0.45, 0]}>
          <boxGeometry args={[0.06, H * 0.28, 1.6]} />
          <M c="#2c3440" roughness={0.2} />
        </mesh>
        <mesh position={[-cab / 2, H * 0.82 + 0.45, 0]}>
          <boxGeometry args={[L - cab + 0.02, 0.28, 1.92]} />
          <M c={stripe} />
        </mesh>
        <mesh position={[(L - cab) / 2 - 0.6 - cab / 2, H * 0.45 + 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 1.94, 24]} />
          <M c="#ce0013" />
        </mesh>
        {/* phares */}
        {[0.6, -0.6].map((z) => (
          <mesh key={z} position={[L / 2 + 0.02, 0.75, z]}>
            <boxGeometry args={[0.04, 0.16, 0.32]} />
            <M c="#fff6d6" emissive="#fff1b8" emissiveIntensity={0.9} />
          </mesh>
        ))}
        <group ref={wheels}>
          {[
            [L / 2 - 0.7, 0.95],
            [L / 2 - 0.7, -0.95],
            [-L / 2 + 0.9, 0.95],
            [-L / 2 + 0.9, -0.95],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0.42, z]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.42, 0.42, 0.3, 14]} />
                <M c="#26221f" />
              </mesh>
              <mesh position={[0, z > 0 ? 0.16 : -0.16, 0]}>
                <boxGeometry args={[0.5, 0.02, 0.12]} />
                <M c="#8f8a84" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </Follow>
  );
}

/* Chariot élévateur avec palette, mât qui monte et descend, gyrophare */
function Lift({ points, speed = 2.6, mode = "bounce", phase = 0, frozen, load = "#d2a36d" }: { points: Pt[]; speed?: number; mode?: "loop" | "bounce"; phase?: number; frozen: boolean; load?: string }) {
  const fork = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase * 10;
    if (fork.current) fork.current.position.y = frozen ? 0.2 : 0.2 + (Math.sin(t * 0.7) + 1) * 0.35;
    if (beacon.current) beacon.current.emissiveIntensity = frozen ? 0.6 : 0.4 + Math.max(0, Math.sin(t * 9)) * 1.6;
  });
  return (
    <Follow points={points} speed={speed} mode={mode} phase={phase} frozen={frozen}>
      <group scale={1.3}>
        <mesh position={[-0.2, 0.55, 0]} castShadow>
          <boxGeometry args={[1.4, 0.7, 1]} />
          <M c="#e9b81f" />
        </mesh>
        <mesh position={[-0.35, 1.35, 0]} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.95]} />
          <M c="#26221f" wireframe />
        </mesh>
        <mesh position={[-0.35, 1.82, 0]}>
          <boxGeometry args={[0.95, 0.06, 1]} />
          <M c="#e9b81f" />
        </mesh>
        <mesh position={[-0.35, 1.92, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.14, 10]} />
          <meshStandardMaterial ref={beacon} color="#ff9a1a" emissive="#ff8a00" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.55, 1.15, 0]} castShadow>
          <boxGeometry args={[0.1, 2.2, 0.8]} />
          <M c="#333333" />
        </mesh>
        <group ref={fork} position={[0, 0.2, 0]}>
          <mesh position={[1.05, 0.05, 0]}>
            <boxGeometry args={[0.9, 0.1, 0.9]} />
            <M c="#8e6a45" />
          </mesh>
          <mesh position={[1.05, 0.5, 0]} castShadow>
            <boxGeometry args={[0.85, 0.8, 0.85]} />
            <M c={load} />
          </mesh>
        </group>
        {[[-0.6, 0.48], [-0.6, -0.48], [0.35, 0.48], [0.35, -0.48]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 10]} />
            <M c="#1d1b19" />
          </mesh>
        ))}
      </group>
    </Follow>
  );
}

/* Préparateur à pied, gilet haute visibilité, jambes et bras qui balancent */
function Walker({ points, speed = 1.3, mode = "bounce", phase = 0, frozen, skin = "#dba67f", shirt = "#1c2f5c" }: { points: Pt[]; speed?: number; mode?: "loop" | "bounce"; phase?: number; frozen: boolean; skin?: string; shirt?: string }) {
  const legs = useRef<THREE.Group>(null);
  const t = useRef(0);
  return (
    <Follow
      points={points}
      speed={speed}
      mode={mode}
      phase={phase}
      frozen={frozen}
      onMove={(m, dt) => {
        if (m) t.current += dt * 7;
        const a = m ? Math.sin(t.current) * 0.5 : 0;
        const l = legs.current?.children;
        if (!l) return;
        l[0].rotation.z = a;
        l[1].rotation.z = -a;
        l[2].rotation.z = -a * 0.8;
        l[3].rotation.z = a * 0.8;
      }}
    >
      <group scale={1.15}>
        <group ref={legs}>
          {[0.13, -0.13].map((z) => (
            <group key={"l" + z} position={[0, 0.84, z]}>
              <mesh position={[0, -0.42, 0]} castShadow>
                <boxGeometry args={[0.22, 0.84, 0.2]} />
                <M c="#2d3340" />
              </mesh>
            </group>
          ))}
          {[0.34, -0.34].map((z) => (
            <group key={"a" + z} position={[0, 1.38, z]}>
              <mesh position={[0, -0.3, 0]} castShadow>
                <boxGeometry args={[0.13, 0.6, 0.13]} />
                <M c={shirt} />
              </mesh>
            </group>
          ))}
        </group>
        <mesh position={[0, 1.12, 0]} castShadow>
          <capsuleGeometry args={[0.27, 0.45, 4, 12]} />
          <M c={shirt} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <capsuleGeometry args={[0.285, 0.3, 4, 12]} />
          <M c="#d7f03c" emissive="#b8d41f" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 1.66, 0]} castShadow>
          <sphereGeometry args={[0.2, 16, 12]} />
          <M c={skin} />
        </mesh>
      </group>
    </Follow>
  );
}

/** Tout ce qui bouge dans le dépôt */
export default function DepotActivity({ dense = true }: { dense?: boolean }) {
  const frozen = useReducedMotion();
  const P = useMemo(
    () => ({
      // route : voie vers l'est (z 40) et vers l'ouest (z 44)
      east: [[-250, 40], [190, 40]] as Pt[],
      west: [[190, 44], [-250, 44]] as Pt[],
      // livraison : arrive par la route, entre côté est du stationnement, s'arrête, ressort
      delivery: [[-250, 40], [104, 40], [108, 34], [108, 23, 9], [112, 30], [118, 40], [190, 40]] as Pt[],
      liftSoft: [[30, -1, 2], [56, -1, 2]] as Pt[],
      liftVins: [[60, -1, 2], [98, -1, 2]] as Pt[],
      liftQuais: [[31, 9, 3], [44, 9], [58, 9, 3]] as Pt[],
      liftVides: [[-165, 0, 2], [-120, 0], [-120, 20, 2], [-165, 20]] as Pt[],
      liftVerres: [[-85, 10, 2], [-30, 10, 2]] as Pt[],
      liftPatio: [[9, -20, 2], [26, -20, 2]] as Pt[],
      walkQuais: [[32, 16, 4], [58, 16, 3]] as Pt[],
      walkSoft: [[35.1, -3, 3], [35.1, -30, 2]] as Pt[],
      walkVins: [[70.6, -3, 2], [70.6, -30, 3]] as Pt[],
      walkPatio: [[10, -12, 2], [25, -12, 4]] as Pt[],
      walkVides: [[-150, 25, 3], [-112, 25, 2]] as Pt[],
      walkBureau: [[9, 14, 6], [-1, 10.5, 5]] as Pt[],
    }),
    [],
  );
  return (
    <group>
      <RoadTruck points={P.east} speed={11} frozen={frozen} />
      <RoadTruck points={P.east} speed={11} phase={0.55} frozen={frozen} stripe="#2f9e5b" />
      <RoadTruck points={P.west} speed={10} phase={0.3} frozen={frozen} />
      <RoadTruck points={P.delivery} speed={7} phase={0.15} frozen={frozen} stripe="#e08a1e" />
      <Lift points={P.liftSoft} frozen={frozen} />
      <Lift points={P.liftVins} frozen={frozen} phase={0.4} load="#b54d3a" />
      <Lift points={P.liftQuais} frozen={frozen} phase={0.2} load="#9eb7c9" />
      <Lift points={P.liftVerres} frozen={frozen} phase={0.6} load="#efebe5" />
      {dense && (
        <>
          <Lift points={P.liftVides} mode="loop" frozen={frozen} phase={0.1} load="#7f9a6f" />
          <Lift points={P.liftPatio} frozen={frozen} phase={0.7} />
          <Walker points={P.walkQuais} frozen={frozen} shirt="#ce0013" />
          <Walker points={P.walkSoft} frozen={frozen} phase={0.3} />
          <Walker points={P.walkVins} frozen={frozen} phase={0.6} skin="#8f5b3a" />
          <Walker points={P.walkPatio} frozen={frozen} phase={0.45} skin="#efc4a1" />
          <Walker points={P.walkVides} frozen={frozen} phase={0.2} skin="#bd8459" />
          <Walker points={P.walkBureau} frozen={frozen} phase={0.5} shirt="#2f7d55" skin="#f7dcc8" />
        </>
      )}
    </group>
  );
}
