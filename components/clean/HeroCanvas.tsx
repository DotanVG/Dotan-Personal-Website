"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshTransmissionMaterial, Sphere } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { createNoise3D } from "simplex-noise";
import * as THREE from "three";

function useScrollProgress() {
  const ref = useRef(0);
  useEffect(() => {
    function update() {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      ref.current = Math.min(1, window.scrollY / max);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
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
  const pathRef = useRef<THREE.Group>(null);
  const noise = useMemo(() => createNoise3D(), []);
  const basePositions = useRef<Float32Array | null>(null);
  const { resolvedTheme } = useTheme();

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current;
    const path = pathRef.current;
    if (!mesh || !path) return;

    const velocity = pointerVelocityRef.current;
    const sensitivity = 0.005;
    const damping = 0.95;

    mesh.rotation.y += velocity.x * sensitivity;
    mesh.rotation.x += velocity.y * sensitivity;
    mesh.rotation.z += dt * 0.08;

    velocity.x *= damping;
    velocity.y *= damping;

    const t = clock.getElapsedTime() * 0.32;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    if (!basePositions.current) {
      basePositions.current = new Float32Array(pos.array);
    }
    const base = basePositions.current;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = base[ix];
      const y = base[ix + 1];
      const z = base[ix + 2];
      const swell = noise(x * 0.72 + t, y * 0.72 + t * 0.8, z * 0.72 + t * 0.6);
      const ripples = noise(x * 1.8 - t * 0.7, y * 1.8 + t * 0.45, z * 1.8);
      const k = 1 + swell * 0.16 + ripples * 0.035;
      pos.array[ix] = x * k;
      pos.array[ix + 1] = y * k;
      pos.array[ix + 2] = z * k;
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const sp = THREE.MathUtils.clamp(scrollRef.current ?? 0, 0, 1);
    const angle = -0.2 + sp * Math.PI * 4;
    const radius = 0.65 - sp * 0.18;
    const x = 1.45 + Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 1.45;
    const z = -sp * 1.1;
    const scale = 1 - sp * 0.3;

    path.position.x = THREE.MathUtils.damp(path.position.x, x, 4, dt);
    path.position.y = THREE.MathUtils.damp(path.position.y, y, 4, dt);
    path.position.z = THREE.MathUtils.damp(path.position.z, z, 4, dt);
    const nextScale = THREE.MathUtils.damp(path.scale.x, scale, 4, dt);
    path.scale.setScalar(nextScale);
  });

  const dark = resolvedTheme === "dark";

  return (
    <group ref={pathRef} position={[2.08, -0.2, 0]}>
      <Float speed={0.5} rotationIntensity={0.12} floatIntensity={0.35}>
        <Sphere args={[1.1, 96, 96]} ref={meshRef}>
          <MeshTransmissionMaterial
            transmission={0.98}
            thickness={1.8}
            roughness={0.16}
            ior={1.42}
            chromaticAberration={0.035}
            anisotropy={0.12}
            distortion={0.3}
            distortionScale={0.35}
            temporalDistortion={0.14}
            clearcoat={0.7}
            clearcoatRoughness={0.22}
            resolution={512}
            samples={6}
            backside
            attenuationColor={dark ? "#5b21b6" : "#fde68a"}
            attenuationDistance={2.8}
            color={dark ? "#a78bfa" : "#fef3c7"}
          />
        </Sphere>
      </Float>
    </group>
  );
}

export default function HeroCanvas() {
  const scrollRef = useScrollProgress();
  const pointerVelocityRef = useRef({ x: 0, y: 0 });
  const previousPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const x = event.clientX;
      const y = event.clientY;
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

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
    };
  }, []);

  return (
    <div className="h-full w-full">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 7], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#fde68a" />
        <HeroBlob pointerVelocityRef={pointerVelocityRef} scrollRef={scrollRef} />
        <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      </Canvas>
    </div>
  );
}
