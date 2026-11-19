"use client";
/* Décor du dépôt modélisé dans Blender (public/models/depot-ayguesvives.glb).
   Même repère que la scène : 1 = 1 mètre, x vers l'est, z vers le sud.
   Le fichier ne contient que le décor (bâtiments, racks, stockage, engins, bureau, logos) :
   camions, personnel et étiquettes restent ceux de l'application, alimentés par les données.
   Tant que le modèle charge, ou s'il ne charge pas, la maquette simple d'origine reste affichée. */
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

export const DEPOT_MODEL_URL = "/models/depot-ayguesvives.glb";
const DRACO_PATH = "/draco/";

function Model({ onReady }: { onReady: () => void }) {
  const { scene } = useGLTF(DEPOT_MODEL_URL, DRACO_PATH);
  const root = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.name || m.parent?.name || "").toLowerCase();
      // les sols et marquages reçoivent les ombres sans en projeter
      const flat = name.startsWith("sols") || name.startsWith("terrain") || name.startsWith("logo");
      m.castShadow = !flat;
      m.receiveShadow = true;
    });
    return s;
  }, [scene]);
  useEffect(() => onReady(), [onReady]);
  return <primitive object={root} />;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("Modèle 3D du dépôt indisponible, maquette simple affichée.", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Affiche le décor Blender ; `legacy` (la maquette simple) le remplace pendant le chargement ou en cas d'erreur. */
export function DepotModel({ legacy, onReady }: { legacy: ReactNode; onReady: () => void }) {
  return (
    <Boundary fallback={legacy}>
      <Suspense fallback={legacy}>
        <Model onReady={onReady} />
      </Suspense>
    </Boundary>
  );
}
