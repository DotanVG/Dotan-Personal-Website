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
): number | null {
  if (Math.hypot(dx, dy) < 48) return null;
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  if (
    previous !== null &&
    Math.abs(((angle - previous * 22.5 + 540) % 360) - 180) < 15
  )
    return previous;
  return Math.round(angle / 22.5) % 16;
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
    now - previous.lastHop >= 1800;
  return {
    y,
    at: now,
    distance: eligible ? distance : 0,
    hopped: hop || (!fresh && previous.hopped),
    lastHop: hop ? now : previous.lastHop,
    hop,
  };
}
