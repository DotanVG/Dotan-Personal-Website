import { Vector3 } from "three";

export const explore = {
  position: new Vector3(0, 0, 6),
  velocity: new Vector3(),
  facing: 0,
  axis: { x: 0, y: 0 },
  running: false,
  jumpRequested: false,
};

export function setExploreAxis(x: number, y: number) {
  explore.axis.x = x;
  explore.axis.y = y;
}

export function requestJump() {
  explore.jumpRequested = true;
}
