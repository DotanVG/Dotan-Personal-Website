"use client";

import { useMemo } from "react";
import { Environment, ContactShadows, Sky } from "@react-three/drei";
import * as THREE from "three";

const ISLAND_RADIUS = 40;

export function World() {
  const trees = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; hue: number }[] = [];
    const seed = (i: number) => Math.sin(i * 1234.567) * 0.5 + 0.5;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + seed(i) * 0.4;
      const r = 28 + seed(i + 7) * 9;
      arr.push({
        pos: [Math.cos(a) * r, 0, Math.sin(a) * r],
        scale: 0.6 + seed(i + 3) * 0.7,
        hue: 0.32 + seed(i + 11) * 0.06,
      });
    }
    return arr;
  }, []);

  const rocks = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number }[] = [];
    const seed = (i: number) => Math.sin(i * 999.13) * 0.5 + 0.5;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + seed(i + 5);
      const r = 32 + seed(i + 17) * 6;
      arr.push({
        pos: [Math.cos(a) * r, 0, Math.sin(a) * r],
        scale: 0.4 + seed(i + 22) * 0.6,
      });
    }
    return arr;
  }, []);

  return (
    <>
      <Sky sunPosition={[5, 8, -10]} turbidity={2} rayleigh={1.4} mieCoefficient={0.005} mieDirectionalG={0.7} />
      <Environment preset="sunset" />
      <hemisphereLight args={["#fde68a", "#1e293b", 0.55]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_RADIUS, 96]} />
        <meshStandardMaterial color="#3f6147" roughness={0.95} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[ISLAND_RADIUS - 1, ISLAND_RADIUS, 96]} />
        <meshStandardMaterial color="#a78bfa" roughness={0.6} emissive="#7c3aed" emissiveIntensity={0.25} />
      </mesh>

      <Path />

      <mesh position={[-ISLAND_RADIUS - 2, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={1} />
      </mesh>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={ISLAND_RADIUS * 2} blur={2.4} far={20} />

      {trees.map((t, i) => (
        <Tree key={`t${i}`} position={t.pos} scale={t.scale} hue={t.hue} />
      ))}
      {rocks.map((r, i) => (
        <Rock key={`r${i}`} position={r.pos} scale={r.scale} />
      ))}

      <CenterStatue />
    </>
  );
}

function Tree({ position, scale, hue }: { position: [number, number, number]; scale: number; hue: number }) {
  const color = new THREE.Color().setHSL(hue, 0.5, 0.4).getStyle();
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 1.4, 8]} />
        <meshStandardMaterial color="#5b3a1c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2, 0]} castShadow>
        <coneGeometry args={[0.9, 1.8, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 2.7, 0]} castShadow>
        <coneGeometry args={[0.7, 1.4, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function Rock({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <mesh position={[position[0], 0.2 * scale, position[2]]} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#6b7280" roughness={0.95} flatShading />
    </mesh>
  );
}

function Path() {
  const segments = 96;
  const r = 22;
  const positions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * r, 0.005, Math.sin(a) * r);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color="#fde68a" transparent opacity={0.6} />
    </line>
  );
}

function CenterStatue() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[1.6, 1.8, 0.8, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.4} flatShading />
      </mesh>
    </group>
  );
}
