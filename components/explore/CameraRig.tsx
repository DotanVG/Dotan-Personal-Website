"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { explore, getCombinedAxis } from "@/lib/explore";
import { useReducedMotion } from "@/lib/useReducedMotion";

const CAM_DIST = 10;
const CAM_HEIGHT = 5.2;

const DRAG_RADIANS_PER_PX = 0.005;
// Per-frame retention at 60fps, mirroring the HeroCanvas pointer-velocity decay.
const SPIN_DECAY = 0.94;
const SPIN_EPSILON = 0.02;
// A pointer parked this long before release reads as a stop, not a flick.
const FLICK_WINDOW_MS = 90;

export function CameraRig() {
  const { camera, gl } = useThree();
  const reduced = useReducedMotion();
  const target = useRef(new THREE.Vector3());
  const spin = useRef(0);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const el = gl.domElement;
    // Set here rather than via <Canvas className>, which styles the wrapper div and
    // would leave the canvas itself panning the page on a one-finger drag.
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "none";

    let activePointer: number | null = null;
    let lastX = 0;
    let velocity = 0;
    let lastMoveAt = 0;

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0) return;
      spin.current = 0;
      activePointer = e.pointerId;
      lastX = e.clientX;
      velocity = 0;
      lastMoveAt = performance.now();
      el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointer) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      lastMoveAt = performance.now();
      velocity = velocity * 0.7 + dx * 0.3;
      explore.cameraAngle += dx * DRAG_RADIANS_PER_PX;
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const stalled = performance.now() - lastMoveAt > FLICK_WINDOW_MS;
      spin.current =
        stalled || reducedRef.current ? 0 : velocity * DRAG_RADIANS_PER_PX * 60;
      velocity = 0;
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.style.touchAction = previousTouchAction;
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl]);

  useFrame((_, dt) => {
    if (spin.current !== 0) {
      // Keyboard/joystick rotation takes priority so the two inputs never fight.
      if (Math.abs(getCombinedAxis().x) > 0.05) {
        spin.current = 0;
      } else {
        explore.cameraAngle += spin.current * dt;
        spin.current *= Math.pow(SPIN_DECAY, dt * 60);
        if (Math.abs(spin.current) < SPIN_EPSILON) spin.current = 0;
      }
    }

    target.current.set(
      explore.position.x,
      explore.position.y + 1.2,
      explore.position.z,
    );

    const desiredX = explore.position.x + Math.sin(explore.cameraAngle) * CAM_DIST;
    const desiredY = explore.position.y + CAM_HEIGHT;
    const desiredZ = explore.position.z + Math.cos(explore.cameraAngle) * CAM_DIST;

    const k = 6;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, k, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, k, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, k, dt);

    camera.lookAt(target.current);
  });

  return null;
}
