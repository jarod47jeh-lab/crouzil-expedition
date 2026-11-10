"use client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Truck } from "./scene";
import type { DepotVehicle } from "./summary";

/** Le véhicule seul, en 3D, avec la couleur de son état */
export default function VehicleModel({ v }: { v: DepotVehicle }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [7, 4.5, 8], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={["#fff4e8", "#6b5a4c", 0.9]} />
      <directionalLight position={[6, 10, 6]} intensity={1.3} castShadow />
      <group position={[0, -1.2, 0]}>
        <group scale={1 / 1.45}>
          <Truck v={v} spot={[0, 0, 0]} selected={false} />
        </group>
        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={14} blur={2.4} far={4} />
      </group>
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.1} minPolarAngle={Math.PI * 0.25} maxPolarAngle={Math.PI * 0.45} />
    </Canvas>
  );
}
