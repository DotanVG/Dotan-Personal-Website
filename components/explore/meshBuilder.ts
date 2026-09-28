// Flat-shaded, vertex-coloured geometry builder for the low-poly world.
// Every face gets its own normal; faces are auto-oriented against an expected
// outward direction so callers never have to think about winding.

import * as THREE from "three";

type V3 = [number, number, number];

const colorCache = new Map<string, THREE.Color>();
export function col(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

export type Paint = string | THREE.Color;
const toColor = (p: Paint) => (typeof p === "string" ? col(p) : p);

/** Slightly lighten (k > 0) or darken (k < 0) a colour, returning a new Color. */
export function shade(paint: Paint, k: number): THREE.Color {
  const c = toColor(paint).clone();
  return k >= 0 ? c.lerp(new THREE.Color(1, 1, 1), k) : c.multiplyScalar(1 + k);
}


export class MeshBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  clr: number[] = [];
  tags: number[] = [];
  tag = 0;
  /** Optional transform applied to every added point: rotate about Y, then translate. */
  private tx = 0;
  private ty = 0;
  private tz = 0;
  private tc = 1;
  private ts = 0;

  get vertexCount() {
    return this.pos.length / 3;
  }

  setTransform(x: number, y: number, z: number, yaw = 0) {
    this.tx = x;
    this.ty = y;
    this.tz = z;
    this.tc = Math.cos(yaw);
    this.ts = Math.sin(yaw);
  }

  resetTransform() {
    this.setTransform(0, 0, 0, 0);
  }

  private xf(p: V3): V3 {
    const [x, y, z] = p;
    return [this.tx + x * this.tc + z * this.ts, this.ty + y, this.tz - x * this.ts + z * this.tc];
  }

  private xfDir(d: V3): V3 {
    const [x, y, z] = d;
    return [x * this.tc + z * this.ts, y, -x * this.ts + z * this.tc];
  }

  /** Triangle (local coordinates). `out` is the expected outward direction. */
  tri(a: V3, b: V3, c: V3, color: Paint, out?: V3) {
    let A = this.xf(a);
    let B = this.xf(b);
    const C = this.xf(c);
    let n = normal(A, B, C);
    if (out) {
      const o = this.xfDir(out);
      if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) {
        [A, B] = [B, A];
        n = [-n[0], -n[1], -n[2]];
      }
    }
    const k = toColor(color);
    for (const p of [A, B, C]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.clr.push(k.r, k.g, k.b);
      this.tags.push(this.tag);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: Paint, out?: V3) {
    this.tri(a, b, c, color, out);
    this.tri(a, c, d, color, out);
  }

  /**
   * Axis-aligned box in local space (then transformed). `color` may be a single
   * paint or [top, sides, bottom]. Bottom faces are skipped when `bottom` is false.
   */
  box(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    color: Paint | [Paint, Paint, Paint?],
    opts: { bottom?: boolean; yaw?: number; sides?: [Paint, Paint, Paint, Paint] } = {},
  ) {
    const [top, side, bottom] = Array.isArray(color) ? color : [color, color, color];
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const c = Math.cos(opts.yaw ?? 0);
    const s = Math.sin(opts.yaw ?? 0);
    const P = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const D = (x: number, y: number, z: number): V3 => [x * c + z * s, y, -x * s + z * c];
    const [sPZ, sPX, sNZ, sNX] = opts.sides ?? [side, side, side, side];
    this.quad(P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz), top, [0, 1, 0]);
    if (opts.bottom !== false && bottom)
      this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), bottom, [0, -1, 0]);
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), sPZ, D(0, 0, 1));
    this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), sNZ, D(0, 0, -1));
    this.quad(P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz), sPX, D(1, 0, 0));
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), sNX, D(-1, 0, 0));
  }

  /** Gable roof over a rectangle; ridge runs along X when `ridgeX`, else along Z. */
  gable(cx: number, y: number, cz: number, sx: number, sz: number, h: number, roof: Paint, gableEnd: Paint, ridgeX = true, overhang = 0.35) {
    const hx = sx / 2 + (ridgeX ? overhang * 0.6 : overhang);
    const hz = sz / 2 + (ridgeX ? overhang : overhang * 0.6);
    if (ridgeX) {
      const a: V3 = [cx - hx, y, cz - hz];
      const b: V3 = [cx + hx, y, cz - hz];
      const c: V3 = [cx + hx, y, cz + hz];
      const d: V3 = [cx - hx, y, cz + hz];
      const r0: V3 = [cx - hx, y + h, cz];
      const r1: V3 = [cx + hx, y + h, cz];
      this.quad(a, b, r1, r0, roof, [0, 1, -1]);
      this.quad(d, c, r1, r0, shade(roof, -0.08), [0, 1, 1]);
      this.tri([cx - sx / 2, y, cz - sz / 2], [cx - sx / 2, y, cz + sz / 2], [cx - sx / 2, y + h * (sz / 2 / hz), cz], gableEnd, [-1, 0, 0]);
      this.tri([cx + sx / 2, y, cz - sz / 2], [cx + sx / 2, y, cz + sz / 2], [cx + sx / 2, y + h * (sz / 2 / hz), cz], gableEnd, [1, 0, 0]);
    } else {
      const a: V3 = [cx - hx, y, cz - hz];
      const b: V3 = [cx - hx, y, cz + hz];
      const c: V3 = [cx + hx, y, cz + hz];
      const d: V3 = [cx + hx, y, cz - hz];
      const r0: V3 = [cx, y + h, cz - hz];
      const r1: V3 = [cx, y + h, cz + hz];
      this.quad(a, b, r1, r0, roof, [-1, 1, 0]);
      this.quad(d, c, r1, r0, shade(roof, -0.08), [1, 1, 0]);
      this.tri([cx - sx / 2, y, cz - sz / 2], [cx + sx / 2, y, cz - sz / 2], [cx, y + h * (sx / 2 / hx), cz - sz / 2], gableEnd, [0, 0, -1]);
      this.tri([cx - sx / 2, y, cz + sz / 2], [cx + sx / 2, y, cz + sz / 2], [cx, y + h * (sx / 2 / hx), cz + sz / 2], gableEnd, [0, 0, 1]);
    }
  }

  /** Vertical cylinder / truncated cone with flat caps. */
  cylinder(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, seg: number, color: Paint, capColor?: Paint, rot = 0) {
    for (let i = 0; i < seg; i++) {
      const a0 = rot + (i / seg) * Math.PI * 2;
      const a1 = rot + ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p0: V3 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0];
      const p1: V3 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
      const q1: V3 = [cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1];
      const q0: V3 = [cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1];
      const outward: V3 = [Math.cos(am), 0, Math.sin(am)];
      if (r1 > 1e-4) this.quad(p0, p1, q1, q0, color, outward);
      else this.tri(p0, p1, [cx, y0 + h, cz], color, outward);
      if (capColor !== undefined && r1 > 1e-4) this.tri([cx, y0 + h, cz], q0, q1, capColor, [0, 1, 0]);
    }
  }

  /** Low-poly blob (icosahedron-ish via stacked rings), for tree crowns and rocks. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: Paint, seg = 6, jitter?: () => number) {
    const rings = 3;
    const pts: V3[][] = [];
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const ring: V3[] = [];
      for (let i = 0; i < seg; i++) {
        const th = (i / seg) * Math.PI * 2 + (r % 2) * (Math.PI / seg);
        const j = jitter ? 1 + jitter() : 1;
        ring.push([cx + Math.sin(phi) * Math.cos(th) * rx * j, cy + Math.cos(phi) * ry, cz + Math.sin(phi) * Math.sin(th) * rz * j]);
      }
      pts.push(ring);
    }
    const lit = toColor(color);
    const dark = lit.clone().multiplyScalar(0.86);
    for (let r = 0; r < rings; r++) {
      for (let i = 0; i < seg; i++) {
        const a = pts[r][i];
        const b = pts[r][(i + 1) % seg];
        const c = pts[r + 1][(i + 1) % seg];
        const d = pts[r + 1][i];
        const mid: V3 = [(a[0] + c[0]) / 2 - cx, (a[1] + c[1]) / 2 - cy, (a[2] + c[2]) / 2 - cz];
        const k = r === 0 ? lit : r === rings - 1 ? dark : i % 2 ? lit : dark;
        if (r === 0) this.tri(a, c, d, k, mid);
        else if (r === rings - 1) this.tri(a, b, d, k, mid);
        else this.quad(a, b, c, d, k, mid);
      }
    }
  }

  /**
   * Extrude a convex polygon given in (z, y) across x0..x1. `edgeColors[i]`
   * colours the face between point i and i+1; caps use `capColor`.
   */
  extrudeX(poly: [number, number][], x0: number, x1: number, capColor: Paint, edgeColors: Paint[] | Paint) {
    const n = poly.length;
    let cz = 0;
    let cy = 0;
    for (const [z, y] of poly) {
      cz += z / n;
      cy += y / n;
    }
    for (let i = 1; i < n - 1; i++) {
      const [z0, y0] = poly[0];
      const [za, ya] = poly[i];
      const [zb, yb] = poly[i + 1];
      this.tri([x0, y0, z0], [x0, ya, za], [x0, yb, zb], capColor, [-1, 0, 0]);
      this.tri([x1, y0, z0], [x1, ya, za], [x1, yb, zb], capColor, [1, 0, 0]);
    }
    for (let i = 0; i < n; i++) {
      const [za, ya] = poly[i];
      const [zb, yb] = poly[(i + 1) % n];
      const color = Array.isArray(edgeColors) ? edgeColors[i] : edgeColors;
      const mz = (za + zb) / 2 - cz;
      const my = (ya + yb) / 2 - cy;
      this.quad([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], color, [0, my, mz]);
    }
  }

  /** Flat polygon at height y facing up (convex, fan triangulated). */
  polyTop(pts: [number, number][], y: number, color: Paint) {
    for (let i = 1; i < pts.length - 1; i++) {
      this.tri([pts[0][0], y, pts[0][1]], [pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], color, [0, 1, 0]);
    }
  }

  /** Vertical wall strip along a closed polygon outline from y0 to y1 (e.g. a kerb). */
  polyWall(pts: [number, number][], y0: number, y1: number, color: Paint) {
    let cx = 0;
    let cz = 0;
    for (const [x, z] of pts) {
      cx += x / pts.length;
      cz += z / pts.length;
    }
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const mx = (ax + bx) / 2 - cx;
      const mz = (az + bz) / 2 - cz;
      this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], color, [mx, 0, mz]);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.clr, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function normal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  return [nx, ny, nz];
}

/** Rounded rectangle outline, traversed corner to corner, for kerbed blocks. */
export function roundedRect(x0: number, z0: number, x1: number, z1: number, r: number, seg = 4): [number, number][] {
  const pts: [number, number][] = [];
  // Each corner arc sweeps a quarter turn clockwise from its start angle.
  const corners: [number, number, number][] = [
    [x1 - r, z1 - r, Math.PI / 2],
    [x1 - r, z0 + r, 0],
    [x0 + r, z0 + r, -Math.PI / 2],
    [x0 + r, z1 - r, -Math.PI],
  ];
  for (const [cx, cz, t0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const t = t0 - (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
  }
  return pts;
}
