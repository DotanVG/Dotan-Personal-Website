import { Vector3 } from "three";

type Axis = { x: number; y: number };

export const explore = {
  position: new Vector3(0, 0, 8),
  velocity: new Vector3(),
  facing: Math.PI,
  cameraAngle: 0,
  keyAxis: { x: 0, y: 0 } as Axis,
  joyAxis: { x: 0, y: 0 } as Axis,
  running: false,
  jumpRequested: false,
};

export function getCombinedAxis(): Axis {
  const k = explore.keyAxis;
  if (Math.abs(k.x) > 0.01 || Math.abs(k.y) > 0.01) return k;
  return explore.joyAxis;
}

export function setKeyAxis(x: number, y: number) {
  explore.keyAxis.x = x;
  explore.keyAxis.y = y;
}

export function setJoyAxis(x: number, y: number) {
  explore.joyAxis.x = x;
  explore.joyAxis.y = y;
}

export function requestJump() {
  explore.jumpRequested = true;
}

export function resetExplore() {
  explore.position.set(0, 0, 8);
  explore.velocity.set(0, 0, 0);
  explore.facing = Math.PI;
  explore.cameraAngle = 0;
  explore.keyAxis.x = 0;
  explore.keyAxis.y = 0;
  explore.joyAxis.x = 0;
  explore.joyAxis.y = 0;
  explore.running = false;
  explore.jumpRequested = false;
}
