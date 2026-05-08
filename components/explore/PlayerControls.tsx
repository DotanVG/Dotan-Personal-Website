"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { explore } from "@/lib/explore";
import * as THREE from "three";

const ISLAND_RADIUS = 38;

function clampToIsland(pos: THREE.Vector3) {
  const r = Math.hypot(pos.x, pos.z);
  if (r > ISLAND_RADIUS) {
    pos.x = (pos.x / r) * ISLAND_RADIUS;
    pos.z = (pos.z / r) * ISLAND_RADIUS;
  }
}

export function PlayerControls() {
  useEffect(() => {
    const keys = new Set<string>();

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === "shift") explore.running = true;
      if (k === " ") explore.jumpRequested = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys.delete(k);
      if (k === "shift") explore.running = false;
    }

    function tick() {
      let kx = 0;
      let ky = 0;
      if (keys.has("w") || keys.has("arrowup")) ky -= 1;
      if (keys.has("s") || keys.has("arrowdown")) ky += 1;
      if (keys.has("a") || keys.has("arrowleft")) kx -= 1;
      if (keys.has("d") || keys.has("arrowright")) kx += 1;

      if (kx !== 0 || ky !== 0) {
        explore.axis.x = kx;
        explore.axis.y = ky;
      } else if (
        !document
          .querySelector('[data-explore-joystick="active"]')
          ?.hasAttribute("data-explore-joystick")
      ) {
        explore.axis.x = 0;
        explore.axis.y = 0;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const id = window.setInterval(tick, 33);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.clearInterval(id);
    };
  }, []);

  useFrame((_, dt) => {
    const speed = (explore.running ? 9 : 5) * dt;
    const ax = explore.axis.x;
    const ay = explore.axis.y;
    const len = Math.hypot(ax, ay);
    if (len > 0.01) {
      const nx = ax / Math.max(1, len);
      const ny = ay / Math.max(1, len);
      explore.position.x += nx * speed;
      explore.position.z += ny * speed;
      explore.facing = Math.atan2(nx, ny);
    }

    if (explore.jumpRequested) {
      explore.velocity.y = 6;
      explore.jumpRequested = false;
    }
    explore.velocity.y -= 18 * dt;
    explore.position.y += explore.velocity.y * dt;
    if (explore.position.y < 0) {
      explore.position.y = 0;
      explore.velocity.y = 0;
    }

    clampToIsland(explore.position);
  });

  return null;
}
