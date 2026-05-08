"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  explore,
  getCombinedAxis,
  setKeyAxis,
  requestJump,
} from "@/lib/explore";

const ISLAND_RADIUS = 38;
const ROTATE_SPEED = 2.5;

function clampToIsland(x: number, z: number): [number, number] {
  const r = Math.hypot(x, z);
  if (r > ISLAND_RADIUS) {
    return [(x / r) * ISLAND_RADIUS, (z / r) * ISLAND_RADIUS];
  }
  return [x, z];
}

export function PlayerControls() {
  useEffect(() => {
    const keys = new Set<string>();

    function recompute() {
      let kx = 0;
      let ky = 0;
      if (keys.has("w") || keys.has("arrowup")) ky -= 1;
      if (keys.has("s") || keys.has("arrowdown")) ky += 1;
      if (keys.has("a") || keys.has("arrowleft")) kx -= 1;
      if (keys.has("d") || keys.has("arrowright")) kx += 1;
      setKeyAxis(kx, ky);
    }

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === "shift") explore.running = true;
      if (k === " ") {
        e.preventDefault();
        requestJump();
      }
      recompute();
    }
    function onKeyUp(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys.delete(k);
      if (k === "shift") explore.running = false;
      recompute();
    }
    function onBlur() {
      keys.clear();
      explore.running = false;
      recompute();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame((_, dt) => {
    const capped = Math.min(dt, 0.05);
    const speed = (explore.running ? 9 : 5) * capped;
    const axis = getCombinedAxis();

    // A/D: rotate the entire view (GTA-style) — axis.x negated so A=left, D=right
    if (Math.abs(axis.x) > 0.05) {
      explore.cameraAngle -= axis.x * ROTATE_SPEED * capped;
    }

    // W/S: move forward/backward in the direction the camera faces
    if (Math.abs(axis.y) > 0.05) {
      const fwd = -axis.y; // W = axis.y -1 → positive forward
      explore.position.x += -Math.sin(explore.cameraAngle) * fwd * speed;
      explore.position.z += -Math.cos(explore.cameraAngle) * fwd * speed;
      explore.facing = explore.cameraAngle + Math.PI;
    }

    if (explore.jumpRequested) {
      if (explore.position.y <= 0.001) explore.velocity.y = 6;
      explore.jumpRequested = false;
    }
    explore.velocity.y -= 18 * dt;
    explore.position.y += explore.velocity.y * dt;
    if (explore.position.y < 0) {
      explore.position.y = 0;
      explore.velocity.y = 0;
    }

    const [cx, cz] = clampToIsland(explore.position.x, explore.position.z);
    explore.position.x = cx;
    explore.position.z = cz;
  });

  return null;
}
