"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleGround, type GroundSample } from "@/lib/game/city";
import { lerp, wrapAngle } from "@/lib/game/math";
import type { SimCar } from "@/lib/game/sim";
import type { VehicleKind } from "@/lib/game/vehicle";
import { CarBody, tailLightPos, wheelGeometry } from "./carMesh";
import { FRAME_ORDER, useGame, useGameFrame } from "./gameContext";

const MAX_CARS = 48;

export function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(40,30,25,0.55)");
  grad.addColorStop(0.6, "rgba(40,30,25,0.28)");
  grad.addColorStop(1, "rgba(40,30,25,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler(0, 0, 0, "YXZ");
const v = new THREE.Vector3();
const s3 = new THREE.Vector3();
const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
const RED = new THREE.Color("#ff3b2f");
const WHITE = new THREE.Color("#fff8e8");

/** Interpolated render transform of a car's body (including rollover). */
export function carMatrix(c: SimCar, alpha: number, out: THREE.Matrix4) {
  const x = lerp(c.px, c.x, alpha);
  const z = lerp(c.pz, c.z, alpha);
  const y = lerp(c.py, c.y, alpha);
  const yaw = c.pyaw + wrapAngle(c.yaw - c.pyaw) * alpha;
  const lift = c.flip * c.spec.height + Math.sin(c.flip * Math.PI) * 0.8;
  e.set(-(c.pitch + c.terrainPitch), yaw, c.roll + c.terrainRoll + c.flip * Math.PI);
  q.setFromEuler(e);
  v.set(x, y + lift, z);
  return out.compose(v, q, s3.set(1, 1, 1));
}

export function Vehicles() {
  useGame();
  const group = useRef<THREE.Group>(null);
  const res = useMemo(() => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const wheels = new THREE.InstancedMesh(wheelGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_CARS * 4);
    wheels.castShadow = true;
    wheels.frustumCulled = false;
    wheels.count = 0;
    const glowGeo = new THREE.PlaneGeometry(0.36, 0.16);
    const glows = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_CARS * 2);
    glows.frustumCulled = false;
    glows.setColorAt(0, RED);
    glows.count = 0;
    const blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    const blobTex = blobTexture();
    const blobs = new THREE.InstancedMesh(
      blobGeo,
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      MAX_CARS,
    );
    blobs.frustumCulled = false;
    blobs.count = 0;
    blobs.renderOrder = 1;
    return { material, wheels, glows, blobs, blobTex };
  }, []);
  const pools = useRef(new Map<VehicleKind, CarBody[]>());
  const active = useRef(new Map<number, CarBody>());
  const frame = useRef(0);

  useEffect(() => {
    const act = active.current;
    const pl = pools.current;
    return () => {
      for (const body of [...act.values(), ...[...pl.values()].flat()]) body.mesh.geometry.dispose();
      act.clear();
      pl.clear();
      res.material.dispose();
      for (const m of [res.wheels, res.glows, res.blobs]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.dispose();
      }
      res.blobTex.dispose();
    };
  }, [res]);

  useGameFrame(({ g, alpha }) => {
    const root = group.current;
    if (!root) return;
    const stamp = ++frame.current;
    let wi = 0;
    let gi = 0;
    let bi = 0;
    for (const c of g.cars) {
      let body = active.current.get(c.id);
      if (!body) {
        const pool = pools.current.get(c.spec.kind) ?? [];
        body = pool.pop() ?? new CarBody(c.spec.kind, res.material);
        pools.current.set(c.spec.kind, pool);
        body.assign(c.id, c.paint);
        root.add(body.mesh);
        active.current.set(c.id, body);
      }
      body.stamp = stamp;
      if (body.damageVersion !== c.damageVersion) {
        body.damageVersion = c.damageVersion;
        if (c.damageVersion > 0) body.applyDamage(c.dents, c.detached, c.cracked, c.wrecked);
      }
      carMatrix(c, alpha, body.mesh.matrix);
      body.mesh.matrixWorldNeedsUpdate = true;

      // Wheels: steer (front), spin, and a splayed wheel on wrecks.
      const spec = c.spec;
      for (let k = 0; k < 4 && wi < MAX_CARS * 4; k++) {
        const front = k < 2;
        const side = k % 2 === 0 ? 1 : -1;
        e.set(c.wheelSpin, front ? -c.steer : 0, c.wrecked && k === 0 ? 0.35 : 0);
        q.setFromEuler(e);
        v.set(side * (spec.track / 2), spec.wheelRadius, front ? spec.wheelbase / 2 : -spec.wheelbase / 2);
        m4b.compose(v, q, s3.set(0.24, spec.wheelRadius, spec.wheelRadius));
        m4.multiplyMatrices(body.mesh.matrix, m4b);
        res.wheels.setMatrixAt(wi++, m4);
      }

      // Brake and reverse light glows at the tail.
      const braking = c.drive.brake > 0.1 && c.speed > 0.5;
      const reversing = c.speed < -0.4;
      if ((braking || reversing || (c.drive.handbrake && Math.abs(c.speed) > 1)) && c.flip < 0.2) {
        const tl = tailLightPos(spec.kind);
        for (const side of [1, -1]) {
          v.set(side * tl.x, tl.y, tl.z - 0.02);
          q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI);
          m4b.compose(v, q, s3.set(1, 1, 1));
          m4.multiplyMatrices(body.mesh.matrix, m4b);
          res.glows.setMatrixAt(gi, m4);
          res.glows.setColorAt(gi++, reversing ? WHITE : RED);
        }
      }

      // Contact shadow on the ground under the car.
      const x = lerp(c.px, c.x, alpha);
      const z = lerp(c.pz, c.z, alpha);
      sampleGround(g.city, x, z, gs);
      const yaw = c.pyaw + wrapAngle(c.yaw - c.pyaw) * alpha;
      const height = Math.max(0, lerp(c.py, c.y, alpha) - gs.h);
      const k = Math.max(0.3, 1 - height * 0.25);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      v.set(x, gs.h + 0.03, z);
      m4.compose(v, q, s3.set(spec.halfWidth * 2.7 * k, 1, spec.halfLength * 2.5 * k));
      res.blobs.setMatrixAt(bi++, m4);
    }
    for (const [id, body] of active.current) {
      if (body.stamp === stamp) continue;
      root.remove(body.mesh);
      active.current.delete(id);
      const pool = pools.current.get(body.kind);
      if (pool) pool.push(body);
      else pools.current.set(body.kind, [body]);
    }
    res.wheels.count = wi;
    res.wheels.instanceMatrix.needsUpdate = true;
    res.glows.count = gi;
    res.glows.instanceMatrix.needsUpdate = true;
    if (res.glows.instanceColor) res.glows.instanceColor.needsUpdate = true;
    res.blobs.count = bi;
    res.blobs.instanceMatrix.needsUpdate = true;
  }, FRAME_ORDER.views);

  return (
    <group>
      <group ref={group} />
      <primitive object={res.wheels} />
      <primitive object={res.glows} />
      <primitive object={res.blobs} />
    </group>
  );
}
