// 2D collision primitives on the ground plane (X/Z) plus a static broadphase grid.
// Heights are handled separately: every static collider has a `top`, so things
// flying above it (a jumping car, the player on a ramp) pass over.

export type BoxShape = {
  x: number;
  z: number;
  /** Half extent along the box's local X (its "left" axis). */
  hx: number;
  /** Half extent along the box's local Z (its "forward" axis). */
  hz: number;
  yaw: number;
};

export type StaticCollider =
  | (BoxShape & { shape: "box"; top: number; id: number; lamp?: never })
  | {
      shape: "circle";
      x: number;
      z: number;
      r: number;
      top: number;
      id: number;
      hx?: never;
      /** Street lamp instance index: fast hits knock it over instead of stopping the car. */
      lamp?: number;
    };

/** Contact normal points from B toward A, i.e. the direction to push A out. */
export type Contact = { nx: number; nz: number; depth: number; px: number; pz: number };

export const newContact = (): Contact => ({ nx: 0, nz: 0, depth: 0, px: 0, pz: 0 });

const cornersA = new Float64Array(8);
const cornersB = new Float64Array(8);
const axes = new Float64Array(8);

function writeCorners(b: BoxShape, out: Float64Array) {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  // local X axis = (c, -s), local Z axis = (s, c)
  const xc = b.hx * c;
  const xs = b.hx * s;
  const zc = b.hz * c;
  const zs = b.hz * s;
  out[0] = b.x - xc - zs;
  out[1] = b.z + xs - zc;
  out[2] = b.x - xc + zs;
  out[3] = b.z + xs + zc;
  out[4] = b.x + xc - zs;
  out[5] = b.z - xs - zc;
  out[6] = b.x + xc + zs;
  out[7] = b.z - xs + zc;
}

/** Is world point inside box (with a small tolerance)? */
export function pointInBox(b: BoxShape, px: number, pz: number, pad = 0): boolean {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const dx = px - b.x;
  const dz = pz - b.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad;
}

function project(b: BoxShape, ax: number, az: number): number {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return b.hx * Math.abs(c * ax - s * az) + b.hz * Math.abs(s * ax + c * az);
}

/** Separating-axis test for two oriented boxes. Writes the minimum translation into `out`. */
export function boxBox(a: BoxShape, b: BoxShape, out: Contact): boolean {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const ca = Math.cos(a.yaw);
  const sa = Math.sin(a.yaw);
  const cb = Math.cos(b.yaw);
  const sb = Math.sin(b.yaw);
  axes[0] = ca;
  axes[1] = -sa;
  axes[2] = sa;
  axes[3] = ca;
  axes[4] = cb;
  axes[5] = -sb;
  axes[6] = sb;
  axes[7] = cb;
  let best = Infinity;
  let bnx = 0;
  let bnz = 0;
  for (let i = 0; i < 8; i += 2) {
    const nx = axes[i];
    const nz = axes[i + 1];
    const dist = dx * nx + dz * nz;
    const overlap = project(a, nx, nz) + project(b, nx, nz) - Math.abs(dist);
    if (overlap <= 0) return false;
    if (overlap < best) {
      best = overlap;
      const sign = dist >= 0 ? 1 : -1;
      bnx = nx * sign;
      bnz = nz * sign;
    }
  }
  // Contact point: average of corners of each box that lie inside the other.
  writeCorners(a, cornersA);
  writeCorners(b, cornersB);
  let px = 0;
  let pz = 0;
  let n = 0;
  for (let i = 0; i < 8; i += 2) {
    if (pointInBox(b, cornersA[i], cornersA[i + 1], 0.02)) {
      px += cornersA[i];
      pz += cornersA[i + 1];
      n++;
    }
    if (pointInBox(a, cornersB[i], cornersB[i + 1], 0.02)) {
      px += cornersB[i];
      pz += cornersB[i + 1];
      n++;
    }
  }
  if (n === 0) {
    px = (a.x + b.x) / 2;
    pz = (a.z + b.z) / 2;
  } else {
    px /= n;
    pz /= n;
  }
  out.nx = bnx;
  out.nz = bnz;
  out.depth = best;
  out.px = px;
  out.pz = pz;
  return true;
}

/** Circle (A) against oriented box (B). Normal pushes the circle out. */
export function circleBox(cx: number, cz: number, r: number, b: BoxShape, out: Contact): boolean {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const dx = cx - b.x;
  const dz = cz - b.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx));
  const qz = Math.max(-b.hz, Math.min(b.hz, lz));
  let nlx = lx - qx;
  let nlz = lz - qz;
  let d = Math.hypot(nlx, nlz);
  let depth: number;
  if (d > 1e-6) {
    if (d >= r) return false;
    depth = r - d;
    nlx /= d;
    nlz /= d;
  } else {
    // Centre inside the box: push out along the shallowest face.
    const ox = b.hx - Math.abs(lx);
    const oz = b.hz - Math.abs(lz);
    if (ox < oz) {
      nlx = lx >= 0 ? 1 : -1;
      nlz = 0;
      depth = ox + r;
    } else {
      nlx = 0;
      nlz = lz >= 0 ? 1 : -1;
      depth = oz + r;
    }
    d = 0;
  }
  // local -> world: x = lx*c + lz*s, z = -lx*s + lz*c
  out.nx = nlx * c + nlz * s;
  out.nz = -nlx * s + nlz * c;
  out.depth = depth;
  out.px = b.x + qx * c + qz * s;
  out.pz = b.z - qx * s + qz * c;
  return true;
}

export function circleCircle(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
  out: Contact,
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const d = Math.hypot(dx, dz);
  const rr = ar + br;
  if (d >= rr) return false;
  if (d < 1e-6) {
    out.nx = 1;
    out.nz = 0;
  } else {
    out.nx = dx / d;
    out.nz = dz / d;
  }
  out.depth = rr - d;
  out.px = bx + out.nx * br;
  out.pz = bz + out.nz * br;
  return true;
}

/** Oriented box (A) against circle (B). */
export function boxCircle(a: BoxShape, cx: number, cz: number, r: number, out: Contact): boolean {
  if (!circleBox(cx, cz, r, a, out)) return false;
  out.nx = -out.nx;
  out.nz = -out.nz;
  return true;
}

/** First hit fraction (0..1) of segment P0->P1 against an oriented box, or -1. */
export function segmentBox(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  b: BoxShape,
  pad = 0,
): number {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const ax = (x0 - b.x) * c - (z0 - b.z) * s;
  const az = (x0 - b.x) * s + (z0 - b.z) * c;
  const bx = (x1 - b.x) * c - (z1 - b.z) * s;
  const bz = (x1 - b.x) * s + (z1 - b.z) * c;
  return slab2(ax, az, bx - ax, bz - az, b.hx + pad, b.hz + pad);
}

const slab = { t0: 0, t1: 1 };

/** Clip [slab.t0, slab.t1] against one axis slab. Returns false when empty. */
function clipSlab(o: number, d: number, lo: number, hi: number): boolean {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let ta = (lo - o) / d;
  let tb = (hi - o) / d;
  if (ta > tb) {
    const t = ta;
    ta = tb;
    tb = t;
  }
  if (ta > slab.t0) slab.t0 = ta;
  if (tb < slab.t1) slab.t1 = tb;
  return slab.t0 <= slab.t1;
}

function slab2(ox: number, oz: number, dx: number, dz: number, hx: number, hz: number): number {
  slab.t0 = 0;
  slab.t1 = 1;
  if (!clipSlab(ox, dx, -hx, hx) || !clipSlab(oz, dz, -hz, hz)) return -1;
  return slab.t0;
}

/**
 * First hit fraction of a 3D segment against an oriented box standing between
 * `bottom` and `top`, or -1. Used for camera obstruction.
 */
export function segmentBox3(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  b: BoxShape,
  bottom: number,
  top: number,
): number {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const ax = (x0 - b.x) * c - (z0 - b.z) * s;
  const az = (x0 - b.x) * s + (z0 - b.z) * c;
  const bx = (x1 - b.x) * c - (z1 - b.z) * s;
  const bz = (x1 - b.x) * s + (z1 - b.z) * c;
  slab.t0 = 0;
  slab.t1 = 1;
  if (!clipSlab(ax, bx - ax, -b.hx, b.hx)) return -1;
  if (!clipSlab(az, bz - az, -b.hz, b.hz)) return -1;
  if (!clipSlab(y0, y1 - y0, bottom, top)) return -1;
  return slab.t0;
}

export function segmentCircle(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  r: number,
): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const fx = x0 - cx;
  const fz = z0 - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  if (c <= 0) return 0;
  if (a < 1e-12) return -1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/**
 * Uniform grid over static colliders. Queries call back each collider at most once.
 */
export class StaticGrid {
  readonly colliders: StaticCollider[];
  readonly cell: number;
  private minX: number;
  private minZ: number;
  private cols: number;
  private rows: number;
  private cells: number[][];
  private stamp: Uint32Array;
  private query = 0;

  constructor(colliders: StaticCollider[], cell = 12) {
    this.colliders = colliders;
    this.cell = cell;
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const c of colliders) {
      const r = radiusOf(c);
      minX = Math.min(minX, c.x - r);
      minZ = Math.min(minZ, c.z - r);
      maxX = Math.max(maxX, c.x + r);
      maxZ = Math.max(maxZ, c.z + r);
    }
    if (!colliders.length) {
      minX = minZ = 0;
      maxX = maxZ = 1;
    }
    this.minX = minX;
    this.minZ = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    this.stamp = new Uint32Array(colliders.length);
    colliders.forEach((c, i) => {
      const r = radiusOf(c);
      this.visitCells(c.x - r, c.z - r, c.x + r, c.z + r, (ci) => this.cells[ci].push(i));
    });
  }

  private visitCells(x0: number, z0: number, x1: number, z1: number, fn: (i: number) => void) {
    const c0 = Math.max(0, Math.floor((x0 - this.minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 - this.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((z0 - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((z1 - this.minZ) / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * this.cols + c);
  }

  forEachNear(x0: number, z0: number, x1: number, z1: number, fn: (c: StaticCollider) => void) {
    const q = ++this.query;
    this.visitCells(x0, z0, x1, z1, (ci) => {
      for (const idx of this.cells[ci]) {
        if (this.stamp[idx] === q) continue;
        this.stamp[idx] = q;
        fn(this.colliders[idx]);
      }
    });
  }
}

export function radiusOf(c: StaticCollider): number {
  return c.shape === "box" ? Math.hypot(c.hx, c.hz) : c.r;
}
