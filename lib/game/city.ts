// Authored coastal city: an intentional street grid, neighbourhood blocks,
// landmark lots, terrain (curbs, beach, pier, ramps) and static colliders.
// Road topology and landmark lots are fixed; decorative buildings, trees and
// parked-car colours use a seeded RNG so the city is stable between visits.

import { StaticGrid, type StaticCollider } from "./collide";
import { createRng, type Rng } from "./math";

// ---- Layout constants (metres) ----
export const STREET_X = [-120, -72, -24, 24, 72, 120] as const;
export const STREET_Z = [-84, -28, 28, 84] as const;
export const ROAD_HALF_WIDTH = 6;
export const LANE_OFFSET = 1.75;
export const PARKING_OFFSET = 4.55;
export const SIDEWALK_WIDTH = 3;
export const CURB_HEIGHT = 0.14;
export const BLOCK_CORNER_RADIUS = 4.5;
export const PROMENADE_EDGE_Z = 97;
export const BEACH_SLOPE = 0.042; // metres of drop per metre toward the sea
export const WATER_LEVEL = -0.36;
export const SEA_FLOOR = -2.6;
export const WALL_NORTH_Z = -94;
export const WALL_EAST_X = 131;
export const WORLD_BOUNDS = { minX: -150, maxX: 150, minZ: -110, maxZ: 190 };

export type Surface = "road" | "paving" | "grass" | "sand" | "wood" | "water";

export const SURFACE_GRIP: Record<Surface, number> = {
  road: 1,
  paving: 0.95,
  wood: 0.9,
  grass: 0.72,
  sand: 0.58,
  water: 0.2,
};
/** Extra rolling resistance multiplier per surface. */
export const SURFACE_DRAG: Record<Surface, number> = {
  road: 1,
  paving: 1.1,
  wood: 1.1,
  grass: 2.2,
  sand: 3.4,
  water: 8,
};

export type BlockKind =
  | "residential"
  | "apartments"
  | "park"
  | "plaza"
  | "market"
  | "downtown"
  | "harbor"
  | "parking"
  | "stunt"
  | "landmark";

export type Block = {
  col: number;
  row: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  kind: BlockKind;
  /** Inner lot (block minus sidewalk). */
  lot: { x0: number; z0: number; x1: number; z1: number };
  landmark?: string;
};

export type RoofKind = "flat" | "parapet" | "gable" | "sawtooth" | "none";
export type WindowKind = "grid" | "band" | "shop" | "house" | "none";

export type Building = {
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
  body: string;
  trim: string;
  roof: RoofKind;
  roofColor: string;
  windows: WindowKind;
  /** Street-facing side: 0=+z, 1=+x, 2=-z, 3=-x. Awnings and doors go here. */
  face: number;
  awning?: string;
  floors: number;
};

export type Landmark = {
  slug: string;
  style: "tower" | "civic" | "studio" | "depot" | "academy" | "glass" | "brick" | "lighthouse";
  /** Building centre and footprint. */
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
  face: number;
  /** Visible interaction pad on the sidewalk, in front of the entrance. */
  pad: { x: number; z: number; r: number };
  name: string;
};

export type Tree = { x: number; z: number; s: number; kind: "round" | "cone" | "palm"; tint: number };
export type Prop = {
  kind: "lamp" | "bench" | "planter" | "bollard" | "kiosk" | "fountain" | "railing" | "wall" | "rock" | "umbrella";
  x: number;
  z: number;
  yaw: number;
  sx: number;
  sz: number;
  h: number;
};
export type Ramp = {
  x: number;
  z: number;
  yaw: number;
  halfLen: number;
  halfWid: number;
  /** Height at the low end and high end. */
  h0: number;
  h1: number;
};
export type ParkingSpot = { x: number; z: number; yaw: number; id: number; lot?: boolean };

export type LaneNode = { id: number; x: number; z: number; nbr: [number, number, number, number] };

export type City = {
  seed: number;
  blocks: Block[];
  buildings: Building[];
  landmarks: Landmark[];
  trees: Tree[];
  props: Prop[];
  ramps: Ramp[];
  parking: ParkingSpot[];
  nodes: LaneNode[];
  colliders: StaticCollider[];
  grid: StaticGrid;
  spawn: { x: number; z: number; yaw: number; carSpot: ParkingSpot };
  pier: { x0: number; x1: number; z0: number; z1: number; head: { x0: number; x1: number; z0: number; z1: number } };
  beachGaps: [number, number][];
};

export const PALETTE = {
  cream: "#f3e6cb",
  sand: "#e9cfa0",
  stone: "#ddd3c0",
  terracotta: "#cf6f4c",
  coral: "#e8866a",
  blush: "#efb59c",
  sage: "#9fbb97",
  teal: "#4f9a98",
  deepTeal: "#2f6f73",
  mustard: "#e3b04b",
  white: "#f7f2e8",
  brick: "#b4553a",
  dusk: "#6f8fa8",
  roof: "#bd5a3a",
  roofDark: "#8f4631",
  slate: "#5b6470",
  glass: "#3d6477",
};

/** Landmark lots are intentional: each slug maps to one block and entrance. */
const LANDMARK_LOTS: Record<string, { col: number; row: number } | "pier"> = {
  zota: { col: 3, row: 1 },
  ness: { col: 1, row: 1 },
  kanomi: { col: 3, row: 0 },
  electra: { col: 0, row: 2 },
  nitzanim: { col: 3, row: 2 },
  hackeru: { col: 4, row: 1 },
  ort: { col: 1, row: 0 },
  naval: "pier",
};

export const LANDMARK_SLUGS = Object.keys(LANDMARK_LOTS);

const BLOCK_KINDS: BlockKind[][] = [
  // row 0 (north, under the hills)
  ["residential", "landmark", "park", "landmark", "apartments"],
  // row 1 (downtown, plaza in the middle)
  ["market", "landmark", "plaza", "landmark", "landmark"],
  // row 2 (harbour side)
  ["landmark", "harbor", "parking", "landmark", "stunt"],
];

// Pier geometry (metres).
/** The hero car's kerbside spot beside the spawn point; kept clear of lamps. */
const SPAWN_CAR_SPOT = { x: 3.6, z: 28 - PARKING_OFFSET };

const PIER = { x0: 36, x1: 44, z0: PROMENADE_EDGE_Z - 1, z1: 134 };
const PIER_HEAD = { x0: 27, x1: 53, z0: 133, z1: 153 };
const BEACH_GAPS: [number, number][] = [
  [-62, -50],
  [84, 96],
];

const RAMPS: Ramp[] = [
  // Stunt yard (block col 4, row 2): kicker, gap, landing.
  { x: 96, z: 64, yaw: Math.PI, halfLen: 5, halfWid: 3.2, h0: CURB_HEIGHT, h1: 1.5 },
  { x: 96, z: 44.5, yaw: Math.PI, halfLen: 5.5, halfWid: 3.6, h0: 1.3, h1: CURB_HEIGHT },
  // A shallow side kicker along the yard's west edge.
  { x: 84, z: 56, yaw: -Math.PI / 2, halfLen: 3.5, halfWid: 2.2, h0: CURB_HEIGHT, h1: 0.8 },
];

// ---- Terrain queries ----

export type GroundSample = { h: number; gx: number; gz: number; surface: Surface };

function inStreetRect(x: number, z: number): boolean {
  const minX = STREET_X[0] - ROAD_HALF_WIDTH;
  const maxX = STREET_X[STREET_X.length - 1] + ROAD_HALF_WIDTH;
  const minZ = STREET_Z[0] - ROAD_HALF_WIDTH;
  const maxZ = STREET_Z[STREET_Z.length - 1] + ROAD_HALF_WIDTH;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
  for (const sx of STREET_X) if (Math.abs(x - sx) <= ROAD_HALF_WIDTH) return true;
  for (const sz of STREET_Z) if (Math.abs(z - sz) <= ROAD_HALF_WIDTH) return true;
  return false;
}

function nearestIndex(arr: readonly number[], v: number): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - v) < Math.abs(arr[best] - v)) best = i;
  return best;
}

/** True when (x, z) is asphalt: street rectangles plus rounded block-corner fillets. */
export function isRoad(x: number, z: number): boolean {
  if (inStreetRect(x, z)) return true;
  const i = nearestIndex(STREET_X, x);
  const j = nearestIndex(STREET_Z, z);
  const nx = STREET_X[i];
  const nz = STREET_Z[j];
  const dx = x - nx;
  const dz = z - nz;
  const sx = dx >= 0 ? 1 : -1;
  const sz = dz >= 0 ? 1 : -1;
  // Fillet only where two streets bound the quadrant.
  const hasX = sx > 0 ? i < STREET_X.length - 1 : i > 0;
  const hasZ = sz > 0 ? j < STREET_Z.length - 1 : j > 0;
  if (!hasX || !hasZ) return false;
  const r = BLOCK_CORNER_RADIUS;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  const edge = ROAD_HALF_WIDTH;
  if (ax < edge || az < edge || ax > edge + r || az > edge + r) return false;
  return Math.hypot(ax - (edge + r), az - (edge + r)) > r;
}

function rampSample(r: Ramp, x: number, z: number, out: GroundSample): boolean {
  const c = Math.cos(r.yaw);
  const s = Math.sin(r.yaw);
  const dx = x - r.x;
  const dz = z - r.z;
  // local forward (u) = (sin, cos), local side (w) = (cos, -sin)
  const u = dx * s + dz * c;
  const w = dx * c - dz * s;
  if (Math.abs(u) > r.halfLen || Math.abs(w) > r.halfWid) return false;
  const t = (u + r.halfLen) / (2 * r.halfLen);
  const h = r.h0 + (r.h1 - r.h0) * t;
  if (h <= out.h) return false;
  const slope = (r.h1 - r.h0) / (2 * r.halfLen);
  out.h = h;
  out.gx = slope * s;
  out.gz = slope * c;
  out.surface = "road";
  return true;
}

const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) =>
  x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * Ground height, smooth gradient (steps such as curbs have zero gradient) and
 * surface at a point. Writes into `out` to stay allocation-free.
 */
export function sampleGround(city: City, x: number, z: number, out: GroundSample): GroundSample {
  out.gx = 0;
  out.gz = 0;
  if (z > PROMENADE_EDGE_Z) {
    if (inRect(x, z, PIER) || inRect(x, z, PIER_HEAD)) {
      out.h = CURB_HEIGHT;
      out.surface = "wood";
      return out;
    }
    const d = z - PROMENADE_EDGE_Z;
    const h = Math.max(SEA_FLOOR, CURB_HEIGHT - d * BEACH_SLOPE);
    out.h = h;
    out.gz = h > SEA_FLOOR ? -BEACH_SLOPE : 0;
    out.surface = h < WATER_LEVEL ? "water" : "sand";
    return out;
  }
  if (isRoad(x, z)) {
    out.h = 0;
    out.surface = "road";
  } else {
    out.h = CURB_HEIGHT;
    out.surface = surfaceOfLand(city, x, z);
  }
  for (const r of city.ramps) rampSample(r, x, z, out);
  return out;
}

function surfaceOfLand(city: City, x: number, z: number): Surface {
  const b = blockAt(city, x, z);
  if (!b) return "paving";
  if (inRect(x, z, b.lot)) {
    if (b.kind === "park" || b.kind === "residential") return "grass";
    if (b.kind === "parking" || b.kind === "stunt") return "road";
  }
  return "paving";
}

export function blockAt(city: City, x: number, z: number): Block | null {
  for (const b of city.blocks) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b;
  return null;
}

export function inWorldBounds(x: number, z: number): boolean {
  const b = WORLD_BOUNDS;
  return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
}

// ---- Construction ----

export function createCity(seed = 1): City {
  const rng = createRng(seed);
  const city: City = {
    seed,
    blocks: [],
    buildings: [],
    landmarks: [],
    trees: [],
    props: [],
    ramps: RAMPS,
    parking: [],
    nodes: [],
    colliders: [],
    grid: new StaticGrid([]),
    spawn: null as unknown as City["spawn"],
    pier: { ...PIER, head: PIER_HEAD },
    beachGaps: BEACH_GAPS,
  };

  buildNodes(city);
  buildBlocks(city);
  for (const b of city.blocks) populateBlock(city, b, rng);
  buildPier(city);
  buildStreetFurniture(city, rng);
  buildBoundaries(city, rng);
  buildParking(city);

  // Spawn: south sidewalk of the plaza, a coupe waiting at the kerb ahead.
  const carSpot = nearestSpot(city.parking, SPAWN_CAR_SPOT.x, SPAWN_CAR_SPOT.z);
  city.spawn = { x: -3.5, z: 20.4, yaw: Math.PI / 2, carSpot };

  city.colliders = collectColliders(city);
  city.grid = new StaticGrid(city.colliders, 12);
  return city;
}

function buildNodes(city: City) {
  const nx = STREET_X.length;
  STREET_Z.forEach((z, j) =>
    STREET_X.forEach((x, i) => {
      const id = j * nx + i;
      // neighbours: 0 = +x (east), 1 = +z (south), 2 = -x (west), 3 = -z (north)
      city.nodes.push({
        id,
        x,
        z,
        nbr: [
          i < nx - 1 ? id + 1 : -1,
          j < STREET_Z.length - 1 ? id + nx : -1,
          i > 0 ? id - 1 : -1,
          j > 0 ? id - nx : -1,
        ],
      });
    }),
  );
}

function buildBlocks(city: City) {
  for (let row = 0; row < STREET_Z.length - 1; row++) {
    for (let col = 0; col < STREET_X.length - 1; col++) {
      const x0 = STREET_X[col] + ROAD_HALF_WIDTH;
      const x1 = STREET_X[col + 1] - ROAD_HALF_WIDTH;
      const z0 = STREET_Z[row] + ROAD_HALF_WIDTH;
      const z1 = STREET_Z[row + 1] - ROAD_HALF_WIDTH;
      const kind = BLOCK_KINDS[row][col];
      const landmark = Object.entries(LANDMARK_LOTS).find(
        ([, v]) => v !== "pier" && v.col === col && v.row === row,
      )?.[0];
      city.blocks.push({
        col,
        row,
        x0,
        z0,
        x1,
        z1,
        kind,
        landmark,
        lot: {
          x0: x0 + SIDEWALK_WIDTH,
          z0: z0 + SIDEWALK_WIDTH,
          x1: x1 - SIDEWALK_WIDTH,
          z1: z1 - SIDEWALK_WIDTH,
        },
      });
    }
  }
}

const RESIDENTIAL_BODIES = [PALETTE.cream, PALETTE.white, PALETTE.blush, PALETTE.sand, PALETTE.sage];
const DOWNTOWN_BODIES = [PALETTE.cream, PALETTE.terracotta, PALETTE.coral, PALETTE.white, PALETTE.sand, PALETTE.teal];
const HARBOR_BODIES = [PALETTE.sage, PALETTE.teal, PALETTE.cream, PALETTE.dusk, PALETTE.sand];
const AWNINGS = [PALETTE.terracotta, PALETTE.teal, PALETTE.mustard, PALETTE.coral, PALETTE.sage];

function addBuilding(city: City, b: Building) {
  city.buildings.push(b);
}

/** Fill a lot edge with a row of buildings facing the street on side `face`. */
function frontage(
  city: City,
  rng: Rng,
  lot: Block["lot"],
  face: number,
  opts: {
    depth: [number, number];
    width: [number, number];
    floors: [number, number];
    floorH: number;
    bodies: string[];
    roof: RoofKind[];
    windows: WindowKind;
    awnings?: boolean;
    gap?: [number, number];
    skip?: (cx: number, cz: number) => boolean;
    setback?: number;
  },
) {
  const alongX = face === 0 || face === 2;
  const start = alongX ? lot.x0 : lot.z0;
  const end = alongX ? lot.x1 : lot.z1;
  let cursor = start;
  while (cursor < end - 4) {
    let w = rng.range(opts.width[0], opts.width[1]);
    if (end - (cursor + w) < 5) w = end - cursor;
    const d = rng.range(opts.depth[0], opts.depth[1]);
    const floors = rng.int(opts.floors[0], opts.floors[1]);
    const h = floors * opts.floorH + (opts.roof.includes("gable") ? 0 : 0.6);
    const setback = opts.setback ?? 0;
    let cx: number;
    let cz: number;
    let hx: number;
    let hz: number;
    if (alongX) {
      cx = cursor + w / 2;
      hx = w / 2 - 0.05;
      hz = d / 2;
      cz = face === 0 ? lot.z1 - setback - d / 2 : lot.z0 + setback + d / 2;
    } else {
      cz = cursor + w / 2;
      hz = w / 2 - 0.05;
      hx = d / 2;
      cx = face === 1 ? lot.x1 - setback - d / 2 : lot.x0 + setback + d / 2;
    }
    if (!opts.skip?.(cx, cz)) {
      addBuilding(city, {
        x: cx,
        z: cz,
        hx,
        hz,
        h,
        body: rng.pick(opts.bodies),
        trim: rng.chance(0.5) ? PALETTE.white : PALETTE.cream,
        roof: rng.pick(opts.roof),
        roofColor: rng.chance(0.75) ? PALETTE.roof : PALETTE.roofDark,
        windows: opts.windows,
        face,
        awning: opts.awnings && rng.chance(0.7) ? rng.pick(AWNINGS) : undefined,
        floors,
      });
    }
    cursor += w + (opts.gap ? rng.range(opts.gap[0], opts.gap[1]) : 0);
  }
}

function populateBlock(city: City, b: Block, rng: Rng) {
  const { lot } = b;
  const cx = (lot.x0 + lot.x1) / 2;
  const cz = (lot.z0 + lot.z1) / 2;
  switch (b.kind) {
    case "residential": {
      const o = {
        depth: [7, 9] as [number, number],
        width: [7, 9.5] as [number, number],
        floors: [1, 2] as [number, number],
        floorH: 3.1,
        bodies: RESIDENTIAL_BODIES,
        roof: ["gable"] as RoofKind[],
        windows: "house" as WindowKind,
        gap: [2.5, 4.5] as [number, number],
        setback: 2,
      };
      frontage(city, rng, lot, 0, o);
      frontage(city, rng, lot, 2, o);
      scatterTrees(city, rng, { x0: lot.x0 + 3, x1: lot.x1 - 3, z0: cz - 8, z1: cz + 8 }, 7, ["round", "cone"]);
      break;
    }
    case "apartments": {
      const o = {
        depth: [10, 13] as [number, number],
        width: [9, 13] as [number, number],
        floors: [3, 5] as [number, number],
        floorH: 3.2,
        bodies: [PALETTE.cream, PALETTE.blush, PALETTE.white, PALETTE.sand],
        roof: ["parapet", "flat"] as RoofKind[],
        windows: "grid" as WindowKind,
        gap: [0, 1.5] as [number, number],
      };
      frontage(city, rng, lot, 0, o);
      frontage(city, rng, lot, 2, o);
      scatterTrees(city, rng, { x0: lot.x0 + 3, x1: lot.x1 - 3, z0: cz - 4, z1: cz + 4 }, 4, ["round"]);
      break;
    }
    case "market":
    case "downtown": {
      const o = {
        depth: [11, 15] as [number, number],
        width: [8, 12] as [number, number],
        floors: b.kind === "market" ? ([2, 4] as [number, number]) : ([4, 7] as [number, number]),
        floorH: 3.3,
        bodies: DOWNTOWN_BODIES,
        roof: ["parapet", "flat"] as RoofKind[],
        windows: "shop" as WindowKind,
        awnings: true,
      };
      frontage(city, rng, lot, 0, o);
      frontage(city, rng, lot, 2, o);
      break;
    }
    case "harbor": {
      const o = {
        depth: [14, 16] as [number, number],
        width: [12, 16] as [number, number],
        floors: [2, 2] as [number, number],
        floorH: 3.6,
        bodies: HARBOR_BODIES,
        roof: ["sawtooth", "gable"] as RoofKind[],
        windows: "band" as WindowKind,
        gap: [1, 3] as [number, number],
      };
      frontage(city, rng, lot, 0, o);
      frontage(city, rng, lot, 2, o);
      break;
    }
    case "park": {
      scatterTrees(city, rng, lot, 22, ["round", "round", "cone"]);
      city.props.push({ kind: "kiosk", x: cx, z: cz, yaw: 0, sx: 2.2, sz: 2.2, h: 3 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        city.props.push({ kind: "bench", x: cx + Math.cos(a) * 6, z: cz + Math.sin(a) * 6, yaw: -a, sx: 0.9, sz: 0.35, h: 0.6 });
      }
      break;
    }
    case "plaza": {
      city.props.push({ kind: "fountain", x: cx, z: cz, yaw: 0, sx: 4.2, sz: 4.2, h: 1.1 });
      // Planters with trees in a ring around the fountain.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = cx + Math.cos(a) * 12;
        const pz = cz + Math.sin(a) * 12;
        city.props.push({ kind: "planter", x: px, z: pz, yaw: 0, sx: 1.3, sz: 1.3, h: 0.55 });
        city.trees.push({ x: px, z: pz, s: 0.82, kind: "round", tint: rng.next() });
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        city.props.push({ kind: "bench", x: cx + Math.cos(a) * 7, z: cz + Math.sin(a) * 7, yaw: -a + Math.PI / 2, sx: 1, sz: 0.35, h: 0.6 });
      }
      city.props.push({ kind: "kiosk", x: lot.x0 + 3, z: lot.z0 + 3, yaw: 0, sx: 1.6, sz: 1.6, h: 2.6 });
      city.props.push({ kind: "umbrella", x: lot.x1 - 4, z: lot.z0 + 4, yaw: 0, sx: 1.6, sz: 1.6, h: 2.4 });
      city.props.push({ kind: "umbrella", x: lot.x1 - 4, z: lot.z1 - 4, yaw: 0, sx: 1.6, sz: 1.6, h: 2.4 });
      break;
    }
    case "parking": {
      // Open lot; bays are generated with the street parking.
      city.trees.push({ x: lot.x0 + 1.5, z: cz, s: 0.9, kind: "round", tint: rng.next() });
      city.trees.push({ x: lot.x1 - 1.5, z: cz, s: 0.9, kind: "round", tint: rng.next() });
      city.props.push({ kind: "kiosk", x: cx, z: lot.z0 + 2.5, yaw: 0, sx: 1.5, sz: 1.5, h: 2.5 });
      break;
    }
    case "stunt": {
      // Low tyre-wall barriers frame the yard without closing it off.
      city.props.push({ kind: "wall", x: lot.x1 - 0.5, z: cz, yaw: 0, sx: 0.4, sz: (lot.z1 - lot.z0) / 2 - 6, h: 0.8 });
      city.trees.push({ x: lot.x0 + 2, z: lot.z0 + 2, s: 0.9, kind: "palm", tint: rng.next() });
      city.trees.push({ x: lot.x0 + 2, z: lot.z1 - 2, s: 0.9, kind: "palm", tint: rng.next() });
      break;
    }
    case "landmark":
      populateLandmarkBlock(city, b, rng);
      break;
  }
}

function populateLandmarkBlock(city: City, b: Block, rng: Rng) {
  const slug = b.landmark!;
  const { lot } = b;
  const midX = (lot.x0 + lot.x1) / 2;
  const midZ = (lot.z0 + lot.z1) / 2;
  const sw = SIDEWALK_WIDTH;
  const plain = (face: number, floors: [number, number], skip?: (x: number, z: number) => boolean) =>
    frontage(city, rng, lot, face, {
      depth: [9, 11],
      width: [8, 11],
      floors,
      floorH: 3.3,
      bodies: DOWNTOWN_BODIES,
      roof: ["parapet", "flat"],
      windows: "grid",
      skip,
    });
  let lm: Landmark;
  switch (slug) {
    case "zota": {
      // Fintech tower facing the plaza (west side of the block).
      lm = { slug, style: "tower", name: "Zota", x: lot.x0 + 9, z: midZ, hx: 7, hz: 7, h: 34, face: 3, pad: { x: b.x0 + sw / 2 + 0.2, z: midZ, r: 1.6 } };
      plain(1, [4, 6]);
      break;
    }
    case "ness": {
      lm = { slug, style: "civic", name: "Ness", x: lot.x1 - 9.5, z: midZ, hx: 9.5, hz: 12, h: 13, face: 1, pad: { x: b.x1 - sw / 2 - 0.2, z: midZ, r: 1.6 } };
      plain(3, [3, 5]);
      break;
    }
    case "kanomi": {
      lm = { slug, style: "studio", name: "Kanomi", x: midX, z: lot.z1 - 8.5, hx: 10, hz: 8.5, h: 11, face: 0, pad: { x: midX, z: b.z1 - sw / 2 - 0.2, r: 1.6 } };
      frontage(city, rng, lot, 2, {
        depth: [8, 9],
        width: [7, 9],
        floors: [1, 2],
        floorH: 3.1,
        bodies: RESIDENTIAL_BODIES,
        roof: ["gable"],
        windows: "house",
        gap: [2, 4],
        setback: 2,
      });
      break;
    }
    case "electra": {
      lm = { slug, style: "depot", name: "Electra", x: midX, z: lot.z0 + 9.5, hx: 12, hz: 9.5, h: 7.5, face: 2, pad: { x: midX + 3.25, z: b.z0 + sw / 2 + 0.2, r: 1.6 } }; // between two roll-up doors
      frontage(city, rng, lot, 0, {
        depth: [12, 14],
        width: [12, 16],
        floors: [2, 2],
        floorH: 3.6,
        bodies: HARBOR_BODIES,
        roof: ["sawtooth"],
        windows: "band",
        gap: [1, 2],
      });
      break;
    }
    case "nitzanim": {
      lm = { slug, style: "academy", name: "Nitzanim", x: midX, z: lot.z0 + 9.5, hx: 13, hz: 9.5, h: 10, face: 2, pad: { x: midX, z: b.z0 + sw / 2 + 0.2, r: 1.6 } };
      scatterTrees(city, rng, { x0: lot.x0 + 2, x1: lot.x1 - 2, z0: lot.z1 - 12, z1: lot.z1 - 2 }, 6, ["round"]);
      break;
    }
    case "hackeru": {
      lm = { slug, style: "glass", name: "HackerU", x: lot.x0 + 9, z: midZ, hx: 9, hz: 10, h: 12, face: 3, pad: { x: b.x0 + sw / 2 + 0.2, z: midZ, r: 1.6 } };
      plain(1, [3, 5]);
      break;
    }
    case "ort": {
      lm = { slug, style: "brick", name: "ORT", x: midX, z: lot.z1 - 9.5, hx: 12, hz: 9.5, h: 11, face: 0, pad: { x: midX, z: b.z1 - sw / 2 - 0.2, r: 1.6 } };
      scatterTrees(city, rng, { x0: lot.x0 + 2, x1: lot.x1 - 2, z0: lot.z0 + 2, z1: lot.z0 + 12 }, 6, ["round", "cone"]);
      break;
    }
    default:
      throw new Error(`No landmark design for ${slug}`);
  }
  city.landmarks.push(lm);
}

function buildPier(city: City) {
  const head = PIER_HEAD;
  const lx = (head.x0 + head.x1) / 2 + 2;
  city.landmarks.push({
    slug: "naval",
    style: "lighthouse",
    name: "Naval Officers School",
    x: lx,
    z: head.z1 - 7,
    hx: 3.2,
    hz: 3.2,
    h: 17,
    face: 2,
    pad: { x: lx, z: head.z1 - 13.5, r: 1.6 },
  });
  // Railings along both sides of the pier and around the head.
  const rail = (x: number, z: number, sx: number, sz: number) =>
    city.props.push({ kind: "railing", x, z, yaw: 0, sx, sz, h: 1.0 });
  const pierLen = head.z0 - (PIER.z0 + 4);
  const pierMid = (PIER.z0 + 4 + head.z0) / 2;
  rail(PIER.x0 + 0.1, pierMid, 0.1, pierLen / 2);
  rail(PIER.x1 - 0.1, pierMid, 0.1, pierLen / 2);
  rail(head.x0 + 0.1, (head.z0 + head.z1) / 2, 0.1, (head.z1 - head.z0) / 2);
  rail(head.x1 - 0.1, (head.z0 + head.z1) / 2, 0.1, (head.z1 - head.z0) / 2);
  rail((head.x0 + head.x1) / 2, head.z1 - 0.1, (head.x1 - head.x0) / 2, 0.1);
  rail((head.x0 + PIER.x0) / 2, head.z0 + 0.1, (PIER.x0 - head.x0) / 2, 0.1);
  rail((head.x1 + PIER.x1) / 2, head.z0 + 0.1, (head.x1 - PIER.x1) / 2, 0.1);
  // Academy hall on the pier head, beside the lighthouse.
  city.buildings.push({
    x: head.x0 + 5,
    z: head.z1 - 7.5,
    hx: 4,
    hz: 4,
    h: 5.2,
    body: PALETTE.white,
    trim: PALETTE.deepTeal,
    roof: "gable",
    roofColor: PALETTE.deepTeal,
    windows: "house",
    face: 1,
    floors: 1,
  });
}

function scatterTrees(
  city: City,
  rng: Rng,
  area: { x0: number; x1: number; z0: number; z1: number },
  count: number,
  kinds: Tree["kind"][],
) {
  let placed = 0;
  for (let attempt = 0; attempt < count * 8 && placed < count; attempt++) {
    const x = rng.range(area.x0, area.x1);
    const z = rng.range(area.z0, area.z1);
    const s = rng.range(0.8, 1.25);
    const clash =
      city.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2) ||
      city.buildings.some((b) => Math.abs(b.x - x) < b.hx + 2 && Math.abs(b.z - z) < b.hz + 2);
    if (clash) continue;
    city.trees.push({ x, z, s, kind: rng.pick(kinds), tint: rng.next() });
    placed++;
  }
}

/** Street lamps along every sidewalk, trees on residential and waterfront streets. */
function buildStreetFurniture(city: City, rng: Rng) {
  const lampOffset = ROAD_HALF_WIDTH + 0.7;
  const clearOfPads = (x: number, z: number) =>
    city.landmarks.every((l) => Math.hypot(l.pad.x - x, l.pad.z - z) > 3.5) &&
    Math.hypot(SPAWN_CAR_SPOT.x - x, SPAWN_CAR_SPOT.z - z) > 7;
  const addLamp = (x: number, z: number, yaw: number) => {
    if (!clearOfPads(x, z)) return;
    city.props.push({ kind: "lamp", x, z, yaw, sx: 0.16, sz: 0.16, h: 5.2 });
  };
  // Along X-direction streets.
  for (const z of STREET_Z) {
    for (let k = 0; k < STREET_X.length - 1; k++) {
      const a = STREET_X[k] + 12;
      const b = STREET_X[k + 1] - 12;
      for (let x = a; x <= b + 0.01; x += (b - a) / 2) {
        addLamp(x, z - lampOffset, 0);
        addLamp(x, z + lampOffset, Math.PI);
      }
    }
  }
  // Along Z-direction streets.
  for (const x of STREET_X) {
    for (let k = 0; k < STREET_Z.length - 1; k++) {
      const a = STREET_Z[k] + 12;
      const b = STREET_Z[k + 1] - 12;
      for (let z = a; z <= b + 0.01; z += (b - a) / 2) {
        addLamp(x - lampOffset, z, Math.PI / 2);
        addLamp(x + lampOffset, z, -Math.PI / 2);
      }
    }
  }
  // Palms along the promenade (sea side), with gaps for the beach ramps and pier.
  const promZ = STREET_Z[STREET_Z.length - 1] + ROAD_HALF_WIDTH + 5.5;
  for (let x = -126; x <= 126; x += 9) {
    const inGap = BEACH_GAPS.some(([a, b]) => x > a - 3 && x < b + 3) || (x > PIER.x0 - 4 && x < PIER.x1 + 4);
    if (inGap) continue;
    city.trees.push({ x: x + rng.range(-1, 1), z: promZ, s: rng.range(0.95, 1.2), kind: "palm", tint: rng.next() });
  }
  // Promenade railing in segments between the gaps.
  const railZ = PROMENADE_EDGE_Z - 0.3;
  const cuts = ([...BEACH_GAPS, [PIER.x0, PIER.x1]] as [number, number][]).sort((a, b) => a[0] - b[0]);
  let from = -WALL_EAST_X;
  for (const [a, b] of [...cuts, [WALL_EAST_X, WALL_EAST_X] as [number, number]]) {
    if (a - from > 1) {
      city.props.push({ kind: "railing", x: (from + a) / 2, z: railZ, yaw: 0, sx: (a - from) / 2, sz: 0.1, h: 1.0 });
    }
    from = b;
  }
  // Bollards at beach access gaps keep the gap readable.
  for (const [a, b] of BEACH_GAPS) {
    city.props.push({ kind: "bollard", x: a, z: railZ, yaw: 0, sx: 0.25, sz: 0.25, h: 0.9 });
    city.props.push({ kind: "bollard", x: b, z: railZ, yaw: 0, sx: 0.25, sz: 0.25, h: 0.9 });
  }
  // Umbrellas and rocks on the beach for scale.
  for (let i = 0; i < 7; i++) {
    const x = -110 + i * 34 + rng.range(-4, 4);
    if (x > PIER.x0 - 8 && x < PIER.x1 + 8) continue;
    city.props.push({ kind: "umbrella", x, z: PROMENADE_EDGE_Z + 5 + rng.range(0, 3), yaw: 0, sx: 1.4, sz: 1.4, h: 2.3 });
  }
}

/** Retaining walls, embankments and breakwaters: the visible edge of the playable city. */
function buildBoundaries(city: City, rng: Rng) {
  const wall = (x: number, z: number, sx: number, sz: number, h: number) =>
    city.props.push({ kind: "wall", x, z, yaw: 0, sx, sz, h });
  const edgeSouth = PROMENADE_EDGE_Z;
  wall(0, WALL_NORTH_Z, WALL_EAST_X + 1, 0.8, 3.2);
  wall(-WALL_EAST_X, (WALL_NORTH_Z + edgeSouth) / 2, 0.8, (edgeSouth - WALL_NORTH_Z) / 2, 3.2);
  wall(WALL_EAST_X, (WALL_NORTH_Z + edgeSouth) / 2, 0.8, (edgeSouth - WALL_NORTH_Z) / 2, 3.2);
  // Rock breakwaters continue the side walls into the sea.
  for (const side of [-1, 1]) {
    for (let z = edgeSouth + 2; z < 150; z += 3.2) {
      city.props.push({ kind: "rock", x: side * (WALL_EAST_X + rng.range(-0.6, 0.6)), z, yaw: rng.range(0, 6.28), sx: 1.7, sz: 1.7, h: 1.6 });
    }
  }
}

/** Kerbside parking bays on every street segment plus the open parking lot. */
function buildParking(city: City) {
  let id = 0;
  const avoid = (x: number, z: number) =>
    city.landmarks.some((l) => Math.hypot(l.pad.x - x, l.pad.z - z) < 7);
  const push = (x: number, z: number, yaw: number, lot = false) => {
    if (avoid(x, z)) return;
    city.parking.push({ x, z, yaw, id: id++, lot });
  };
  const spacing = 6.8;
  const clearance = ROAD_HALF_WIDTH + BLOCK_CORNER_RADIUS + 3.5;
  for (const z of STREET_Z) {
    for (let k = 0; k < STREET_X.length - 1; k++) {
      const a = STREET_X[k] + clearance;
      const b = STREET_X[k + 1] - clearance;
      for (let x = a; x <= b + 0.01; x += spacing) {
        // North side (westbound traffic) faces -x, south side faces +x.
        push(x, z - PARKING_OFFSET, -Math.PI / 2);
        if (z !== STREET_Z[STREET_Z.length - 1]) push(x, z + PARKING_OFFSET, Math.PI / 2);
      }
    }
  }
  for (const x of STREET_X) {
    for (let k = 0; k < STREET_Z.length - 1; k++) {
      const a = STREET_Z[k] + clearance;
      const b = STREET_Z[k + 1] - clearance;
      for (let z = a; z <= b + 0.01; z += spacing) {
        // East side (southbound: +z) faces +z, west side faces -z.
        push(x + PARKING_OFFSET, z, 0);
        push(x - PARKING_OFFSET, z, Math.PI);
      }
    }
  }
  // Parking lot bays (block col 2 row 2): two facing rows.
  const lotBlock = city.blocks.find((b) => b.kind === "parking")!;
  const { lot } = lotBlock;
  for (let x = lot.x0 + 3.5; x <= lot.x1 - 3; x += 3.4) {
    push(x, lot.z0 + 12, Math.PI, true);
    push(x, lot.z1 - 7, 0, true);
  }
}

export function nearestSpot(spots: ParkingSpot[], x: number, z: number): ParkingSpot {
  let best = spots[0];
  let bd = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

function collectColliders(city: City): StaticCollider[] {
  const out: StaticCollider[] = [];
  let id = 0;
  const box = (x: number, z: number, hx: number, hz: number, top: number, yaw = 0) =>
    out.push({ shape: "box", x, z, hx, hz, yaw, top, id: id++ });
  const circle = (x: number, z: number, r: number, top: number, lamp?: number) =>
    out.push({ shape: "circle", x, z, r, top, id: id++, lamp });
  let lamp = 0;
  for (const b of city.buildings) box(b.x, b.z, b.hx, b.hz, CURB_HEIGHT + b.h);
  for (const l of city.landmarks) {
    if (l.style === "lighthouse") circle(l.x, l.z, l.hx, CURB_HEIGHT + l.h);
    else box(l.x, l.z, l.hx, l.hz, CURB_HEIGHT + l.h);
  }
  for (const t of city.trees) circle(t.x, t.z, t.kind === "palm" ? 0.3 : 0.35 * t.s, CURB_HEIGHT + 3);
  for (const p of city.props) {
    const top = CURB_HEIGHT + p.h;
    switch (p.kind) {
      case "lamp":
        circle(p.x, p.z, p.sx, top, lamp++);
        break;
      case "bollard":
        circle(p.x, p.z, p.sx, top);
        break;
      case "fountain":
      case "planter":
      case "rock":
        circle(p.x, p.z, p.sx, top);
        break;
      case "umbrella":
        circle(p.x, p.z, 0.12, top);
        break;
      default:
        box(p.x, p.z, p.sx, p.sz, top, p.yaw);
    }
  }
  return out;
}
