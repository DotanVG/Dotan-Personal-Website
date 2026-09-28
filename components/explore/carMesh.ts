// Low-poly car bodies built from extruded side profiles. Each car gets its own
// small geometry (a few hundred vertices) so paint, dents, detached parts and
// cracked glass are real geometry changes, not just a condition number.

import * as THREE from "three";
import type { Dent } from "@/lib/game/sim";
import { VEHICLE_SPECS, type VehicleKind } from "@/lib/game/vehicle";
import { MeshBuilder, col } from "./meshBuilder";

export const TAG = {
  body: 0,
  frontBumper: 1,
  rearBumper: 2,
  mirrorL: 4,
  mirrorR: 8,
  hood: 16,
  tail: 32,
  head: 64,
  windshield: 128,
} as const;

// A sentinel colour marks paintable faces in the template.
const PAINT = new THREE.Color(1, 0, 1);
const GLASS = "#2f4652";
const GLASS_SIDE = "#39525f";
const TRIM = "#2c2f35";
const UNDER = "#24262b";
const TAIL = "#9b2c24";
const HEAD = "#fff1cf";

type Profile = {
  lower: [number, number][];
  cabin: [number, number][];
  /** Which cabin edges are glass (windshield, rear window). */
  cabinGlass: boolean[];
  side: [number, number][];
  cabinInset: number;
  pillarZ?: number;
  spoiler?: boolean;
  stripe?: [number, number, number, number];
};

const PROFILES: Record<VehicleKind, Profile> = {
  hatch: {
    lower: [[-1.9, 0.3], [1.9, 0.3], [1.95, 0.55], [1.82, 0.78], [-1.86, 0.84], [-1.93, 0.58]],
    cabin: [[1.0, 0.8], [0.2, 1.42], [-1.45, 1.44], [-1.84, 0.84]],
    cabinGlass: [true, false, true, false],
    side: [[0.88, 0.88], [0.24, 1.34], [-1.36, 1.36], [-1.7, 0.9]],
    cabinInset: 0.08,
    pillarZ: -0.45,
  },
  sedan: {
    lower: [[-2.2, 0.32], [2.2, 0.32], [2.26, 0.58], [2.12, 0.78], [-2.18, 0.84], [-2.26, 0.6]],
    cabin: [[1.05, 0.8], [0.25, 1.4], [-0.9, 1.41], [-1.62, 0.84]],
    cabinGlass: [true, false, true, false],
    side: [[0.92, 0.88], [0.26, 1.33], [-0.86, 1.34], [-1.46, 0.9]],
    cabinInset: 0.1,
    pillarZ: -0.3,
  },
  coupe: {
    lower: [[-2.08, 0.26], [2.08, 0.26], [2.16, 0.48], [2.02, 0.62], [-2.0, 0.72], [-2.13, 0.52]],
    cabin: [[0.72, 0.64], [-0.1, 1.18], [-0.8, 1.19], [-1.85, 0.72]],
    cabinGlass: [true, false, true, false],
    side: [[0.6, 0.7], [-0.1, 1.12], [-0.78, 1.13], [-1.56, 0.75]],
    cabinInset: 0.13,
    spoiler: true,
  },
  van: {
    lower: [[-2.52, 0.36], [2.52, 0.36], [2.58, 0.72], [2.42, 1.02], [-2.52, 1.05], [-2.58, 0.72]],
    cabin: [[2.35, 1.02], [1.75, 2.12], [-2.5, 2.22], [-2.55, 1.05]],
    cabinGlass: [true, false, false, false],
    side: [[2.2, 1.12], [1.76, 1.92], [1.0, 1.92], [1.0, 1.12]],
    cabinInset: 0.02,
    stripe: [-2.4, 0.8, 1.3, 1.52],
  },
};

export type CarTemplate = {
  geometry: THREE.BufferGeometry;
  paintIdx: Uint32Array;
  tags: Uint16Array;
  basePos: Float32Array;
  baseCol: Float32Array;
};

const templates = new Map<VehicleKind, CarTemplate>();

export function carTemplate(kind: VehicleKind): CarTemplate {
  let t = templates.get(kind);
  if (!t) {
    t = buildTemplate(kind);
    templates.set(kind, t);
  }
  return t;
}

function lerpY(poly: [number, number][], i: number, z: number) {
  const [za, ya] = poly[i];
  const [zb, yb] = poly[(i + 1) % poly.length];
  return ya + ((yb - ya) * (z - za)) / (zb - za || 1);
}

function buildTemplate(kind: VehicleKind): CarTemplate {
  const spec = VEHICLE_SPECS[kind];
  const p = PROFILES[kind];
  const hw = spec.halfWidth;
  const b = new MeshBuilder();
  const cw = hw - p.cabinInset;

  // Lower body: underside dark, everything else paint.
  b.tag = TAG.body;
  b.extrudeX(p.lower, -hw, hw, PAINT, p.lower.map((_, i) => (i === 0 ? UNDER : PAINT)));
  // Glasshouse.
  b.extrudeX(p.cabin, -cw, cw, PAINT, p.cabin.map((_, i) => (p.cabinGlass[i] ? GLASS : PAINT)));
  // Windshield overlay (tagged so damage can crack it).
  b.tag = TAG.windshield;
  {
    // Offset a hair outward from the windshield face, inset from its edges.
    const [a, c] = [p.cabin[0], p.cabin[1]];
    const dz = c[0] - a[0];
    const dy = c[1] - a[1];
    const l = Math.hypot(dz, dy);
    const oz = (dy / l) * 0.012;
    const oy = (-dz / l) * 0.012;
    const lo = (t: number): [number, number] => [a[0] + dz * t + oz, a[1] + dy * t + oy];
    const [z0, y0] = lo(0.06);
    const [z1, y1] = lo(0.94);
    b.quad([-cw + 0.06, y0, z0], [cw - 0.06, y0, z0], [cw - 0.06, y1, z1], [-cw + 0.06, y1, z1], GLASS, [0, -dz, dy]);
  }
  b.tag = TAG.body;
  // Side windows on both sides, slightly proud of the cabin sides.
  for (const s of [-1, 1]) {
    const x = s * (cw + 0.01);
    for (let i = 1; i < p.side.length - 1; i++) {
      const [z0, y0] = p.side[0];
      const [z1, y1] = p.side[i];
      const [z2, y2] = p.side[i + 1];
      b.tri([x, y0, z0], [x, y1, z1], [x, y2, z2], GLASS_SIDE, [s, 0, 0]);
    }
    if (p.pillarZ !== undefined) {
      const yTop = Math.min(p.side[1][1], p.side[2][1]);
      b.quad([x + s * 0.005, p.side[0][1], p.pillarZ - 0.06], [x + s * 0.005, p.side[0][1], p.pillarZ + 0.06], [x + s * 0.005, yTop, p.pillarZ + 0.06], [x + s * 0.005, yTop, p.pillarZ - 0.06], PAINT, [s, 0, 0]);
    }
  }
  // Wheel arches.
  const wz = spec.wheelbase / 2;
  const r = spec.wheelRadius;
  for (const s of [-1, 1]) {
    for (const z of [wz, -wz]) {
      const x = s * (hw + 0.006);
      b.quad([x, 0.28, z - r * 1.18], [x, 0.28, z + r * 1.18], [x, r * 2 + 0.12, z + r * 0.9], [x, r * 2 + 0.12, z - r * 0.9], UNDER, [s, 0, 0]);
    }
  }
  if (p.stripe) {
    const [z0, z1, y0, y1] = p.stripe;
    for (const s of [-1, 1]) b.quad([s * (cw + 0.012), y0, z0], [s * (cw + 0.012), y0, z1], [s * (cw + 0.012), y1, z1], [s * (cw + 0.012), y1, z0], "#f2e6cf", [s, 0, 0]);
  }

  const front = p.lower[2][0];
  const rear = p.lower[5][0];
  const lightY = (p.lower[2][1] + p.lower[3][1]) / 2 - 0.04;
  // Grille.
  b.quad([-hw * 0.45, lightY - 0.12, front + 0.012], [hw * 0.45, lightY - 0.12, front + 0.012], [hw * 0.45, lightY + 0.06, front + 0.012], [-hw * 0.45, lightY + 0.06, front + 0.012], TRIM, [0, 0, 1]);
  // Headlights and tail lights.
  for (const s of [-1, 1]) {
    b.tag = TAG.head;
    b.box(s * (hw - 0.22), lightY, front - 0.01, 0.32, 0.14, 0.06, HEAD);
    b.tag = TAG.tail;
    b.box(s * (hw - 0.2), (p.lower[4][1] + p.lower[5][1]) / 2, rear + 0.01, 0.34, 0.13, 0.06, TAIL);
  }
  // Bumpers (detachable).
  b.tag = TAG.frontBumper;
  b.box(0, p.lower[0][1] + 0.1, p.lower[1][0] + 0.04, hw * 2 + 0.04, 0.2, 0.16, TRIM);
  b.tag = TAG.rearBumper;
  b.box(0, p.lower[0][1] + 0.1, p.lower[0][0] - 0.04, hw * 2 + 0.04, 0.2, 0.16, TRIM);
  // Mirrors (detachable).
  const mz = p.cabin[0][0] - 0.12;
  const my = p.cabin[0][1] + 0.12;
  b.tag = TAG.mirrorL;
  b.box(hw + 0.1, my, mz, 0.16, 0.12, 0.12, PAINT);
  b.tag = TAG.mirrorR;
  b.box(-hw - 0.1, my, mz, 0.16, 0.12, 0.12, PAINT);
  // Hood panel over a dark engine bay: the bay shows when the hood is torn off.
  b.tag = TAG.body;
  const hz0 = p.cabin[0][0] + 0.05;
  const hz1 = p.lower[3][0] - 0.03;
  const hy0 = lerpY(p.lower, 3, hz0);
  const hy1 = lerpY(p.lower, 3, hz1);
  if (hz1 > hz0 + 0.2) {
    b.quad([-hw + 0.08, hy0 + 0.004, hz0], [hw - 0.08, hy0 + 0.004, hz0], [hw - 0.08, hy1 + 0.004, hz1], [-hw + 0.08, hy1 + 0.004, hz1], UNDER, [0, 1, 0]);
    b.tag = TAG.hood;
    b.quad([-hw + 0.06, hy0 + 0.02, hz0], [hw - 0.06, hy0 + 0.02, hz0], [hw - 0.06, hy1 + 0.02, hz1], [-hw + 0.06, hy1 + 0.02, hz1], PAINT, [0, 1, 0]);
  }
  if (p.spoiler) {
    b.tag = TAG.rearBumper;
    b.box(0, p.lower[4][1] + 0.12, p.lower[4][0] + 0.12, hw * 1.7, 0.05, 0.3, TRIM);
  }

  const geometry = b.build();
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  const paint: number[] = [];
  for (let i = 0; i < colors.count; i++) {
    if (colors.getX(i) === PAINT.r && colors.getY(i) === PAINT.g && colors.getZ(i) === PAINT.b) paint.push(i);
  }
  return {
    geometry,
    paintIdx: new Uint32Array(paint),
    tags: new Uint16Array(b.tags),
    basePos: new Float32Array((geometry.getAttribute("position") as THREE.BufferAttribute).array),
    baseCol: new Float32Array(colors.array),
  };
}

/** One live car body: owns a clone of its template geometry. */
export class CarBody {
  readonly mesh: THREE.Mesh;
  readonly kind: VehicleKind;
  private t: CarTemplate;
  private paint = new THREE.Color();
  carId = -1;
  damageVersion = -1;
  /** Last frame this body was drawn (pool bookkeeping). */
  stamp = 0;
  wreckTone = false;

  constructor(kind: VehicleKind, material: THREE.Material) {
    this.kind = kind;
    this.t = carTemplate(kind);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.t.basePos.slice(), 3));
    g.setAttribute("normal", new THREE.BufferAttribute((this.t.geometry.getAttribute("normal").array as Float32Array).slice(), 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.t.baseCol.slice(), 3));
    g.boundingSphere = this.t.geometry.boundingSphere!.clone();
    g.boundingSphere.radius += 0.6;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** Reset to a pristine body in a new paint (pool reuse). */
  assign(carId: number, paintHex: string) {
    this.carId = carId;
    this.damageVersion = -1;
    this.wreckTone = false;
    this.paint.copy(col(paintHex));
    const g = this.mesh.geometry;
    (g.getAttribute("position").array as Float32Array).set(this.t.basePos);
    (g.getAttribute("normal").array as Float32Array).set(this.t.geometry.getAttribute("normal").array as Float32Array);
    (g.getAttribute("color").array as Float32Array).set(this.t.baseCol);
    this.writePaint(1);
    g.getAttribute("position").needsUpdate = true;
    g.getAttribute("normal").needsUpdate = true;
    g.getAttribute("color").needsUpdate = true;
  }

  private writePaint(k: number) {
    const c = (this.mesh.geometry.getAttribute("color").array as Float32Array);
    for (const i of this.t.paintIdx) {
      c[i * 3] = this.paint.r * k;
      c[i * 3 + 1] = this.paint.g * k;
      c[i * 3 + 2] = this.paint.b * k;
    }
  }

  private setTagColor(tag: number, hex: string, k = 1) {
    const c = this.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = c.array as Float32Array;
    const color = col(hex);
    for (let i = 0; i < this.t.tags.length; i++) {
      if (this.t.tags[i] !== tag) continue;
      arr[i * 3] = color.r * k;
      arr[i * 3 + 1] = color.g * k;
      arr[i * 3 + 2] = color.b * k;
    }
    c.needsUpdate = true;
  }

  /** Rebuild dents, detached parts, cracked glass and wreck tone from sim state. */
  applyDamage(dents: Dent[], detached: number, cracked: boolean, wrecked: boolean) {
    const g = this.mesh.geometry;
    const pos = g.getAttribute("position").array as Float32Array;
    pos.set(this.t.basePos);
    const tags = this.t.tags;
    for (const d of dents) {
      for (let i = 0; i < tags.length; i++) {
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];
        const dist = Math.hypot(x - d.lx, (y - d.ly) * 0.7, z - d.lz);
        if (dist >= d.radius) continue;
        const f = (1 - dist / d.radius) ** 2 * d.depth;
        pos[i * 3] += d.nx * f;
        pos[i * 3 + 2] += d.nz * f;
        pos[i * 3 + 1] -= f * 0.35;
      }
    }
    // Detached parts collapse to nothing (the sim spawns a debris piece).
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (t && t <= TAG.hood && t & detached) pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0;
    }
    g.getAttribute("position").needsUpdate = true;
    g.computeVertexNormals();
    if (cracked) this.setTagColor(TAG.windshield, "#c9d6dc");
    if (wrecked && !this.wreckTone) {
      this.wreckTone = true;
      this.writePaint(0.55);
      g.getAttribute("color").needsUpdate = true;
    }
  }
}

/** Where the tail lights sit on a body, for brake-light glows (x is per side). */
export function tailLightPos(kind: VehicleKind) {
  const p = PROFILES[kind];
  return { x: VEHICLE_SPECS[kind].halfWidth - 0.2, y: (p.lower[4][1] + p.lower[5][1]) / 2, z: p.lower[5][0] - 0.02 };
}

/** Shared wheel geometry: unit radius, unit width, axle along X. */
export function wheelGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  b.cylinder(0, -0.5, 0, 1, 1, 1, 10, "#26282d", "#26282d");
  b.cylinder(0, -0.52, 0, 0.55, 0.55, 1.04, 8, "#c9c4ba", "#c9c4ba");
  // Bottom caps (the cylinder helper only caps the top).
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2;
    const a1 = ((i + 1) / 10) * Math.PI * 2;
    b.tri([0, -0.5, 0], [Math.cos(a0), -0.5, Math.sin(a0)], [Math.cos(a1), -0.5, Math.sin(a1)], "#26282d", [0, -1, 0]);
  }
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    b.tri([0, -0.52, 0], [0.55 * Math.cos(a0), -0.52, 0.55 * Math.sin(a0)], [0.55 * Math.cos(a1), -0.52, 0.55 * Math.sin(a1)], "#c9c4ba", [0, -1, 0]);
  }
  const g = b.build();
  g.rotateZ(Math.PI / 2);
  return g;
}
