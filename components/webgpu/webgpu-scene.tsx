/* eslint-disable react/no-unknown-property */

import { extend, useFrame, useThree } from "@react-three/fiber";
import { type ReactElement, useEffect, useRef } from "react";
import * as THREE from "three/webgpu";

extend({
  AmbientLight: THREE.AmbientLight,
  BoxGeometry: THREE.BoxGeometry,
  DirectionalLight: THREE.DirectionalLight,
  Mesh: THREE.Mesh,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  PointLight: THREE.PointLight,
});

function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    mesh.rotation.x += delta * 0.7;
    mesh.rotation.y += delta * 1.05;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.35, 1.35, 1.35]} />
      <meshStandardMaterial color="#7fff81" metalness={0.15} roughness={0.25} />
    </mesh>
  );
}

export function WebGpuScene(): ReactElement {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    scene.background = new THREE.Color("#51ace3");
  }, [scene]);

  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight intensity={3.2} position={[3, 4, 5]} />
      <pointLight color="#5eea88" intensity={18} position={[-2.4, -1.5, 2.6]} />
      <RotatingBox />
    </>
  );
}
