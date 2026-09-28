// Small numeric helpers shared by the simulation. Pure, allocation-free.
//
// Conventions used across lib/game:
// - 1 world unit = 1 metre, time in seconds.
// - Ground plane is X/Z, Y is up.
// - Heading `yaw` matches three.js `rotation.y`: forward = (sin yaw, cos yaw),
//   left = (cos yaw, -sin yaw). Increasing yaw turns left.

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Move `v` toward `target` by at most `maxDelta`. */
export function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return Math.min(v + maxDelta, target);
  return Math.max(v - maxDelta, target);
}

/** Frame-rate independent exponential smoothing. */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}

export const isFiniteNumber = (v: number) => Number.isFinite(v);

/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hiInclusive: number) => lo + Math.floor(next() * (hiInclusive - lo + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof createRng>;
