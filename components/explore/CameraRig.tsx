"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { explore } from "@/lib/explore";

const CAM_DIST = 10;
const CAM_HEIGHT = 5.2;

export function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
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
