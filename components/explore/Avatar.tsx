"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleGround, type GroundSample } from "@/lib/game/city";
import { lerp, wrapAngle } from "@/lib/game/math";
import { RUN_MPS } from "@/lib/game/sim";
import { MeshBuilder } from "./meshBuilder";
import { FRAME_ORDER, useGame, useGameFrame } from "./gameContext";
import { blobTexture } from "./Vehicles";

// Dotan: navy trousers, teal shirt, a mustard backpack for a readable silhouette.
const SKIN = "#e2ae86";
const HAIR = "#3a2a21";
const SHIRT = "#2b7f8e";
const PANTS = "#2d3548";
const SHOE = "#f3efe6";
const PACK = "#e3b04b";

const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };

function part(build: (b: MeshBuilder) => void) {
  const b = new MeshBuilder();
  build(b);
  return b.build();
}

export function Avatar() {
  const { reduced } = useGame();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  const res = useMemo(() => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const leg = part((b) => {
      b.box(0, -0.42, 0, 0.2, 0.84, 0.24, PANTS);
      b.box(0, -0.9, 0.06, 0.22, 0.14, 0.36, SHOE);
    });
    const arm = part((b) => {
      b.box(0, -0.26, 0, 0.16, 0.52, 0.18, SHIRT);
      b.box(0, -0.6, 0, 0.13, 0.18, 0.14, SKIN);
    });
    const torso = part((b) => {
      b.box(0, 0.32, 0, 0.56, 0.64, 0.32, SHIRT);
      b.box(0, -0.02, 0, 0.5, 0.12, 0.3, PANTS);
      // Backpack.
      b.box(0, 0.36, -0.25, 0.42, 0.5, 0.2, PACK);
      b.box(0, 0.62, -0.25, 0.34, 0.06, 0.18, "#c9953a");
    });
    const headGeo = part((b) => {
      b.box(0, 0.2, 0, 0.36, 0.38, 0.34, SKIN);
      b.box(0, 0.4, -0.02, 0.4, 0.1, 0.38, HAIR);
      b.box(0, 0.28, -0.16, 0.38, 0.26, 0.08, HAIR);
      b.box(0, 0.2, 0.18, 0.06, 0.08, 0.05, "#d19a74");
      b.box(0.09, 0.26, 0.172, 0.05, 0.05, 0.01, "#2a2320");
      b.box(-0.09, 0.26, 0.172, 0.05, 0.05, 0.01, "#2a2320");
    });
    const blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    const blobTex = blobTexture();
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return { material, leg, arm, torso, headGeo, blobGeo, blobTex, blobMat };
  }, []);
  useEffect(
    () => () => {
      for (const g of [res.leg, res.arm, res.torso, res.headGeo, res.blobGeo]) g.dispose();
      res.material.dispose();
      res.blobMat.dispose();
      res.blobTex.dispose();
    },
    [res],
  );

  useGameFrame(({ g, alpha, dt }) => {
    const p = g.player;
    const r = root.current;
    if (!r || !body.current || !legL.current || !legR.current || !armL.current || !armR.current || !head.current) return;
    t.current += dt;
    const x = lerp(p.px, p.x, alpha);
    const z = lerp(p.pz, p.z, alpha);
    const y = lerp(p.py, p.y, alpha);
    r.position.set(x, y, z);
    r.rotation.y = p.pfacing + wrapAngle(p.facing - p.pfacing) * alpha;

    // Visibility and the enter/exit shrink.
    let scale = 1;
    if (p.state === "driving") scale = 0;
    else if (p.state === "entering") scale = Math.max(0, 1 - Math.max(0, p.t - 0.55) / 0.45);
    else if (p.state === "exiting") scale = Math.min(1, p.t / 0.5);
    r.visible = scale > 0.01;
    r.scale.setScalar(Math.max(0.01, scale));
    if (shadow.current) {
      const h = sampleGround(g.city, x, z, gs).h;
      shadow.current.visible = r.visible && gs.surface !== "water";
      shadow.current.position.set(x, h + 0.03, z);
      const k = Math.max(0.4, 1 - (y - h) * 0.4) * 1.1;
      shadow.current.scale.set(k, 1, k);
    }

    // Walk / run cycle tied to distance travelled (no foot sliding).
    const speed = p.moveSpeed;
    const phase = p.walkPhase * Math.PI;
    const amp = Math.min(0.95, speed * 0.13);
    const running = speed > RUN_MPS * 0.75;
    let legSwing = Math.sin(phase) * amp;
    let armSwing = -legSwing * 0.9;
    let lean = running ? 0.18 : speed * 0.015;
    let bob = Math.abs(Math.sin(phase)) * amp * 0.07;
    if (!p.grounded) {
      legSwing = 0.5;
      armSwing = -2.4;
      lean = -0.05;
      bob = 0;
    }
    if (p.stumbleS > 0) lean = -0.5;
    legL.current.rotation.x = legSwing;
    legR.current.rotation.x = !p.grounded ? -0.3 : -legSwing;
    armL.current.rotation.x = armSwing;
    armR.current.rotation.x = !p.grounded ? -2.4 : -armSwing;
    armL.current.rotation.z = 0.08;
    armR.current.rotation.z = -0.08;
    body.current.rotation.x = lean;
    const breathe = reduced || speed > 0.2 ? 0 : Math.sin(t.current * 2) * 0.012;
    body.current.position.y = bob + breathe;
    head.current.rotation.y = speed < 0.2 && !reduced ? Math.sin(t.current * 0.5) * 0.25 : 0;
  }, FRAME_ORDER.views);

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          <group ref={legL} position={[0.13, 0.95, 0]}>
            <mesh geometry={res.leg} material={res.material} castShadow />
          </group>
          <group ref={legR} position={[-0.13, 0.95, 0]}>
            <mesh geometry={res.leg} material={res.material} castShadow />
          </group>
          <mesh geometry={res.torso} material={res.material} position={[0, 1.0, 0]} castShadow />
          <group ref={armL} position={[0.37, 1.58, 0]}>
            <mesh geometry={res.arm} material={res.material} castShadow />
          </group>
          <group ref={armR} position={[-0.37, 1.58, 0]}>
            <mesh geometry={res.arm} material={res.material} castShadow />
          </group>
          <group ref={head} position={[0, 1.66, 0]}>
            <mesh geometry={res.headGeo} material={res.material} castShadow />
          </group>
        </group>
      </group>
      <mesh ref={shadow} geometry={res.blobGeo} material={res.blobMat} scale={[1.1, 1, 1.1]} renderOrder={1} />
    </>
  );
}
