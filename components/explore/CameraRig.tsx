"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { explore } from "@/lib/explore";

export function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    target.current.copy(explore.position).add(new THREE.Vector3(0, 1.2, 0));

    const back = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      explore.facing,
    );
    desired.current
      .copy(explore.position)
      .add(new THREE.Vector3(0, 4.5, 0))
      .add(back.clone().multiplyScalar(7));

    camera.position.x = THREE.MathUtils.damp(camera.position.x, desired.current.x, 4, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desired.current.y, 4, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desired.current.z, 4, dt);

    camera.lookAt(target.current);
  });

  return null;
}
