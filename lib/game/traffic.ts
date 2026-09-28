// Lane-graph traffic. AI cars follow the right-hand lane of the street grid,
// turn through intersections on Bézier curves, and are driven by the same
// vehicle model as the player through a pure-pursuit steering controller.

import { LANE_OFFSET, ROAD_HALF_WIDTH, type City, type LaneNode } from "./city";
import { clamp, type Rng } from "./math";

export const PATH_SPACING_M = 1.5;
export const CRUISE_MPS = 11;
export const TURN_MPS = 6;
export const AI_BRAKE_DECEL_MPS2 = 4.5;
export const FOLLOW_GAP_M = 3;
/** Distance ahead at which an AI car claims an intersection. */
export const LOCK_CLAIM_M = 16;
/** Stop this far before a held intersection. */
const STOP_LINE_M = 1;
/** Where lane paths start/end relative to an intersection centre. */
const BOX_M = ROAD_HALF_WIDTH + 1;

export type PathPoint = { x: number; z: number; node: number; turn: boolean };

export type Ai = {
  from: number;
  to: number;
  pts: PathPoint[];
  i: number;
  /** Intersection this car currently holds, or -1. */
  holding: number;
  holdUntil: number;
  /** Seconds blocked behind an obstacle (for overtaking / recycling). */
  blockedS: number;
  /** Lateral offset (m, positive = left) used to pass a stopped obstacle. */
  offset: number;
  offsetUntil: number;
  /** Intersection this car may not claim again until `banUntil` (after a lock timeout). */
  banNode: number;
  banUntil: number;
  stalled: boolean;
};

const dirBetween = (a: LaneNode, b: LaneNode) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  return { ux: dx / len, uz: dz / len, len };
};

/** Right-hand lane point at distance `t` along the street from a to b. */
function lanePoint(a: LaneNode, b: LaneNode, t: number) {
  const { ux, uz } = dirBetween(a, b);
  // right of heading (ux, uz) is (-uz, ux)
  return { x: a.x + ux * t - uz * LANE_OFFSET, z: a.z + uz * t + ux * LANE_OFFSET };
}

function pushStraight(pts: PathPoint[], a: LaneNode, b: LaneNode) {
  const { len } = dirBetween(a, b);
  const t0 = BOX_M;
  const t1 = len - BOX_M;
  const n = Math.max(1, Math.round((t1 - t0) / PATH_SPACING_M));
  for (let k = pts.length ? 1 : 0; k <= n; k++) {
    const p = lanePoint(a, b, t0 + ((t1 - t0) * k) / n);
    pts.push({ x: p.x, z: p.z, node: -1, turn: false });
  }
}

function pushTurn(pts: PathPoint[], a: LaneNode, via: LaneNode, c: LaneNode) {
  const p0 = lanePoint(a, via, dirBetween(a, via).len - BOX_M);
  const p2 = lanePoint(via, c, BOX_M);
  const d1 = dirBetween(a, via);
  const straight = Math.abs(d1.ux * dirBetween(via, c).ux + d1.uz * dirBetween(via, c).uz) > 0.9;
  // Control point: where the incoming and outgoing lane lines cross.
  const p1 = straight
    ? { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 }
    : Math.abs(d1.ux) > 0.5
      ? { x: p2.x, z: p0.z }
      : { x: p0.x, z: p2.z };
  const approxLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const n = Math.max(2, Math.round(approxLen / PATH_SPACING_M));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
      node: via.id,
      turn: !straight,
    });
  }
}

function chooseNext(city: City, from: number, via: number, rng: Rng): number {
  const opts = city.nodes[via].nbr.filter((n) => n >= 0 && n !== from);
  if (!opts.length) return from;
  // Mild bias toward going straight keeps flows readable.
  const a = city.nodes[from];
  const v = city.nodes[via];
  const straight = opts.find((n) => {
    const c = city.nodes[n];
    return Math.sign(c.x - v.x) === Math.sign(v.x - a.x) && Math.sign(c.z - v.z) === Math.sign(v.z - a.z);
  });
  if (straight !== undefined && rng.chance(0.5)) return straight;
  return rng.pick(opts);
}

/** Create a route that starts `t` metres along the lane from node `from` to `to`. */
export function createAi(city: City, from: number, to: number): Ai {
  const ai: Ai = {
    from,
    to,
    pts: [],
    i: 0,
    holding: -1,
    holdUntil: -1,
    blockedS: 0,
    offset: 0,
    offsetUntil: 0,
    stalled: false,
    banNode: -1,
    banUntil: 0,
  };
  pushStraight(ai.pts, city.nodes[from], city.nodes[to]);
  return ai;
}

/** Keep at least ~60 m of path ahead; trim consumed points. */
export function extendPath(ai: Ai, city: City, rng: Rng) {
  while (ai.pts.length - ai.i < 40) {
    const next = chooseNext(city, ai.from, ai.to, rng);
    pushTurn(ai.pts, city.nodes[ai.from], city.nodes[ai.to], city.nodes[next]);
    pushStraight(ai.pts, city.nodes[ai.to], city.nodes[next]);
    ai.from = ai.to;
    ai.to = next;
  }
  if (ai.i > 60) {
    const cut = ai.i - 10;
    ai.pts.splice(0, cut);
    ai.i -= cut;
    if (ai.holdUntil >= 0) ai.holdUntil -= cut;
  }
}

/** Advance the progress index to the nearest path point ahead. Returns distance to the path. */
export function trackProgress(ai: Ai, x: number, z: number): number {
  let best = ai.i;
  let bd = Infinity;
  const end = Math.min(ai.pts.length, ai.i + 12);
  for (let k = ai.i; k < end; k++) {
    const p = ai.pts[k];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  ai.i = best;
  return Math.sqrt(bd);
}

/** Steering input (-1..1, positive = right) toward a point `ahead` metres down the path. */
export function pursuitSteer(ai: Ai, x: number, z: number, yaw: number, ahead: number): number {
  const k = Math.min(ai.pts.length - 1, ai.i + Math.max(1, Math.round(ahead / PATH_SPACING_M)));
  const p = ai.pts[k];
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  let tx = p.x;
  let tz = p.z;
  if (ai.offset !== 0) {
    // left of the car = (c, -s)
    tx += c * ai.offset;
    tz -= s * ai.offset;
  }
  const dx = tx - x;
  const dz = tz - z;
  const fwd = dx * s + dz * c;
  const right = -dx * c + dz * s;
  const angle = Math.atan2(right, Math.max(0.1, fwd));
  return clamp(angle * 2.4, -1, 1);
}

/** Heading of the path at the current index. */
export function pathHeading(ai: Ai): number {
  const a = ai.pts[ai.i];
  const b = ai.pts[Math.min(ai.pts.length - 1, ai.i + 2)];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Speed that still stops within `dist` metres at the AI braking rate. */
export const stoppingSpeed = (dist: number) => Math.sqrt(Math.max(0, 2 * AI_BRAKE_DECEL_MPS2 * dist));

/** Cruise target from upcoming turns. */
export function turnSpeedAhead(ai: Ai): number {
  const n = Math.min(ai.pts.length, ai.i + Math.round(14 / PATH_SPACING_M));
  for (let k = ai.i; k < n; k++) {
    if (ai.pts[k].turn) {
      const d = (k - ai.i) * PATH_SPACING_M;
      return Math.max(TURN_MPS, Math.min(CRUISE_MPS, Math.sqrt(TURN_MPS * TURN_MPS + 2 * AI_BRAKE_DECEL_MPS2 * d)));
    }
  }
  return CRUISE_MPS;
}

/** First intersection ahead within `range` metres: node id and its distance. */
export function nextIntersection(ai: Ai, range: number): { node: number; dist: number; lastIdx: number } | null {
  const n = Math.min(ai.pts.length, ai.i + Math.round(range / PATH_SPACING_M));
  for (let k = ai.i; k < n; k++) {
    const node = ai.pts[k].node;
    if (node >= 0 && node !== ai.holding) {
      let last = k;
      while (last + 1 < ai.pts.length && ai.pts[last + 1].node === node) last++;
      return { node, dist: (k - ai.i) * PATH_SPACING_M, lastIdx: last };
    }
  }
  return null;
}

export const STOP_BEFORE_M = STOP_LINE_M;

/** All directed legs sampled every `step` metres: spawn and recovery candidates. */
export function laneSamples(city: City, step = 8): { x: number; z: number; yaw: number; from: number; to: number }[] {
  const out: { x: number; z: number; yaw: number; from: number; to: number }[] = [];
  for (const a of city.nodes) {
    for (const bId of a.nbr) {
      if (bId < 0) continue;
      const b = city.nodes[bId];
      const { ux, uz, len } = dirBetween(a, b);
      for (let t = BOX_M + 4; t < len - BOX_M - 4; t += step) {
        const p = lanePoint(a, b, t);
        out.push({ x: p.x, z: p.z, yaw: Math.atan2(ux, uz), from: a.id, to: b.id });
      }
    }
  }
  return out;
}

/** Start an AI route at a lane sample: builds the leg and skips to the nearest point. */
export function aiFromSample(city: City, s: { x: number; z: number; from: number; to: number }, rng: Rng): Ai {
  const ai = createAi(city, s.from, s.to);
  extendPath(ai, city, rng);
  trackProgressFull(ai, s.x, s.z);
  return ai;
}

function trackProgressFull(ai: Ai, x: number, z: number) {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < ai.pts.length; k++) {
    const d = (ai.pts[k].x - x) ** 2 + (ai.pts[k].z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  ai.i = best;
}
