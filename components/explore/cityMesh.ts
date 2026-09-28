// Turns the city description into a handful of merged, vertex-coloured,
// flat-shaded geometries (split into spatial chunks for culling) plus instance
// transforms for trees and street lamps.

import * as THREE from "three";
import {
  BEACH_SLOPE,
  BLOCK_CORNER_RADIUS,
  CURB_HEIGHT,
  PALETTE,
  PARKING_OFFSET,
  PROMENADE_EDGE_Z,
  ROAD_HALF_WIDTH,
  SEA_FLOOR,
  STREET_X,
  STREET_Z,
  WALL_EAST_X,
  WALL_NORTH_Z,
  WATER_LEVEL,
  type Building,
  type City,
  type Landmark,
  type Prop,
} from "@/lib/game/city";
import { createRng } from "@/lib/game/math";
import { MeshBuilder, col, roundedRect, shade } from "./meshBuilder";

/** Late-afternoon sun from the south-west, ~25° above the horizon. */
export const SUN_DIR = new THREE.Vector3(-0.64, 0.42, 0.64).normalize();

export const ART = {
  asphalt: "#5b5d64",
  asphaltPatch: "#474a54",
  marking: "#efe6d0",
  markingYellow: "#e3b04b",
  sidewalk: "#dcd1bc",
  kerb: "#c9bea9",
  promenade: "#e7d3ae",
  grass: "#9dbb7c",
  grassDark: "#86a86b",
  plaza: "#e9dcc0",
  plazaRing: "#d8c7a4",
  lotPaving: "#d6caae",
  lotAsphalt: "#595d67",
  sand: "#ecd3a2",
  wetSand: "#cfb583",
  water: "#3fa2b3",
  waterFar: "#2f86a1",
  foam: "#f3eee0",
  wood: "#b98b5e",
  woodDark: "#8a6443",
  stone: "#d8cdb8",
  stoneDark: "#bfb39c",
  glass: "#3f6a7d",
  glassLit: "#79a4b4",
  glint: "#f6d9a6",
  door: "#4a3a33",
  hill: "#a7bf86",
  hillDark: "#8ea774",
  rock: "#b9ad98",
};

const CHUNK_M = 64;

export type CityGeometry = {
  chunks: THREE.BufferGeometry[];
  ground: THREE.BufferGeometry;
  far: THREE.BufferGeometry;
  trees: { round: THREE.Matrix4[]; cone: THREE.Matrix4[]; palm: THREE.Matrix4[]; tints: Record<string, THREE.Color[]> };
  lamps: THREE.Matrix4[];
};

class Chunks {
  private map = new Map<string, MeshBuilder>();
  at(x: number, z: number): MeshBuilder {
    const key = `${Math.floor(x / CHUNK_M)},${Math.floor(z / CHUNK_M)}`;
    let b = this.map.get(key);
    if (!b) {
      b = new MeshBuilder();
      this.map.set(key, b);
    }
    return b;
  }
  build() {
    return [...this.map.values()].filter((b) => b.vertexCount > 0).map((b) => b.build());
  }
}

export function buildCityGeometry(city: City): CityGeometry {
  const rng = createRng(city.seed * 31 + 5);
  const chunks = new Chunks();
  const ground = new MeshBuilder();
  const far = new MeshBuilder();

  buildGround(ground, chunks, city);
  buildMarkings(chunks, city);
  for (const b of city.buildings) buildBuilding(chunks.at(b.x, b.z), b, rng);
  for (const l of city.landmarks) buildLandmark(chunks.at(l.x, l.z), l);
  for (const p of city.props) if (p.kind !== "lamp") buildProp(chunks.at(p.x, p.z), p, rng);
  buildPier(chunks, city);
  buildRamps(chunks, city);
  buildSeaAndHills(far, rng);

  const trees: CityGeometry["trees"] = { round: [], cone: [], palm: [], tints: { round: [], cone: [], palm: [] } };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tintPalette = [shade(ART.grass, 0.05), col("#ffffff"), shade("#c7d9a8", 0), col("#e6efcf")];
  for (const t of city.trees) {
    q.setFromAxisAngle(up, t.tint * Math.PI * 2);
    m.compose(new THREE.Vector3(t.x, CURB_HEIGHT, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + t.tint * 0.25), t.s));
    trees[t.kind].push(m.clone());
    trees.tints[t.kind].push(tintPalette[Math.floor(t.tint * tintPalette.length) % tintPalette.length]);
  }
  for (const [x, z] of hillTrees(rng)) {
    q.setFromAxisAngle(up, rng.range(0, 6.28));
    const s = rng.range(1.2, 2.2);
    m.compose(new THREE.Vector3(x, hillHeight(x, z), z), q, new THREE.Vector3(s, s, s));
    const kind = rng.chance(0.55) ? "cone" : "round";
    trees[kind].push(m.clone());
    trees.tints[kind].push(tintPalette[rng.int(0, tintPalette.length - 1)]);
  }
  const lamps: THREE.Matrix4[] = [];
  for (const p of city.props) {
    if (p.kind !== "lamp") continue;
    q.setFromAxisAngle(up, p.yaw);
    m.compose(new THREE.Vector3(p.x, CURB_HEIGHT, p.z), q, new THREE.Vector3(1, 1, 1));
    lamps.push(m.clone());
  }
  return { chunks: chunks.build(), ground: ground.build(), far: far.build(), trees, lamps };
}

// ---------------------------------------------------------------------------
// Ground, blocks and outer strips

function buildGround(ground: MeshBuilder, chunks: Chunks, city: City) {
  const W = WALL_EAST_X + 1;
  // Asphalt under the whole street grid; kerbed blocks sit on top.
  ground.quad([-W, 0, WALL_NORTH_Z], [W, 0, WALL_NORTH_Z], [W, 0, PROMENADE_EDGE_Z], [-W, 0, PROMENADE_EDGE_Z], ART.asphalt, [0, 1, 0]);

  for (const b of city.blocks) {
    const out = chunks.at((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    const rim = roundedRect(b.x0, b.z0, b.x1, b.z1, BLOCK_CORNER_RADIUS, 4);
    out.polyTop(rim, CURB_HEIGHT, ART.sidewalk);
    out.polyWall(rim, 0, CURB_HEIGHT, ART.kerb);
    const lot = b.lot;
    const lotColor =
      b.kind === "park" || b.kind === "residential"
        ? ART.grass
        : b.kind === "parking" || b.kind === "stunt"
          ? ART.lotAsphalt
          : b.kind === "plaza"
            ? ART.plaza
            : ART.lotPaving;
    out.polyTop(roundedRect(lot.x0, lot.z0, lot.x1, lot.z1, 1.2, 2), CURB_HEIGHT + 0.006, lotColor);
    if (b.kind === "plaza") {
      const cx = (lot.x0 + lot.x1) / 2;
      const cz = (lot.z0 + lot.z1) / 2;
      const tile = 3;
      for (let x = lot.x0 + 0.5; x + tile <= lot.x1; x += tile) {
        for (let z = lot.z0 + 0.5; z + tile <= lot.z1; z += tile) {
          if (((Math.round((x - lot.x0) / tile) + Math.round((z - lot.z0) / tile)) & 1) === 0) continue;
          if (Math.hypot(x + tile / 2 - cx, z + tile / 2 - cz) < 5) continue;
          const y = CURB_HEIGHT + 0.009;
          out.quad([x + 0.06, y, z + 0.06], [x + tile - 0.06, y, z + 0.06], [x + tile - 0.06, y, z + tile - 0.06], [x + 0.06, y, z + tile - 0.06], "#e2d3b4", [0, 1, 0]);
        }
      }
      // Concentric paving rings around the fountain.
      for (const [r0, r1] of [
        [6.5, 7.3],
        [10.5, 11],
        [13.6, 14],
      ]) {
        ring(out, cx, CURB_HEIGHT + 0.012, cz, r0, r1, 32, ART.plazaRing);
      }
    }
    if (b.kind === "parking") {
      for (let x = lot.x0 + 1.8; x <= lot.x1 - 1.4; x += 3.4) {
        stripe(out, x, lot.z0 + 12 - 2.6, x, lot.z0 + 12 + 2.6, 0.12, ART.marking, CURB_HEIGHT + 0.012);
        stripe(out, x, lot.z1 - 7 - 2.6, x, lot.z1 - 7 + 2.6, 0.12, ART.marking, CURB_HEIGHT + 0.012);
      }
    }
    if (b.kind === "stunt") {
      // Painted run-up arrows toward the kicker.
      for (let i = 0; i < 3; i++) chevron(out, 96, 73 - i * 3, ART.markingYellow, CURB_HEIGHT + 0.012);
    }
  }

  // Outer pavements around the ring road and the waterfront promenade.
  const strip = (x0: number, z0: number, x1: number, z1: number, top: string) => {
    const out = chunks.at((x0 + x1) / 2, (z0 + z1) / 2);
    out.box((x0 + x1) / 2, CURB_HEIGHT / 2, (z0 + z1) / 2, x1 - x0, CURB_HEIGHT, z1 - z0, [top, ART.kerb], { bottom: false });
  };
  const ringOuter = { x: STREET_X[STREET_X.length - 1] + ROAD_HALF_WIDTH, z0: STREET_Z[0] - ROAD_HALF_WIDTH, z1: STREET_Z[STREET_Z.length - 1] + ROAD_HALF_WIDTH };
  strip(-W, WALL_NORTH_Z, W, ringOuter.z0, ART.sidewalk);
  strip(-W, ringOuter.z1, W, PROMENADE_EDGE_Z, ART.promenade);
  strip(-W, ringOuter.z0, -ringOuter.x, ringOuter.z1, ART.sidewalk);
  strip(ringOuter.x, ringOuter.z0, W, ringOuter.z1, ART.sidewalk);
  // Promenade paving bands for scale.
  for (let x = -W + 4; x < W; x += 8) {
    const out = chunks.at(x, 93);
    out.quad([x, CURB_HEIGHT + 0.005, ringOuter.z1 + 0.5], [x + 0.35, CURB_HEIGHT + 0.005, ringOuter.z1 + 0.5], [x + 0.35, CURB_HEIGHT + 0.005, PROMENADE_EDGE_Z - 0.6], [x, CURB_HEIGHT + 0.005, PROMENADE_EDGE_Z - 0.6], "#dcc59c", [0, 1, 0]);
  }

  // Beach: dry sand, wet sand at the waterline, sea floor beyond.
  const zWater = PROMENADE_EDGE_Z + (CURB_HEIGHT - WATER_LEVEL) / BEACH_SLOPE;
  const hAt = (z: number) => Math.max(SEA_FLOOR, CURB_HEIGHT - (z - PROMENADE_EDGE_Z) * BEACH_SLOPE);
  const bands: [number, number, string][] = [
    [PROMENADE_EDGE_Z, zWater - 3.5, ART.sand],
    [zWater - 3.5, zWater + 2, ART.wetSand],
    [zWater + 2, PROMENADE_EDGE_Z + 70, "#8fb8a8"],
  ];
  for (const [z0, z1, c] of bands) {
    for (let x = -W - 60; x < W + 60; x += 32) {
      chunks.at(x + 16, (z0 + z1) / 2).quad([x, hAt(z0), z0], [x + 32, hAt(z0), z0], [x + 32, hAt(z1), z1], [x, hAt(z1), z1], c, [0, 1, 0]);
    }
  }
  // Promenade sea wall face down to the sand.
  ground.quad([-W, CURB_HEIGHT, PROMENADE_EDGE_Z], [W, CURB_HEIGHT, PROMENADE_EDGE_Z], [W, -0.4, PROMENADE_EDGE_Z], [-W, -0.4, PROMENADE_EDGE_Z], ART.stoneDark, [0, 0, 1]);
  // Foam line at the waterline.
  for (let x = -W - 60; x < W + 60; x += 32) {
    chunks.at(x + 16, zWater).quad([x, WATER_LEVEL + 0.02, zWater - 0.5], [x + 32, WATER_LEVEL + 0.02, zWater - 0.5], [x + 32, WATER_LEVEL + 0.02, zWater + 0.6], [x, WATER_LEVEL + 0.02, zWater + 0.6], ART.foam, [0, 1, 0]);
  }
}

function ring(b: MeshBuilder, cx: number, y: number, cz: number, r0: number, r1: number, seg: number, color: string) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    b.quad(
      [cx + Math.cos(a0) * r0, y, cz + Math.sin(a0) * r0],
      [cx + Math.cos(a1) * r0, y, cz + Math.sin(a1) * r0],
      [cx + Math.cos(a1) * r1, y, cz + Math.sin(a1) * r1],
      [cx + Math.cos(a0) * r1, y, cz + Math.sin(a0) * r1],
      color,
      [0, 1, 0],
    );
  }
}

/** A flat painted stripe between two points. */
function stripe(b: MeshBuilder, x0: number, z0: number, x1: number, z1: number, w: number, color: string, y = 0.012) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * (w / 2);
  const nz = (dx / l) * (w / 2);
  b.quad([x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], [x0 - nx, y, z0 - nz], color, [0, 1, 0]);
}

function chevron(b: MeshBuilder, x: number, z: number, color: string, y: number) {
  stripe(b, x - 2, z + 1.2, x, z, 0.5, color, y);
  stripe(b, x, z, x + 2, z + 1.2, 0.5, color, y);
}

function buildMarkings(chunks: Chunks, city: City) {
  const dash = 2.6;
  const gap = 3.6;
  for (const n of city.nodes) {
    for (const nbId of [n.nbr[0], n.nbr[1]]) {
      if (nbId < 0) continue;
      const m = city.nodes[nbId];
      const alongX = m.z === n.z;
      const len = alongX ? m.x - n.x : m.z - n.z;
      const start = ROAD_HALF_WIDTH + BLOCK_CORNER_RADIUS + 1;
      for (let t = start; t + dash < len - start; t += dash + gap) {
        const [x0, z0, x1, z1] = alongX ? [n.x + t, n.z, n.x + t + dash, n.z] : [n.x, n.z + t, n.x, n.z + t + dash];
        stripe(chunks.at(x0, z0), x0, z0, x1, z1, 0.16, ART.marking);
      }
      // Parking lane edge lines on both sides.
      for (const side of [-1, 1]) {
        const o = side * (PARKING_OFFSET - 1.25);
        const a = start - 1.5;
        const [x0, z0, x1, z1] = alongX ? [n.x + a, n.z + o, n.x + len - a, n.z + o] : [n.x + o, n.z + a, n.x + o, n.z + len - a];
        stripe(chunks.at((x0 + x1) / 2, (z0 + z1) / 2), x0, z0, x1, z1, 0.1, "#cfc8b8");
      }
    }
    // Zebra crossings on every arm of the junction.
    for (let d = 0; d < 4; d++) {
      if (n.nbr[d] < 0) continue;
      const ux = d === 0 ? 1 : d === 2 ? -1 : 0;
      const uz = d === 1 ? 1 : d === 3 ? -1 : 0;
      const base = ROAD_HALF_WIDTH + 1.2;
      for (let s = -ROAD_HALF_WIDTH + 0.9; s <= ROAD_HALF_WIDTH - 0.9; s += 1.25) {
        const px = n.x + ux * base + -uz * s;
        const pz = n.z + uz * base + ux * s;
        stripe(chunks.at(px, pz), px, pz, px + ux * 2.6, pz + uz * 2.6, 0.55, ART.marking);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Buildings

const sunFacing = (nx: number, nz: number) => nx * SUN_DIR.x + nz * SUN_DIR.z > 0.25;

/** Window quads on one facade. `face`: 0=+z, 1=+x, 2=-z, 3=-x. */
function facadeWindows(
  out: MeshBuilder,
  b: { x: number; z: number; hx: number; hz: number },
  face: number,
  y0: number,
  floors: number,
  floorH: number,
  kind: Building["windows"],
  rng: ReturnType<typeof createRng>,
  opts: { skipGround?: boolean; winW?: number; winH?: number; glass?: string; doorFace?: number } = {},
) {
  const alongX = face === 0 || face === 2;
  const width = alongX ? b.hx * 2 : b.hz * 2;
  const nx = face === 1 ? 1 : face === 3 ? -1 : 0;
  const nz = face === 0 ? 1 : face === 2 ? -1 : 0;
  const lit = sunFacing(nx, nz);
  const off = 0.03;
  const fx = b.x + nx * (b.hx + off);
  const fz = b.z + nz * (b.hz + off);
  const quadAt = (u: number, yb: number, w: number, h: number, color: string) => {
    // u is the offset along the facade from its centre.
    const ax = alongX ? fx + u - w / 2 : fx;
    const bx = alongX ? fx + u + w / 2 : fx;
    const az = alongX ? fz : fz + u - w / 2;
    const bz = alongX ? fz : fz + u + w / 2;
    out.quad([ax, yb, az], [bx, yb, bz], [bx, yb + h, bz], [ax, yb + h, az], color, [nx, 0, nz]);
  };
  const glassColor = () => {
    if (opts.glass) return opts.glass;
    if (lit) return rng.chance(0.3) ? ART.glint : ART.glassLit;
    return rng.chance(0.15) ? ART.glassLit : ART.glass;
  };
  if (kind === "none") return;
  const winW = opts.winW ?? (kind === "house" ? 1.0 : 1.15);
  const winH = opts.winH ?? (kind === "house" ? 1.2 : 1.45);
  for (let f = 0; f < floors; f++) {
    const yb = y0 + f * floorH + floorH * 0.32;
    if (f === 0 && opts.skipGround) continue;
    if (kind === "band") {
      quadAt(0, yb, width - 1.4, 1.0, glassColor());
      continue;
    }
    if (kind === "shop" && f === 0) {
      const n = Math.max(1, Math.floor((width - 1) / 3.4));
      for (let i = 0; i < n; i++) {
        const u = -width / 2 + (width / n) * (i + 0.5);
        quadAt(u, y0 + 0.35, Math.min(2.6, width / n - 0.6), 2.1, i === Math.floor(n / 2) ? ART.door : glassColor());
      }
      continue;
    }
    const n = kind === "house" ? Math.max(1, Math.min(3, Math.floor(width / 3.2))) : Math.max(1, Math.floor((width - 0.8) / 2.4));
    for (let i = 0; i < n; i++) {
      const u = -width / 2 + (width / n) * (i + 0.5);
      if (kind === "house" && f === 0 && i === Math.floor(n / 2) && face === opts.doorFace) {
        quadAt(u, y0, 1.0, 2.0, ART.door);
        continue;
      }
      quadAt(u, yb, winW, winH, glassColor());
    }
  }
}

function buildBuilding(out: MeshBuilder, b: Building, rng: ReturnType<typeof createRng>) {
  const y0 = CURB_HEIGHT;
  const body = b.body;
  const top = shade(body, -0.06);
  out.box(b.x, y0 + b.h / 2, b.z, b.hx * 2, b.h, b.hz * 2, [top, body], { bottom: false });
  // Plinth.
  out.box(b.x, y0 + 0.3, b.z, b.hx * 2 + 0.16, 0.6, b.hz * 2 + 0.16, [shade(b.trim, -0.1), shade(b.trim, -0.12)], { bottom: false });
  const floorH = (b.h - (b.roof === "gable" ? 0 : 0.6)) / Math.max(1, b.floors);
  for (let face = 0; face < 4; face++) facadeWindows(out, b, face, y0, b.floors, floorH, b.windows, rng, { doorFace: b.face });
  // Doors on the street face for non-house buildings.
  if (b.windows !== "house" && b.windows !== "shop") {
    const nx = b.face === 1 ? 1 : b.face === 3 ? -1 : 0;
    const nz = b.face === 0 ? 1 : b.face === 2 ? -1 : 0;
    const fx = b.x + nx * (b.hx + 0.04);
    const fz = b.z + nz * (b.hz + 0.04);
    const w = 1.4;
    const along = b.face === 0 || b.face === 2;
    out.quad(
      [along ? fx - w / 2 : fx, y0, along ? fz : fz - w / 2],
      [along ? fx + w / 2 : fx, y0, along ? fz : fz + w / 2],
      [along ? fx + w / 2 : fx, y0 + 2.2, along ? fz : fz + w / 2],
      [along ? fx - w / 2 : fx, y0 + 2.2, along ? fz : fz - w / 2],
      ART.door,
      [nx, 0, nz],
    );
  }
  const roofY = y0 + b.h;
  switch (b.roof) {
    case "parapet": {
      const t = 0.28;
      const h = 0.55;
      const c = b.trim;
      out.box(b.x, roofY + h / 2, b.z + b.hz - t / 2, b.hx * 2, h, t, c, { bottom: false });
      out.box(b.x, roofY + h / 2, b.z - b.hz + t / 2, b.hx * 2, h, t, c, { bottom: false });
      out.box(b.x + b.hx - t / 2, roofY + h / 2, b.z, t, h, b.hz * 2 - 2 * t, c, { bottom: false });
      out.box(b.x - b.hx + t / 2, roofY + h / 2, b.z, t, h, b.hz * 2 - 2 * t, c, { bottom: false });
      if (rng.chance(0.6)) out.box(b.x + rng.range(-b.hx / 3, b.hx / 3), roofY + 0.5, b.z + rng.range(-b.hz / 3, b.hz / 3), 1.6, 1, 1.2, "#b8b3aa", { bottom: false });
      break;
    }
    case "flat":
      out.box(b.x, roofY + 0.12, b.z, b.hx * 2 + 0.3, 0.24, b.hz * 2 + 0.3, [shade(b.trim, -0.05), b.trim], { bottom: false });
      break;
    case "gable": {
      const ridgeX = b.hx >= b.hz;
      const span = ridgeX ? b.hz * 2 : b.hx * 2;
      out.gable(b.x, roofY, b.z, b.hx * 2, b.hz * 2, Math.min(3.2, span * 0.42), b.roofColor, body, ridgeX);
      break;
    }
    case "sawtooth": {
      const n = Math.max(2, Math.round((b.hx * 2) / 5));
      const w = (b.hx * 2) / n;
      for (let i = 0; i < n; i++) {
        const x = b.x - b.hx + w * (i + 0.5);
        out.gable(x, roofY, b.z, w, b.hz * 2, 1.6, b.roofColor, b.trim, false, 0.05);
      }
      break;
    }
  }
  if (b.awning) {
    const nx = b.face === 1 ? 1 : b.face === 3 ? -1 : 0;
    const nz = b.face === 0 ? 1 : b.face === 2 ? -1 : 0;
    const along = b.face === 0 || b.face === 2;
    const w = (along ? b.hx : b.hz) * 1.5;
    const depth = 1.3;
    const y = y0 + 2.9;
    const cx = b.x + nx * (b.hx + depth / 2);
    const cz = b.z + nz * (b.hz + depth / 2);
    // Sloped canopy: a thin box tilted down away from the wall.
    const sx = along ? w : depth;
    const sz = along ? depth : w;
    const a: [number, number, number] = [cx - sx / 2, y, cz - sz / 2];
    const c2: [number, number, number] = [cx + sx / 2, y, cz + sz / 2];
    const drop = 0.45;
    const lowX = nx !== 0;
    const yA = (px: number, pz: number) => y - drop * (lowX ? ((px - (b.x + nx * b.hx)) * nx) / depth : ((pz - (b.z + nz * b.hz)) * nz) / depth);
    out.quad(
      [a[0], yA(a[0], a[2]), a[2]],
      [c2[0], yA(c2[0], a[2]), a[2]],
      [c2[0], yA(c2[0], c2[2]), c2[2]],
      [a[0], yA(a[0], c2[2]), c2[2]],
      b.awning,
      [nx * 0.3, 1, nz * 0.3],
    );
    // Valance strip.
    const vx = b.x + nx * (b.hx + depth);
    const vz = b.z + nz * (b.hz + depth);
    out.box(vx, y - drop - 0.12, vz, along ? w : 0.06, 0.28, along ? 0.06 : w, shade(b.awning, -0.1), { bottom: false });
  }
}

// ---------------------------------------------------------------------------
// Landmarks: each has a distinct silhouette.

function buildLandmark(out: MeshBuilder, l: Landmark) {
  const y0 = CURB_HEIGHT;
  const rng = createRng(l.slug.length * 97 + l.x);
  const faceN = (f: number): [number, number] => [f === 1 ? 1 : f === 3 ? -1 : 0, f === 0 ? 1 : f === 2 ? -1 : 0];
  const [fnx, fnz] = faceN(l.face);
  const canopy = (color: string, w = 5, depth = 2.2, y = 3.2) => {
    const cx = l.x + fnx * (l.hx + depth / 2);
    const cz = l.z + fnz * (l.hz + depth / 2);
    const along = l.face === 0 || l.face === 2;
    out.box(cx, y0 + y, cz, along ? w : depth, 0.3, along ? depth : w, color);
  };
  switch (l.style) {
    case "tower": {
      const glass = "#4d8e9c";
      out.box(l.x, y0 + l.h / 2, l.z, l.hx * 2, l.h, l.hz * 2, [PALETTE.cream, glass], { bottom: false });
      // Vertical cream fins and floor bands give the curtain wall its rhythm.
      for (let f = 0; f < 4; f++) {
        const [nx, nz] = faceN(f);
        const along = f === 0 || f === 2;
        const span = along ? l.hx * 2 : l.hz * 2;
        for (let u = -span / 2 + 1; u <= span / 2 - 0.9; u += 2) {
          const x = l.x + (along ? u : nx * (l.hx + 0.12));
          const z = l.z + (along ? nz * (l.hz + 0.12) : u);
          out.box(x, y0 + (l.h - 4) / 2 + 2, z, along ? 0.22 : 0.3, l.h - 4, along ? 0.3 : 0.22, PALETTE.cream, { bottom: false });
        }
      }
      for (let y = 4; y < l.h - 3; y += 3.4) out.box(l.x, y0 + y, l.z, l.hx * 2 + 0.3, 0.22, l.hz * 2 + 0.3, PALETTE.white, { bottom: false });
      // Podium and coral crown.
      out.box(l.x, y0 + 2.2, l.z, l.hx * 2 + 0.6, 4.4, l.hz * 2 + 0.6, [PALETTE.cream, PALETTE.cream], { bottom: false });
      facadeWindows(out, { x: l.x, z: l.z, hx: l.hx + 0.3, hz: l.hz + 0.3 }, l.face, y0, 1, 4.4, "shop", rng, { glass: ART.glassLit });
      out.box(l.x, y0 + l.h + 1.6, l.z, l.hx * 2 - 2.4, 3.2, l.hz * 2 - 2.4, [PALETTE.coral, PALETTE.coral], { bottom: false });
      out.box(l.x, y0 + l.h + 3.6, l.z, l.hx * 2 - 5, 0.8, l.hz * 2 - 5, PALETTE.terracotta, { bottom: false });
      out.cylinder(l.x, y0 + l.h + 4, l.z, 0.14, 0.06, 6, 5, PALETTE.white);
      canopy(PALETTE.coral, 6, 2.4, 4.6);
      break;
    }
    case "civic": {
      out.box(l.x, y0 + l.h / 2, l.z, l.hx * 2, l.h, l.hz * 2, [PALETTE.white, PALETTE.white], { bottom: false });
      for (let f = 0; f < 4; f++) facadeWindows(out, l, f, y0, 3, l.h / 3, "band", rng, { glass: f === l.face ? ART.glassLit : undefined });
      // Teal band and rooftop pavilion with a landing pad.
      out.box(l.x, y0 + l.h - 0.6, l.z, l.hx * 2 + 0.2, 1.2, l.hz * 2 + 0.2, PALETTE.teal, { bottom: false });
      out.box(l.x - l.hx * 0.35, y0 + l.h + 1.3, l.z, l.hx * 0.8, 2.6, l.hz * 0.9, [PALETTE.teal, PALETTE.deepTeal], { bottom: false });
      out.cylinder(l.x + l.hx * 0.35, y0 + l.h, l.z, 3.2, 3.2, 0.25, 16, PALETTE.slate, PALETTE.slate);
      out.cylinder(l.x + l.hx * 0.35, y0 + l.h + 0.25, l.z, 2.4, 2.4, 0.03, 16, PALETTE.white, PALETTE.white);
      // Cantilevered entrance canopy (kept over the pavement, clear of the street).
      canopy(PALETTE.white, 9, 2.2, 4.2);
      break;
    }
    case "studio": {
      // Stacked, offset colour blocks.
      const tiers: [number, number, number, number, number, string][] = [
        [0, 0, l.hx * 2, l.hz * 2, 4.2, PALETTE.cream],
        [1.6, -0.8, l.hx * 1.55, l.hz * 1.5, 3.8, PALETTE.coral],
        [-2.4, 0.8, l.hx * 1.0, l.hz * 1.05, 3.2, PALETTE.mustard],
      ];
      let y = y0;
      tiers.forEach(([ox, oz, sx, sz, h, c], i) => {
        out.box(l.x + ox, y + h / 2, l.z + oz, sx, h, sz, [shade(c, -0.05), c], { bottom: false });
        const box = { x: l.x + ox, z: l.z + oz, hx: sx / 2, hz: sz / 2 };
        for (let f = 0; f < 4; f++) facadeWindows(out, box, f, y, 1, h, i === 0 ? "shop" : "band", rng);
        y += h;
      });
      out.box(l.x - 2.4, y + 0.3, l.z + 0.8, l.hx * 1.0 + 0.4, 0.6, l.hz * 1.05 + 0.4, PALETTE.teal, { bottom: false });
      canopy(PALETTE.teal, 6, 2, 3.4);
      break;
    }
    case "depot": {
      const body = PALETTE.dusk;
      out.box(l.x, y0 + l.h / 2, l.z, l.hx * 2, l.h, l.hz * 2, [shade(body, -0.05), body], { bottom: false });
      const n = 4;
      const w = (l.hx * 2) / n;
      for (let i = 0; i < n; i++) out.gable(l.x - l.hx + w * (i + 0.5), y0 + l.h, l.z, w, l.hz * 2, 1.8, PALETTE.cream, PALETTE.cream, false, 0.05);
      // Roll-up service doors with warning stripes.
      const along = l.face === 0 || l.face === 2;
      for (let i = -1; i <= 1; i++) {
        const u = i * 6.5;
        const x = l.x + (along ? u : fnx * (l.hx + 0.05));
        const z = l.z + (along ? fnz * (l.hz + 0.05) : u);
        out.box(x, y0 + 2.2, z, along ? 4.6 : 0.1, 4.4, along ? 0.1 : 4.6, "#59606b", { bottom: false });
        for (let k = 0; k < 5; k++) out.box(x, y0 + 0.6 + k * 0.85, z + (along ? fnz * 0.03 : 0), along ? 4.6 : 0.12, 0.08, along ? 0.12 : 4.6, "#6f7782", { bottom: false });
        out.box(x, y0 + 4.6, z, along ? 5.2 : 0.2, 0.35, along ? 0.2 : 5.2, PALETTE.mustard, { bottom: false });
      }
      facadeWindows(out, l, (l.face + 2) % 4, y0, 2, 3.5, "band", rng);
      out.box(l.x + l.hx - 2, y0 + l.h + 2.4, l.z - l.hz + 2, 0.5, 4.8, 0.5, "#8a8f96");
      break;
    }
    case "academy": {
      const wing = l.hx * 0.72;
      for (const side of [-1, 1]) {
        const cx = l.x + side * (l.hx - wing / 2);
        out.box(cx, y0 + l.h / 2, l.z, wing, l.h, l.hz * 2, [shade(PALETTE.sage, -0.06), PALETTE.sage], { bottom: false });
        for (let f = 0; f < 4; f++) facadeWindows(out, { x: cx, z: l.z, hx: wing / 2, hz: l.hz }, f, y0, 3, l.h / 3, "grid", rng);
        // Rooftop solar arrays.
        for (let k = -1; k <= 1; k++) {
          out.quad(
            [cx - wing / 2 + 1, y0 + l.h + 0.3, l.z + k * 4 - 1],
            [cx + wing / 2 - 1, y0 + l.h + 0.3, l.z + k * 4 - 1],
            [cx + wing / 2 - 1, y0 + l.h + 1.1, l.z + k * 4 + 0.6],
            [cx - wing / 2 + 1, y0 + l.h + 1.1, l.z + k * 4 + 0.6],
            "#34506a",
            [0, 1, 0.6],
          );
        }
      }
      // Glass atrium between the wings.
      const atrW = l.hx * 2 - wing * 2;
      out.box(l.x, y0 + (l.h + 1.5) / 2, l.z, atrW, l.h + 1.5, l.hz * 1.6, [PALETTE.cream, ART.glassLit], { bottom: false });
      out.box(l.x, y0 + l.h + 1.6, l.z, atrW + 0.4, 0.3, l.hz * 1.6 + 0.4, PALETTE.cream, { bottom: false });
      out.cylinder(l.x + l.hx - 3, y0 + l.h, l.z + 3, 0.12, 0.05, 7, 5, PALETTE.white);
      canopy(PALETTE.teal, 7, 2.4, 3.6);
      break;
    }
    case "glass": {
      const frame = PALETTE.terracotta;
      out.box(l.x, y0 + l.h / 2, l.z, l.hx * 2, l.h, l.hz * 2, [PALETTE.cream, PALETTE.cream], { bottom: false });
      for (let f = 0; f < 4; f++) {
        const [nx, nz] = faceN(f);
        const along = f === 0 || f === 2;
        const span = (along ? l.hx : l.hz) * 2 - 2;
        // Large glass panels framed in terracotta.
        const fx = l.x + nx * (l.hx + 0.04);
        const fz = l.z + nz * (l.hz + 0.04);
        const glass = sunFacing(nx, nz) ? "#8cb6c2" : "#4f8093";
        out.quad(
          [along ? fx - span / 2 : fx, y0 + 1, along ? fz : fz - span / 2],
          [along ? fx + span / 2 : fx, y0 + 1, along ? fz : fz + span / 2],
          [along ? fx + span / 2 : fx, y0 + l.h - 1.2, along ? fz : fz + span / 2],
          [along ? fx - span / 2 : fx, y0 + l.h - 1.2, along ? fz : fz - span / 2],
          glass,
          [nx, 0, nz],
        );
        for (let u = -span / 2; u <= span / 2 + 0.01; u += span / 5) {
          const x = along ? fx + u : fx + nx * 0.08;
          const z = along ? fz + nz * 0.08 : fz + u;
          out.box(x, y0 + l.h / 2, z, along ? 0.3 : 0.16, l.h - 1.8, along ? 0.16 : 0.3, frame, { bottom: false });
        }
        for (let y = 1; y < l.h - 1; y += 3.6) {
          out.box(fx + nx * 0.08, y0 + y, fz + nz * 0.08, along ? span + 0.3 : 0.16, 0.22, along ? 0.16 : span + 0.3, frame, { bottom: false });
        }
      }
      out.box(l.x, y0 + l.h + 0.3, l.z, l.hx * 2 + 0.5, 0.6, l.hz * 2 + 0.5, frame, { bottom: false });
      canopy(frame, 5, 2, 3.2);
      break;
    }
    case "brick": {
      const brick = PALETTE.brick;
      out.box(l.x, y0 + l.h / 2, l.z, l.hx * 2, l.h, l.hz * 2, [shade(brick, -0.1), brick], { bottom: false });
      for (let f = 0; f < 4; f++) facadeWindows(out, l, f, y0, 3, l.h / 3, "grid", rng, { winW: 1.0, winH: 1.8 });
      for (let y = l.h / 3; y < l.h; y += l.h / 3) out.box(l.x, y0 + y - 0.1, l.z, l.hx * 2 + 0.2, 0.25, l.hz * 2 + 0.2, PALETTE.cream, { bottom: false });
      out.gable(l.x, y0 + l.h, l.z, l.hx * 2, l.hz * 2, 3.2, PALETTE.roofDark, brick, true);
      // Clock tower on the street side.
      const tx = l.x + fnx * (l.hx - 2.5);
      const tz = l.z + fnz * (l.hz - 2.5);
      out.box(tx, y0 + 10, tz, 5, 20, 5, [brick, brick], { bottom: false });
      out.box(tx, y0 + 20.3, tz, 5.6, 0.6, 5.6, PALETTE.cream, { bottom: false });
      out.cylinder(tx, y0 + 20.6, tz, 3.7, 0, 3.4, 4, PALETTE.roofDark, undefined, Math.PI / 4);
      out.cylinder(tx + fnx * 2.55, y0 + 16.4, tz + fnz * 2.55, 1.2, 1.2, 0.05, 12, PALETTE.cream);
      const clockFace = { x: tx, z: tz, hx: 2.5, hz: 2.5 };
      for (let f = 0; f < 4; f++) {
        const [nx, nz] = faceN(f);
        const px = clockFace.x + nx * 2.53;
        const pz = clockFace.z + nz * 2.53;
        const along = f === 0 || f === 2;
        out.box(px, y0 + 16.4, pz, along ? 2.2 : 0.06, 2.2, along ? 0.06 : 2.2, PALETTE.cream, { bottom: false });
        out.box(px + nx * 0.03, y0 + 16.8, pz + nz * 0.03, along ? 0.12 : 0.06, 0.9, along ? 0.06 : 0.12, "#3a3530", { bottom: false });
      }
      canopy(PALETTE.cream, 4, 1.6, 3);
      break;
    }
    case "lighthouse": {
      out.cylinder(l.x, y0, l.z, l.hx, l.hx * 0.95, 1.4, 12, PALETTE.stone, PALETTE.stone);
      const bands = 6;
      const h = 12;
      for (let i = 0; i < bands; i++) {
        const r0 = 2.3 - (i / bands) * 0.8;
        const r1 = 2.3 - ((i + 1) / bands) * 0.8;
        out.cylinder(l.x, y0 + 1.4 + (i * h) / bands, l.z, r0, r1, h / bands, 12, i % 2 ? PALETTE.white : "#d4543e");
      }
      const top = y0 + 1.4 + h;
      out.cylinder(l.x, top, l.z, 2.0, 2.0, 0.3, 12, "#3b3f46", "#3b3f46");
      out.cylinder(l.x, top + 0.3, l.z, 1.1, 1.1, 1.5, 8, "#f7e6b0", "#f7e6b0");
      out.cylinder(l.x, top + 1.8, l.z, 1.35, 0, 1.3, 8, "#d4543e");
      break;
    }
  }
  // Interaction pad plinth marker (flat, in the sidewalk).
  ring(out, l.pad.x, CURB_HEIGHT + 0.015, l.pad.z, l.pad.r - 0.28, l.pad.r, 24, PALETTE.mustard);
}

// ---------------------------------------------------------------------------
// Props

function buildProp(out: MeshBuilder, p: Prop, rng: ReturnType<typeof createRng>) {
  const y0 = CURB_HEIGHT;
  switch (p.kind) {
    case "bench":
      out.box(p.x, y0 + 0.45, p.z, p.sx * 2, 0.1, 0.5, ART.wood, { yaw: p.yaw });
      out.box(p.x - Math.sin(p.yaw) * 0.22, y0 + 0.75, p.z - Math.cos(p.yaw) * 0.22, p.sx * 2, 0.45, 0.08, ART.wood, { yaw: p.yaw });
      for (const s of [-1, 1]) {
        out.box(p.x + Math.cos(p.yaw) * s * (p.sx - 0.1), y0 + 0.22, p.z - Math.sin(p.yaw) * s * (p.sx - 0.1), 0.08, 0.45, 0.45, "#4a4d55", { yaw: p.yaw });
      }
      break;
    case "planter":
      out.box(p.x, y0 + p.h / 2, p.z, p.sx * 2, p.h, p.sz * 2, [ART.grassDark, ART.stone], { bottom: false });
      break;
    case "bollard":
      out.cylinder(p.x, y0, p.z, p.sx, p.sx * 0.85, p.h, 8, "#4a4d55", "#4a4d55");
      out.cylinder(p.x, y0 + p.h * 0.7, p.z, p.sx * 0.9, p.sx * 0.88, 0.12, 8, PALETTE.white);
      break;
    case "kiosk": {
      const c = rng.pick([PALETTE.teal, PALETTE.coral, PALETTE.mustard]);
      out.box(p.x, y0 + (p.h - 0.4) / 2, p.z, p.sx * 1.7, p.h - 0.4, p.sz * 1.7, [c, c], { bottom: false });
      out.box(p.x, y0 + p.h - 0.15, p.z, p.sx * 2.2, 0.3, p.sz * 2.2, PALETTE.white, { bottom: false });
      out.box(p.x, y0 + 1.5, p.z + p.sz * 0.86, p.sx * 1.2, 0.8, 0.04, ART.glassLit, { bottom: false });
      break;
    }
    case "umbrella": {
      const c = rng.pick([PALETTE.coral, PALETTE.teal, PALETTE.mustard, PALETTE.white]);
      out.cylinder(p.x, y0, p.z, 0.05, 0.05, p.h, 5, "#f1ece2");
      out.cylinder(p.x, y0 + p.h - 0.5, p.z, p.sx, 0.05, 0.6, 8, c);
      break;
    }
    case "fountain":
      out.cylinder(p.x, y0, p.z, p.sx, p.sx, 0.6, 20, ART.stone, "#6db6c2");
      out.cylinder(p.x, y0 + 0.6, p.z, p.sx, p.sx - 0.35, 0.12, 20, ART.stoneDark, "#6db6c2");
      out.cylinder(p.x, y0, p.z, 0.8, 0.6, 1.8, 10, ART.stone, ART.stone);
      out.cylinder(p.x, y0 + 1.8, p.z, 1.5, 1.5, 0.2, 12, ART.stoneDark, "#7cc3cc");
      out.cylinder(p.x, y0 + 2.0, p.z, 0.25, 0.1, 0.9, 6, ART.stone);
      break;
    case "railing": {
      const along = p.sx > p.sz;
      const len = (along ? p.sx : p.sz) * 2;
      const n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= n; i++) {
        const u = -len / 2 + (len * i) / n;
        out.box(p.x + (along ? u : 0), y0 + p.h / 2, p.z + (along ? 0 : u), 0.1, p.h, 0.1, PALETTE.white, { bottom: false });
      }
      out.box(p.x, y0 + p.h, p.z, along ? len : 0.14, 0.1, along ? 0.14 : len, PALETTE.white, { bottom: false });
      out.box(p.x, y0 + p.h * 0.5, p.z, along ? len : 0.06, 0.06, along ? 0.06 : len, PALETTE.white, { bottom: false });
      break;
    }
    case "wall": {
      const along = p.sx > p.sz;
      out.box(p.x, y0 + p.h / 2, p.z, p.sx * 2, p.h, p.sz * 2, [ART.stoneDark, ART.stone], { bottom: false });
      out.box(p.x, y0 + p.h + 0.1, p.z, p.sx * 2 + 0.2, 0.2, p.sz * 2 + 0.2, PALETTE.cream, { bottom: false });
      if (p.h > 2) {
        const len = (along ? p.sx : p.sz) * 2;
        for (let u = -len / 2 + 6; u < len / 2 - 3; u += 12) {
          // Pilaster: 0.9 m along the wall, a little proud of its thickness across it.
          const across = (along ? p.sz : p.sx) * 2 + 0.3;
          out.box(p.x + (along ? u : 0), y0 + p.h / 2, p.z + (along ? 0 : u), along ? 0.9 : across, p.h, along ? across : 0.9, shade(ART.stone, 0.06), { bottom: false });
          // Climbing plants soften the retaining wall.
          if (rng.chance(0.5)) {
            const o = u + 4;
            // Radii: 2.2 m along the wall, just proud of its thickness across it.
            out.blob(p.x + (along ? o : 0), y0 + p.h * 0.55, p.z + (along ? 0 : o), along ? 2.2 : p.sx + 0.5, p.h * 0.5, along ? p.sz + 0.5 : 2.2, ART.grassDark, 6);
          }
        }
      }
      break;
    }
    case "rock":
      out.blob(p.x, 0.2, p.z, p.sx, p.h * 0.75, p.sx * 0.9, ART.rock, 6, () => rng.range(-0.15, 0.15));
      break;
    default:
      break;
  }
}

function buildPier(chunks: Chunks, city: City) {
  const { pier } = city;
  const deck = (x0: number, x1: number, z0: number, z1: number) => {
    const out = chunks.at((x0 + x1) / 2, (z0 + z1) / 2);
    out.box((x0 + x1) / 2, CURB_HEIGHT - 0.25, (z0 + z1) / 2, x1 - x0, 0.5, z1 - z0, [ART.wood, ART.woodDark], { bottom: false });
    for (let z = z0 + 1.2; z < z1; z += 1.2) {
      out.quad([x0, CURB_HEIGHT + 0.004, z], [x1, CURB_HEIGHT + 0.004, z], [x1, CURB_HEIGHT + 0.004, z + 0.07], [x0, CURB_HEIGHT + 0.004, z + 0.07], ART.woodDark, [0, 1, 0]);
    }
    for (let z = z0 + 3; z < z1; z += 6) {
      for (const x of [x0 + 0.4, x1 - 0.4]) out.cylinder(x, SEA_FLOOR, z, 0.3, 0.3, CURB_HEIGHT - 0.5 - SEA_FLOOR, 6, ART.woodDark);
    }
  };
  deck(pier.x0, pier.x1, pier.z0 + 1, pier.head.z0);
  deck(pier.head.x0, pier.head.x1, pier.head.z0, pier.head.z1);
}

function buildRamps(chunks: Chunks, city: City) {
  for (const r of city.ramps) {
    const out = chunks.at(r.x, r.z);
    const s = Math.sin(r.yaw);
    const c = Math.cos(r.yaw);
    // local (w, u) -> world: x = r.x + w*c + u*s, z = r.z - w*s + u*c
    const P = (w: number, u: number, h: number): [number, number, number] => [r.x + w * c + u * s, h, r.z - w * s + u * c];
    const W = r.halfWid;
    const L = r.halfLen;
    const top = "#d9d2c2";
    const side = "#a8a193";
    out.quad(P(-W, -L, r.h0), P(W, -L, r.h0), P(W, L, r.h1), P(-W, L, r.h1), top, [0, 1, 0]);
    out.quad(P(W, -L, 0), P(W, L, 0), P(W, L, r.h1), P(W, -L, r.h0), side, [c, 0, -s]);
    out.quad(P(-W, -L, 0), P(-W, L, 0), P(-W, L, r.h1), P(-W, -L, r.h0), side, [-c, 0, s]);
    const hiU = r.h1 > r.h0 ? L : -L;
    const hi = Math.max(r.h0, r.h1);
    out.quad(P(-W, hiU, 0), P(W, hiU, 0), P(W, hiU, hi), P(-W, hiU, hi), side, [s * Math.sign(hiU), 0, c * Math.sign(hiU)]);
    // Hazard stripes along the lip.
    for (let i = 0; i < 6; i++) {
      const w0 = -W + (i * 2 * W) / 6;
      const w1 = w0 + (2 * W) / 6;
      const u0 = hiU - Math.sign(hiU) * 0.6;
      const hh = (u: number) => r.h0 + ((r.h1 - r.h0) * (u + L)) / (2 * L) + 0.01;
      out.quad(P(w0, u0, hh(u0)), P(w1, u0, hh(u0)), P(w1, hiU, hh(hiU)), P(w0, hiU, hh(hiU)), i % 2 ? "#2f3136" : PALETTE.mustard, [0, 1, 0]);
    }
  }
}

// ---------------------------------------------------------------------------
// Sea, hills and the far horizon (outside the playable area).

function hillHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  const north = z < WALL_NORTH_Z - 1 ? (WALL_NORTH_Z - 1 - z) * 0.16 + 3.2 : 0;
  const side = ax > WALL_EAST_X + 1 ? (ax - WALL_EAST_X - 1) * 0.2 + 3.2 : 0;
  // Side hills fall away toward the sea.
  const seaFade = z > 60 ? Math.max(0, 1 - (z - 60) / 60) : 1;
  const base = Math.max(north, side * seaFade);
  const wobble = Math.sin(x * 0.045) * 2.2 + Math.cos(z * 0.06 + x * 0.02) * 1.6;
  return base > 0 ? base + wobble * Math.min(1, base / 8) : 0;
}

function* hillTrees(rng: ReturnType<typeof createRng>): Generator<[number, number]> {
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-190, 190);
    const z = rng.range(-150, -99);
    yield [x, z];
  }
  for (let i = 0; i < 50; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    yield [side * rng.range(WALL_EAST_X + 5, 185), rng.range(-95, 70)];
  }
}

function buildSeaAndHills(far: MeshBuilder, rng: ReturnType<typeof createRng>) {
  // Sea: two-tone bands fading toward the horizon.
  const zShore = PROMENADE_EDGE_Z + 6;
  const bandsZ = [zShore, 160, 260, 900];
  const colors = [ART.water, "#3897ad", ART.waterFar, "#5aa0b4"];
  for (let i = 0; i < bandsZ.length - 1; i++) {
    far.quad([-900, WATER_LEVEL, bandsZ[i]], [900, WATER_LEVEL, bandsZ[i]], [900, WATER_LEVEL, bandsZ[i + 1]], [-900, WATER_LEVEL, bandsZ[i + 1]], colors[i], [0, 1, 0]);
  }
  // Hills: a coarse height grid around three sides of the city.
  const step = 12;
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    const h = (a[1] + b[1] + c[1]) / 3;
    const k = h > 16 ? ART.hillDark : rng.chance(0.3) ? ART.hillDark : ART.hill;
    far.tri(a, b, c, k, [0, 1, 0]);
  };
  for (let x = -330; x < 330; x += step) {
    for (let z = -330; z < 110; z += step) {
      const pts = [
        [x, z],
        [x + step, z],
        [x + step, z + step],
        [x, z + step],
      ].map(([px, pz]) => [px, hillHeight(px, pz), pz] as [number, number, number]);
      if (pts.every((p) => p[1] <= 0.01)) continue;
      // Keep hills behind the walls only.
      const cx = x + step / 2;
      const cz = z + step / 2;
      if (Math.abs(cx) < WALL_EAST_X + 2 && cz > WALL_NORTH_Z + 1) continue;
      tri(pts[0], pts[1], pts[2]);
      tri(pts[0], pts[2], pts[3]);
    }
  }
  // Hillside houses: small cream boxes with terracotta roofs, stepping up the slope.
  for (let i = 0; i < 60; i++) {
    const x = rng.range(-175, 175);
    const z = rng.range(-150, -100);
    const y = hillHeight(x, z);
    const w = rng.range(4, 7);
    const d = rng.range(4, 6);
    const h = rng.range(3, 5.5);
    const body = rng.pick([PALETTE.cream, PALETTE.white, PALETTE.blush, PALETTE.sand]);
    far.box(x, y + h / 2 - 0.5, z, w, h + 1, d, [body, body], { bottom: false });
    far.gable(x, y + h - 0.5, z, w, d, 1.8, rng.chance(0.8) ? PALETTE.roof : PALETTE.roofDark, body, true, 0.3);
  }
  // Distant ridge silhouette for depth.
  for (let x = -900; x < 900; x += 60) {
    const h0 = 40 + Math.sin(x * 0.01) * 18 + Math.cos(x * 0.023) * 10;
    const h1 = 40 + Math.sin((x + 60) * 0.01) * 18 + Math.cos((x + 60) * 0.023) * 10;
    far.quad([x, 0, -520], [x + 60, 0, -520], [x + 60, h1, -540], [x, h0, -540], "#b7c7b2", [0, 0.3, 1]);
  }
}
