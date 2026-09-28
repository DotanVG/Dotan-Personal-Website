"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleGround, type GroundSample } from "@/lib/game/city";
import { FRAME_ORDER, useGameFrame } from "./gameContext";

// Hard caps: effects never accumulate.
const MAX_DEBRIS = 60;
const MAX_SMOKE = 64;
const MAX_SKIDS = 420;
const DEBRIS_LIFE_S = 7;
const SMOKE_LIFE_S = 1.7;
const SKID_SPACING_M = 0.42;
/** Lateral slip (m/s) above which tyres leave marks. */
const SKID_SLIP_MPS = 2.4;

const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const tmpColor = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; spin: number };

export function Effects() {
  const res = useMemo(() => {
    const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.7), new THREE.MeshLambertMaterial(), MAX_DEBRIS);
    debris.castShadow = true;
    debris.frustumCulled = false;
    const smoke = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_SMOKE,
    );
    smoke.frustumCulled = false;
    const skidGeo = new THREE.PlaneGeometry(0.26, SKID_SPACING_M + 0.1);
    skidGeo.rotateX(-Math.PI / 2);
    const skids = new THREE.InstancedMesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ color: "#26262b", transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      MAX_SKIDS,
    );
    skids.frustumCulled = false;
    skids.renderOrder = 1;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      debris.setMatrixAt(i, ZERO);
      debris.setColorAt(i, tmpColor.set("#ffffff"));
    }
    for (let i = 0; i < MAX_SMOKE; i++) {
      smoke.setMatrixAt(i, ZERO);
      smoke.setColorAt(i, tmpColor.set("#ffffff"));
    }
    for (let i = 0; i < MAX_SKIDS; i++) skids.setMatrixAt(i, ZERO);
    return { debris, smoke, skids };
  }, []);
  useEffect(
    () => () => {
      for (const m of [res.debris, res.smoke, res.skids]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.dispose();
      }
    },
    [res],
  );

  const st = useRef({
    debris: Array.from({ length: MAX_DEBRIS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, spin: 0 }) as Particle),
    di: 0,
    smoke: Array.from({ length: MAX_SMOKE }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, spin: 0 }) as Particle),
    si: 0,
    ki: 0,
    lastSkid: new Map<number, { x: number; z: number }>(),
    smokeTimer: new Map<number, number>(),
  });

  useGameFrame(({ g, dt, events, reduced, paused }) => {
    if (paused) return;
    const s = st.current;
    const puff = (x: number, y: number, z: number, vy: number, size: number, life: number, color: string, vx = 0, vz = 0) => {
      const i = s.si;
      s.si = (s.si + 1) % MAX_SMOKE;
      Object.assign(s.smoke[i], { x, y, z, vx: vx + (Math.random() - 0.5) * 0.8, vy, vz: vz + (Math.random() - 0.5) * 0.8, life, max: life, size, spin: 0 });
      res.smoke.setColorAt(i, tmpColor.set(color));
    };

    for (const ev of events) {
      if (ev.type === "debris") {
        const p = s.debris[s.di];
        res.debris.setColorAt(s.di, tmpColor.set(ev.color));
        s.di = (s.di + 1) % MAX_DEBRIS;
        Object.assign(p, { x: ev.x, y: ev.y, z: ev.z, vx: ev.vx, vy: ev.vy, vz: ev.vz, life: DEBRIS_LIFE_S, max: DEBRIS_LIFE_S, size: ev.size, spin: (Math.random() - 0.5) * 12 });
      } else if (ev.type === "impact" && ev.damage > 0) {
        // Low, small dust kicked out from the contact point, away from the body.
        const car = g.cars.find((c) => c.id === ev.carId);
        const ox = car ? ev.x - car.x : 0;
        const oz = car ? ev.z - car.z : 0;
        const ol = Math.hypot(ox, oz) || 1;
        const n = ev.damage > 12 ? 4 : 2;
        for (let i = 0; i < n; i++)
          puff(ev.x, 0.35, ev.z, 0.5 + Math.random() * 0.6, 0.2 + Math.min(0.25, ev.severity * 0.01), 0.75, "#d9d2c4", (ox / ol) * 1.6, (oz / ol) * 1.6);
      } else if (ev.type === "splash") {
        for (let i = 0; i < 8; i++) puff(ev.x + (Math.random() - 0.5) * 2, -0.3, ev.z + (Math.random() - 0.5) * 2, 2.5 + Math.random() * 2, 0.6, 1.1, "#f4f7f7");
      }
    }

    // Smoke from damaged cars near the player.
    const p0 = g.player;
    for (const c of g.cars) {
      if (c.condition > 38 && !c.wrecked) continue;
      if (Math.abs(c.x - p0.x) > 90 || Math.abs(c.z - p0.z) > 90) continue;
      const rate = (c.wrecked ? 7 : 3) * (reduced ? 0.5 : 1);
      const tm = (s.smokeTimer.get(c.id) ?? 0) + dt * rate;
      if (tm >= 1) {
        const f = c.spec.halfLength * 0.7;
        puff(c.x + Math.sin(c.yaw) * f, c.y + c.spec.height * 0.7, c.z + Math.cos(c.yaw) * f, 1.4, c.wrecked ? 0.55 : 0.4, SMOKE_LIFE_S, c.wrecked ? "#5b5a5c" : "#cfcac2");
        s.smokeTimer.set(c.id, tm - 1);
      } else s.smokeTimer.set(c.id, tm);
    }
    if (s.smokeTimer.size > 64) s.smokeTimer.clear();

    // Skid marks at the rear wheels while sliding or braking hard.
    for (const c of g.cars) {
      if (c.airborne || c.flip > 0.2 || c.inWater) {
        s.lastSkid.delete(c.id);
        continue;
      }
      if (Math.abs(c.x - p0.x) > 70 || Math.abs(c.z - p0.z) > 70) continue;
      const sn = Math.sin(c.yaw);
      const cs = Math.cos(c.yaw);
      const lat = c.vx * cs - c.vz * sn;
      const speed = Math.hypot(c.vx, c.vz);
      const sliding = Math.abs(lat) > SKID_SLIP_MPS || (c.drive.handbrake && speed > 4) || (c.drive.brake > 0.8 && c.speed > 9);
      if (!sliding) {
        s.lastSkid.delete(c.id);
        continue;
      }
      const rx = c.x - sn * c.spec.wheelbase * 0.5;
      const rz = c.z - cs * c.spec.wheelbase * 0.5;
      const last = s.lastSkid.get(c.id);
      if (last && Math.hypot(rx - last.x, rz - last.z) < SKID_SPACING_M) continue;
      if (last) {
        last.x = rx;
        last.z = rz;
      } else s.lastSkid.set(c.id, { x: rx, z: rz });
      const dir = Math.atan2(c.vx, c.vz);
      for (const side of [1, -1]) {
        const wx = rx + cs * side * c.spec.track * 0.5;
        const wz = rz - sn * side * c.spec.track * 0.5;
        const h = sampleGround(g.city, wx, wz, gs).h;
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, dir);
        m4.compose(pos.set(wx, h + 0.025, wz), q, scl.set(1, 1, 1));
        res.skids.setMatrixAt(s.ki, m4);
        s.ki = (s.ki + 1) % MAX_SKIDS;
      }
      res.skids.instanceMatrix.needsUpdate = true;
    }
    if (s.lastSkid.size > 64) s.lastSkid.clear();

    // Integrate debris: gravity, bounce, friction, fade by shrinking.
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const p = s.debris[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 16 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const h = sampleGround(g.city, p.x, p.z, gs).h + 0.08 * p.size;
      if (p.y < h) {
        p.y = h;
        p.vy = Math.abs(p.vy) * 0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
        p.spin *= 0.6;
      }
      const k = p.life <= 0 ? 0 : Math.min(1, p.life / 1.2) * p.size;
      e.set(p.spin * (p.max - p.life), p.spin * 0.7 * (p.max - p.life), 0);
      q.setFromEuler(e);
      m4.compose(pos.set(p.x, p.y, p.z), q, scl.set(k, k, k));
      res.debris.setMatrixAt(i, m4);
    }
    res.debris.instanceMatrix.needsUpdate = true;
    if (res.debris.instanceColor) res.debris.instanceColor.needsUpdate = true;

    // Integrate smoke: rise, drift, grow, then shrink away.
    for (let i = 0; i < MAX_SMOKE; i++) {
      const p = s.smoke[i];
      if (p.life <= 0) {
        res.smoke.setMatrixAt(i, ZERO);
        continue;
      }
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy *= 1 - Math.min(1, dt * 0.8);
      const t = 1 - p.life / p.max;
      const k = p.life <= 0 ? 0 : p.size * (0.6 + t * 1.3) * Math.min(1, p.life / 0.4);
      m4.compose(pos.set(p.x, p.y, p.z), q.identity(), scl.set(k, k, k));
      res.smoke.setMatrixAt(i, m4);
    }
    res.smoke.instanceMatrix.needsUpdate = true;
    if (res.smoke.instanceColor) res.smoke.instanceColor.needsUpdate = true;
  }, FRAME_ORDER.effects);

  return (
    <>
      <primitive object={res.debris} />
      <primitive object={res.smoke} />
      <primitive object={res.skids} />
    </>
  );
}
