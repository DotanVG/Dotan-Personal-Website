"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshTransmissionMaterial, Sphere } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { createNoise3D } from "simplex-noise";
import { dampBlobAngle, getBlobPose, getBlobRollDelta, stepBlobSpring } from "@/lib/blobMotion";
import * as THREE from "three";

const INITIAL_BLOB_POSE = getBlobPose(0);
const DEFORMATION_INTERVAL = 1 / 30;

function rotateInWorldSpace(
  mesh: THREE.Mesh,
  xAngle: number,
  yAngle: number,
  inverseParentQuaternion: THREE.Quaternion,
  axis: THREE.Vector3,
  rotation: THREE.Quaternion,
) {
  if (!mesh.parent) return;

  mesh.parent.getWorldQuaternion(inverseParentQuaternion).invert();

  if (xAngle !== 0) {
    axis.set(1, 0, 0).applyQuaternion(inverseParentQuaternion).normalize();
    rotation.setFromAxisAngle(axis, xAngle);
    mesh.quaternion.premultiply(rotation);
  }

  if (yAngle !== 0) {
    axis.set(0, 1, 0).applyQuaternion(inverseParentQuaternion).normalize();
    rotation.setFromAxisAngle(axis, yAngle);
    mesh.quaternion.premultiply(rotation);
  }
}

function useScrollProgress() {
  const ref = useRef(0);
  const maxScrollRef = useRef(1);
  useEffect(() => {
    function update() {
      ref.current = Math.min(1, window.scrollY / maxScrollRef.current);
    }
    function measure() {
      maxScrollRef.current = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      update();
    }
    measure();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
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
  const pathVelocityRef = useRef(new THREE.Vector3());
  const inverseParentQuaternionRef = useRef(new THREE.Quaternion());
  const rotationAxisRef = useRef(new THREE.Vector3());
  const rotationRef = useRef(new THREE.Quaternion());
  const lastDeformationRef = useRef(Number.NEGATIVE_INFINITY);
  const noise = useMemo(() => createNoise3D(), []);
  const basePositions = useRef<Float32Array | null>(null);
  const { resolvedTheme } = useTheme();

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current;
    const path = pathRef.current;
    if (!mesh || !path) return;

    const velocity = pointerVelocityRef.current;
    const sensitivity = 0.0018;
    const damping = 0.9;

    const sp = THREE.MathUtils.clamp(scrollRef.current ?? 0, 0, 1);
    const pose = getBlobPose(sp);
    const pathVelocity = pathVelocityRef.current;
    const previousX = path.position.x;
    const previousY = path.position.y;
    const nextX = stepBlobSpring(path.position.x, pathVelocity.x, pose.x, dt);
    const nextY = stepBlobSpring(path.position.y, pathVelocity.y, pose.y, dt);
    const nextZ = stepBlobSpring(path.position.z, pathVelocity.z, pose.z, dt);

    path.position.set(nextX.value, nextY.value, nextZ.value);
    pathVelocity.set(nextX.velocity, nextY.velocity, nextZ.velocity);

    const speed = Math.hypot(pathVelocity.x, pathVelocity.y);
    const roll = getBlobRollDelta(nextX.value - previousX, nextY.value - previousY);
    const stretch = Math.min(0.18, speed * 0.035);
    if (speed > 0.02) {
      const heading = Math.atan2(pathVelocity.y, pathVelocity.x);
      path.rotation.z = dampBlobAngle(path.rotation.z, heading, 3.5, dt);
    }
    rotateInWorldSpace(
      mesh,
      velocity.y * sensitivity + roll.x,
      velocity.x * sensitivity + roll.y,
      inverseParentQuaternionRef.current,
      rotationAxisRef.current,
      rotationRef.current,
    );
    velocity.x *= damping;
    velocity.y *= damping;

    path.scale.x = THREE.MathUtils.damp(path.scale.x, pose.scale * (1 + stretch), 5, dt);
    path.scale.y = THREE.MathUtils.damp(path.scale.y, pose.scale * (1 - stretch * 0.32), 5, dt);
    path.scale.z = THREE.MathUtils.damp(path.scale.z, pose.scale * (1 - stretch * 0.18), 5, dt);

    const elapsed = clock.getElapsedTime();
    if (elapsed - lastDeformationRef.current < DEFORMATION_INTERVAL) return;
    lastDeformationRef.current = elapsed;

    const motionEnergy = Math.min(1, speed * 0.18);
    const t = elapsed * 0.32;
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
      const k = 1 + swell * (0.16 + motionEnergy * 0.04) + ripples * (0.035 + motionEnergy * 0.015);
      pos.array[ix] = x * k;
      pos.array[ix + 1] = y * k;
      pos.array[ix + 2] = z * k;
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

  });

  const dark = resolvedTheme === "dark";

  return (
    <group
      ref={pathRef}
      position={[INITIAL_BLOB_POSE.x, INITIAL_BLOB_POSE.y, INITIAL_BLOB_POSE.z]}
      scale={INITIAL_BLOB_POSE.scale}
    >
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.35}>
        <Sphere args={[1.1, 64, 64]} ref={meshRef}>
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
        dpr={[1, 1.25]}
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
