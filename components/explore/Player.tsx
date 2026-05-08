"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { explore, getCombinedAxis } from "@/lib/explore";

export function Player() {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const bodyRotTarget = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(explore.position);

    const axis = getCombinedAxis();
    const len = Math.hypot(axis.x, axis.y);
    if (len > 0.05) bodyRotTarget.current = explore.facing;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, bodyRotTarget.current, 8, dt);

    if (head.current) {
      const t = performance.now() * 0.005;
      head.current.position.y = 1.45 + Math.sin(t) * (len > 0.1 ? 0.04 : 0.01);
    }
  });

  return (
    <group ref={group} position={[0, 0, 8]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.7, 6, 12]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh ref={head} position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.6} />
      </mesh>
      <Billboard position={[0, 2.1, 0]}>
        <Html
          center
          style={{
            pointerEvents: "none",
            fontFamily: "ui-sans-serif, system-ui",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#fefce8",
            background: "rgba(10,10,10,0.55)",
            backdropFilter: "blur(6px)",
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap",
          }}
        >
          Dotan
        </Html>
      </Billboard>
    </group>
  );
}
