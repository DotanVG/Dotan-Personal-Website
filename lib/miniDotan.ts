export type PetState =
  | "idle"
  | "greeting"
  | "hopping"
  | "speaking"
  | "contact-open"
  | "submitting"
  | "success"
  | "error"
  | "hidden";

export const cycles = {
  left: { row: 2, times: [120, 120, 120, 120, 120, 120, 120, 220] },
  right: { row: 1, times: [120, 120, 120, 120, 120, 120, 120, 220] },
  idle: { row: 0, times: [280, 110, 110, 140, 140, 320] },
  greeting: { row: 3, times: [140, 140, 140, 280] },
  hopping: { row: 4, times: [140, 140, 140, 140, 280] },
  submitting: { row: 7, times: [120, 120, 120, 120, 120, 220] },
  success: { row: 3, times: [140, 140, 140, 280] },
  error: { row: 5, times: [140, 140, 140, 140, 140, 140, 140, 240] },
} as const;

export function clampPetDrag(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number,
) {
  const left = Math.max(margin, Math.min(x, viewportWidth - width - margin));
  const top = Math.max(72, Math.min(y, viewportHeight - height - margin));
  return {
    left,
    top,
    side:
      left + width / 2 < viewportWidth / 2
        ? ("left" as const)
        : ("right" as const),
  };
}

export function lookPose(
  dx: number,
  dy: number,
  previous: number | null,
  hysteresis = 15,
): number | null {
  if (Math.hypot(dx, dy) < 48) return null;
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  if (
    previous !== null &&
    Math.abs(((angle - previous * 22.5 + 540) % 360) - 180) < hysteresis
  )
    return previous;
  return Math.round(angle / 22.5) % 16;
}

/** Walk while dragged: frames follow the finger's distance, so his feet don't slide. */
export type Walk = {
  dir: 1 | -1; // 1 = right
  x: number; // horizontal travel since the walk began, px
  far: number; // furthest x reached in the current direction
  turned: number; // time of the last turn, ms
  travel: number; // px since the last frame
  col: number;
  at: number; // time of the last frame, ms
  mx: number; // |dx| and |dy| over roughly the last 32 px of path
  my: number;
  carried: boolean; // mostly vertical drag: dangle instead of walking
};

export const startWalk = (dir: 1 | -1): Walk => ({
  dir,
  x: 0,
  far: 0,
  turned: -Infinity,
  travel: 0,
  col: 0,
  at: -Infinity,
  mx: 0,
  my: 0,
  carried: false,
});

export function walkStep(w: Walk, dx: number, dy: number, now: number): Walk {
  const x = w.x + dx;
  let { dir, far, turned, travel, col, at, mx, my } = w;
  far = dir > 0 ? Math.max(far, x) : Math.min(far, x);
  // Turn only after 16 px back from the furthest point, not on finger jitter.
  if ((far - x) * dir >= 16 && now - turned >= 120) {
    dir = dir > 0 ? -1 : 1;
    far = x;
    turned = now;
  }
  mx += Math.abs(dx);
  my += Math.abs(dy);
  const path = mx + my;
  if (path > 32) {
    mx *= 32 / path;
    my *= 32 / path;
  }
  const carried = w.carried ? mx <= my : path >= 32 && my > 2 * mx;
  travel += Math.abs(dx);
  // One frame per 12 px, at most one per 60 ms; distance beyond that is dropped.
  if (!carried && travel >= 12 && now - at >= 60) {
    col = (col + 1) % cycles.right.times.length;
    travel = 0;
    at = now;
  }
  return { dir, x, far, turned, travel, col, at, mx, my, carried };
}

/** [row, col] for a walk; `still` holds one frame facing the way (quiet + reduced motion). */
export function walkFrame(w: Walk, still = false): [number, number] {
  const row = w.dir > 0 ? cycles.right.row : cycles.left.row;
  if (still) return [row, 0];
  return w.carried ? [cycles.hopping.row, 1] : [row, w.col];
}

export function scrollGesture(
  previous: {
    y: number;
    at: number;
    distance: number;
    hopped: boolean;
    lastHop: number;
  },
  y: number,
  now: number,
  eligible: boolean,
) {
  const fresh = now - previous.at > 220;
  const delta = y - previous.y;
  const distance = fresh
    ? delta
    : previous.distance + (Math.abs(delta) > 2 ? delta : 0);
  const hop =
    eligible &&
    !(fresh ? false : previous.hopped) &&
    Math.abs(distance) >= 100 &&
    now - previous.lastHop >= 6000;
  return {
    y,
    at: now,
    distance: eligible ? distance : 0,
    hopped: hop || (!fresh && previous.hopped),
    lastHop: hop ? now : previous.lastHop,
    hop,
  };
}
