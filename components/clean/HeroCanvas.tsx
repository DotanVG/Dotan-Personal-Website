"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, MeshTransmissionMaterial, Environment, Float } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { createNoise3D } from "simplex-noise";
import * as THREE from "three";

function useScrollProgress() {
  const ref = useRef(0);
  useEffect(() => {
    function update() {
      const max = Math.max(1, window.innerHeight * 1.5);
      ref.current = Math.min(1, window.scrollY / max);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return ref;
}

type PointerVelocityRef = React.RefObject<{
  x: number;
  y: number;
}>;

function HeroBlob({
  pointerVelocityRef,
  scrollRef,
}: {
  pointerVelocityRef: PointerVelocityRef;
  scrollRef: React.RefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const noise = useMemo(() => createNoise3D(), []);
  const basePositions = useRef<Float32Array | null>(null);
  const { resolvedTheme } = useTheme();

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const velocity = pointerVelocityRef.current;
    const sensitivity = 0.005;
    const damping = 0.95;

    mesh.rotation.y += velocity.x * sensitivity;
    mesh.rotation.x += velocity.y * sensitivity;
    mesh.rotation.z += dt * 0.05;

    velocity.x *= damping;
    velocity.y *= damping;

    const t = performance.now() * 0.00045;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    if (!basePositions.current) {
      basePositions.current = new Float32Array(pos.array);
    }
    const base = basePositions.current;
    const amp = 0.14;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = base[ix];
      const y = base[ix + 1];
      const z = base[ix + 2];
      const n = noise(x * 0.9 + t, y * 0.9 + t, z * 0.9);
      const k = 1 + n * amp;
      pos.array[ix] = x * k;
      pos.array[ix + 1] = y * k;
      pos.array[ix + 2] = z * k;
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const sp = scrollRef.current ?? 0;
    const scale = 1 - sp * 0.35;
    mesh.scale.setScalar(scale);
    mesh.position.y = sp * -1.4;
  });

  const dark = resolvedTheme === "dark";

  return (
    <Float speed={0.6} rotationIntensity={0.2} floatIntensity={0.6}>
      <Icosahedron args={[1.1, 8]} ref={meshRef}>
        <MeshTransmissionMaterial
          transmission={1}
          thickness={1.4}
          roughness={0.05}
          ior={1.45}
          chromaticAberration={0.06}
          anisotropy={0.2}
          distortion={0.4}
          distortionScale={0.5}
          temporalDistortion={0.2}
          backside
          attenuationColor={dark ? "#5b21b6" : "#fde68a"}
          attenuationDistance={2.4}
          color={dark ? "#a78bfa" : "#fef3c7"}
        />
      </Icosahedron>
    </Float>
  );
}

export default function HeroCanvas() {
  const scrollRef = useScrollProgress();
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerVelocityRef = useRef({ x: 0, y: 0 });
  const previousPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerEl = container;

    function handlePointerMove(event: PointerEvent) {
      const rect = containerEl.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const previous = previousPointerRef.current;

      if (previous) {
        pointerVelocityRef.current.x = x - previous.x;
        pointerVelocityRef.current.y = y - previous.y;
      }

      previousPointerRef.current = { x, y };
    }

    function resetPointer() {
      previousPointerRef.current = null;
    }

    containerEl.addEventListener("pointermove", handlePointerMove);
    containerEl.addEventListener("pointerleave", resetPointer);

    return () => {
      containerEl.removeEventListener("pointermove", handlePointerMove);
      containerEl.removeEventListener("pointerleave", resetPointer);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 7], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#fde68a" />
        <HeroBlob pointerVelocityRef={pointerVelocityRef} scrollRef={scrollRef} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
