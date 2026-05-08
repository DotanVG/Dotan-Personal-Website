"use client";

import { useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { explore } from "@/lib/explore";
import type { ExploreBuildingType } from "@/types";

export type MarkerData = {
  slug: string;
  title: string;
  subtitle: string;
  start: string;
  end: string;
  current?: boolean;
  logo: string;
  blurb?: string;
  bullets: string[];
  building: ExploreBuildingType;
  position: [number, number];
  index: number;
};

export function LocationMarker({
  data,
  active,
  onActivate,
  onDeactivate,
}: {
  data: MarkerData;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const padRef = useRef<THREE.Mesh>(null);
  const inRange = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [px, pz] = data.position;
  const texture = useLoader(THREE.TextureLoader, data.logo);

  useFrame(({ clock }) => {
    const dx = explore.position.x - px;
    const dz = explore.position.z - pz;
    const dist = Math.hypot(dx, dz);
    const within = dist < 3.6;

    if (padRef.current) {
      const t = clock.elapsedTime;
      const mat = padRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity =
        0.6 + Math.sin(t * 2.4) * 0.25 + (within ? 0.6 : 0);
    }

    if (within && !inRange.current) {
      inRange.current = true;
      onActivate();
    } else if (!within && inRange.current) {
      inRange.current = false;
      onDeactivate();
    }
  });

  return (
    <group position={[px, 0, pz]}>
      <Building type={data.building} highlight={hovered || active || !!data.current} />

      <mesh
        ref={padRef}
        position={[0, 0.02, 4.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={onActivate}
      >
        <ringGeometry args={[1.2, 1.6, 48]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#facc15"
          emissiveIntensity={0.6}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group position={[0, 2, 4.2]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 2.8, 0.12]} />
          <meshStandardMaterial color="#262626" />
        </mesh>
        <Billboard position={[0, 1.6, 0]}>
          <mesh>
            <planeGeometry args={[1.6, 1.6]} />
            <meshBasicMaterial map={texture} transparent />
          </mesh>
        </Billboard>
      </group>

      <Billboard position={[0, 4.6, 0]}>
        <Html
          center
          style={{
            pointerEvents: "none",
            fontFamily: "ui-sans-serif, system-ui",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#fefce8",
            background: "rgba(10,10,10,0.6)",
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            whiteSpace: "nowrap",
          }}
        >
          {String(data.index + 1).padStart(2, "0")} · {data.subtitle}
        </Html>
      </Billboard>
    </group>
  );
}

function Building({
  type,
  highlight,
}: {
  type: ExploreBuildingType;
  highlight: boolean;
}) {
  const accent = highlight ? "#facc15" : "#a78bfa";
  switch (type) {
    case "tower":
      return (
        <group>
          <mesh position={[0, 3, 0]} castShadow>
            <boxGeometry args={[3, 6, 3]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} />
          </mesh>
          <mesh position={[0, 6.4, 0]} castShadow>
            <boxGeometry args={[2.2, 0.8, 2.2]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={highlight ? 0.6 : 0.2} />
          </mesh>
        </group>
      );
    case "block":
      return (
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[3.6, 3.2, 3]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
      );
    case "pavilion":
      return (
        <group>
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[3.6, 1.6, 3.6]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[3, 1.4, 4]} />
            <meshStandardMaterial color="#dc2626" roughness={0.6} />
          </mesh>
        </group>
      );
    case "shed":
      return (
        <group>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[3, 2, 2.4]} />
            <meshStandardMaterial color="#92400e" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.3, 0]} rotation={[0, 0, 0]} castShadow>
            <coneGeometry args={[2, 0.8, 4]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
          </mesh>
        </group>
      );
    case "academy":
      return (
        <group>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[4, 3.2, 3]} />
            <meshStandardMaterial color="#0f766e" roughness={0.7} />
          </mesh>
          <mesh position={[0, 3.8, 0]} castShadow>
            <coneGeometry args={[2.6, 1.6, 4]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={highlight ? 0.5 : 0.1} />
          </mesh>
        </group>
      );
    case "lighthouse":
      return (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[1.6, 1.8, 0.8, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.7, 1.0, 4.4, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
          </mesh>
          <mesh position={[0, 5.6, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.5, 16]} />
            <meshStandardMaterial color="#dc2626" emissive="#fb7185" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 6.1, 0]} castShadow>
            <coneGeometry args={[1.0, 0.9, 16]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      );
    case "glassCube":
      return (
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[3, 3.6, 3]} />
          <meshPhysicalMaterial
            color="#0ea5e9"
            transmission={0.6}
            roughness={0.05}
            thickness={0.5}
            ior={1.4}
          />
        </mesh>
      );
    case "brickBlock":
      return (
        <group>
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[3.4, 2.8, 3]} />
            <meshStandardMaterial color="#9a3412" roughness={0.85} />
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <boxGeometry args={[3.6, 0.4, 3.2]} />
            <meshStandardMaterial color="#451a03" roughness={0.9} />
          </mesh>
        </group>
      );
  }
}
