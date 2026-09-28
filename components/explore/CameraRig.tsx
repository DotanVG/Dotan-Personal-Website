"use client";

import { useRef } from "react";
import { sampleGround, type GroundSample } from "@/lib/game/city";
import { segmentBox3 } from "@/lib/game/collide";
import { clamp, damp, dampAngle, lerp, wrapAngle } from "@/lib/game/math";
import { getCar } from "@/lib/game/sim";
import { FRAME_ORDER, useGame, useGameFrame } from "./gameContext";

// Framing (metres, degrees). Portrait needs more road ahead, so it sits higher and further back.
const FRAMING = {
  foot: { dist: 6.4, height: 2.8, ahead: 1.2, fov: 55 },
  footPortrait: { dist: 8.2, height: 4.0, ahead: 2.6, fov: 62 },
  car: { dist: 8.2, height: 3.3, ahead: 4.5, fov: 56 },
  carPortrait: { dist: 10.6, height: 4.9, ahead: 7.5, fov: 64 },
};
/** Extra FOV at top speed (degrees); reduced motion keeps it minimal. */
const SPEED_FOV_DEG = 9;
const REDUCED_SPEED_FOV_DEG = 2;
const LOOK_RAD_PER_PX = 0.0065;
const PITCH_RAD_PER_PX = 0.004;
const RECENTER_AFTER_MS = 1500;

const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
/** Keep the camera this far from walls and roofs (near plane is 0.3 m). */
const CAMERA_CLEARANCE_M = 0.45;
const pad = { x: 0, z: 0, hx: 0, hz: 0, yaw: 0 };

export function CameraRig() {
  const { input, cam } = useGame();
  const s = useRef({
    init: false,
    lastTime: 0,
    yaw: 0,
    manualYaw: 0,
    pitch: 0,
    dist: 7,
    height: 3,
    ahead: 2,
    fov: 58,
    obstruct: 1,
    shake: 0,
    tx: 0,
    ty: 0,
    tz: 0,
  });

  useGameFrame(({ g, alpha, dt, camera, events, reduced }) => {
    const st = s.current;
    const p = g.player;
    const car = p.state === "driving" ? getCar(g, p.vehicleId) : null;
    const now = performance.now();
    const snap = !st.init || g.time < st.lastTime;
    st.lastTime = g.time;
    const portrait = camera.aspect < 0.85;

    // Manual orbit from drag input.
    const lx = input.lookDX;
    const ly = input.lookDY;
    input.lookDX = input.lookDY = 0;
    if (lx || ly) {
      input.lastLookAt = now;
      if (car) st.manualYaw = wrapAngle(st.manualYaw - lx * LOOK_RAD_PER_PX);
      else st.yaw -= lx * LOOK_RAD_PER_PX;
      st.pitch = clamp(st.pitch + ly * PITCH_RAD_PER_PX, -0.35, 0.75);
    }
    const idle = now - input.lastLookAt > RECENTER_AFTER_MS;
    if (cam.aimYaw !== null) {
      st.yaw = cam.aimYaw;
      st.manualYaw = 0;
      cam.aimYaw = null;
      input.lastLookAt = now;
    }

    let tx: number;
    let ty: number;
    let tz: number;
    let f: (typeof FRAMING)["foot"];
    let speedFov = 0;
    if (car) {
      tx = lerp(car.px, car.x, alpha);
      ty = lerp(car.py, car.y, alpha) + 1.1;
      tz = lerp(car.pz, car.z, alpha);
      const yaw = car.pyaw + wrapAngle(car.yaw - car.pyaw) * alpha;
      // Follow heading; lean into the velocity direction while sliding forward.
      let desired = yaw;
      if (car.speed > 4) {
        const velYaw = Math.atan2(car.vx, car.vz);
        desired = yaw + clamp(wrapAngle(velYaw - yaw), -0.6, 0.6) * 0.55;
      }
      st.yaw = snap ? desired : dampAngle(st.yaw, desired, 3.4, dt);
      if (idle) {
        st.manualYaw = damp(st.manualYaw, 0, 2.2, dt);
        st.pitch = damp(st.pitch, 0, 2.2, dt);
      }
      f = portrait ? FRAMING.carPortrait : FRAMING.car;
      const v = Math.min(Math.abs(car.speed), 40);
      speedFov = (v / 40) * (reduced ? REDUCED_SPEED_FOV_DEG : SPEED_FOV_DEG);
      f = { ...f, dist: f.dist + v * 0.06, ahead: f.ahead + Math.max(0, car.speed) * (portrait ? 0.28 : 0.18) };
    } else {
      tx = lerp(p.px, p.x, alpha);
      ty = lerp(p.py, p.y, alpha) + 1.45;
      tz = lerp(p.pz, p.z, alpha);
      if (snap) st.yaw = p.facing;
      else if (idle && p.moveSpeed > 0.5 && p.state === "onFoot") {
        // Lazy follow: drift behind the direction of travel.
        st.yaw = dampAngle(st.yaw, p.facing, 1.1 * Math.min(1, p.moveSpeed / 5), dt);
      }
      st.manualYaw = damp(st.manualYaw, 0, 4, dt);
      f = portrait ? FRAMING.footPortrait : FRAMING.foot;
    }

    const k = reduced ? 8 : 2.6;
    st.dist = snap ? f.dist : damp(st.dist, f.dist, k, dt);
    st.height = snap ? f.height : damp(st.height, f.height, k, dt);
    st.ahead = snap ? f.ahead : damp(st.ahead, f.ahead, k, dt);
    st.fov = snap ? f.fov : damp(st.fov, f.fov + speedFov, k, dt);
    st.tx = snap ? tx : damp(st.tx, tx, 14, dt);
    st.ty = snap ? ty : damp(st.ty, ty, 8, dt);
    st.tz = snap ? tz : damp(st.tz, tz, 14, dt);

    const yaw = st.yaw + st.manualYaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const dist = st.dist * (1 - st.pitch * 0.25);
    const height = st.height + st.pitch * st.dist * 0.7;
    let cx = st.tx - fx * dist;
    let cy = st.ty + height - 1;
    let cz = st.tz - fz * dist;

    // Pull in when a building or wall is between the target and the camera.
    let hit = 1;
    const x0 = Math.min(st.tx, cx) - 1;
    const x1 = Math.max(st.tx, cx) + 1;
    const z0 = Math.min(st.tz, cz) - 1;
    const z1 = Math.max(st.tz, cz) + 1;
    g.city.grid.forEachNear(x0, z0, x1, z1, (c) => {
      if (c.shape !== "box" || c.top < 2.5) return;
      // Inflate by the camera's clearance so it never grazes into a wall top or corner.
      pad.x = c.x;
      pad.z = c.z;
      pad.hx = c.hx + CAMERA_CLEARANCE_M;
      pad.hz = c.hz + CAMERA_CLEARANCE_M;
      pad.yaw = c.yaw;
      const t = segmentBox3(st.tx, st.ty, st.tz, cx, cy, cz, pad, -1, c.top + CAMERA_CLEARANCE_M);
      if (t >= 0 && t < hit) hit = t;
    });
    const want = hit < 1 ? Math.max(0.2, hit - 0.08) : 1;
    st.obstruct = snap ? want : want < st.obstruct ? damp(st.obstruct, want, 22, dt) : damp(st.obstruct, want, 2.5, dt);
    cx = st.tx + (cx - st.tx) * st.obstruct;
    cy = st.ty + (cy - st.ty) * st.obstruct;
    cz = st.tz + (cz - st.tz) * st.obstruct;
    cy = Math.max(cy, sampleGround(g.city, cx, cz, gs).h + 0.6);

    // Impact shake (never with reduced motion).
    if (!reduced) {
      for (const e of events) {
        if (e.type === "impact" && e.carId === p.vehicleId) st.shake = Math.max(st.shake, Math.min(0.32, e.severity * 0.014));
        if (e.type === "bump") st.shake = Math.max(st.shake, 0.12);
      }
    } else st.shake = 0;
    st.shake *= Math.exp(-dt * 9);
    const sh = st.shake;
    camera.position.set(cx + (Math.random() - 0.5) * sh, cy + (Math.random() - 0.5) * sh, cz + (Math.random() - 0.5) * sh);
    camera.lookAt(st.tx + fx * st.ahead, st.ty, st.tz + fz * st.ahead);
    if (Math.abs(camera.fov - st.fov) > 0.01) {
      camera.fov = st.fov;
      camera.updateProjectionMatrix();
    }
    cam.yaw = yaw;
    const hFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    g.viewer.x = cx;
    g.viewer.z = cz;
    g.viewer.fx = fx;
    g.viewer.fz = fz;
    g.viewer.halfFov = hFov;
    g.viewer.set = true;
    st.init = true;
  }, FRAME_ORDER.camera);

  return null;
}
