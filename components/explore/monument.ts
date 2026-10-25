// Mission meshes for the explore chunk only. statueModel() is the trainer-model swap point.

import * as THREE from "three";
import { MeshBuilder } from "./meshBuilder";

const SKIN = "#e2ae86";
const HAIR = "#3a2a21";
const SHIRT = "#2b7f8e";
const PANTS = "#2d3548";
const SHOE = "#f3efe6";
const PACK = "#e3b04b";

/** Mini-Dotan on a plinth, in the same colours as the walking avatar. Swap the trainer model in here. */
export function statueModel(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  b.box(0, 0.28, 0, 1.16, 0.56, 1.16, ["#e7dcc6", "#cfc6b4"]);
  b.box(0, 0.6, 0, 0.94, 0.1, 0.94, "#e3b04b");
  const y = 0.66;
  b.box(0.09, y + 0.36, 0, 0.16, 0.72, 0.2, PANTS);
  b.box(-0.09, y + 0.36, 0, 0.16, 0.72, 0.2, PANTS);
  b.box(0.09, y + 0.05, 0.04, 0.18, 0.1, 0.28, SHOE);
  b.box(-0.09, y + 0.05, 0.04, 0.18, 0.1, 0.28, SHOE);
  b.box(0, y + 0.95, 0, 0.46, 0.5, 0.26, SHIRT);
  b.box(0, y + 0.7, 0, 0.4, 0.1, 0.24, PANTS);
  b.box(0, y + 0.98, -0.18, 0.32, 0.36, 0.14, PACK);
  b.box(0.28, y + 0.88, 0, 0.12, 0.42, 0.13, SHIRT);
  b.box(-0.28, y + 0.88, 0, 0.12, 0.42, 0.13, SHIRT);
  b.box(0.28, y + 0.64, 0, 0.1, 0.12, 0.11, SKIN);
  b.box(-0.28, y + 0.64, 0, 0.1, 0.12, 0.11, SKIN);
  b.box(0, y + 1.38, 0, 0.3, 0.3, 0.28, SKIN);
  b.box(0, y + 1.52, -0.01, 0.32, 0.1, 0.3, HAIR);
  b.box(0, y + 1.4, -0.12, 0.32, 0.2, 0.08, HAIR);
  b.box(0.07, y + 1.42, 0.14, 0.04, 0.04, 0.02, "#2a2320");
  b.box(-0.07, y + 1.42, 0.14, 0.04, 0.04, 0.02, "#2a2320");
  return b.build();
}

export function bannerGeometry(spots: { x: number; z: number; y: number; face: number }[]): THREE.BufferGeometry | null {
  if (!spots.length) return null;
  const b = new MeshBuilder();
  for (const s of spots) {
    const nx = s.face === 1 ? 1 : s.face === 3 ? -1 : 0;
    const nz = s.face === 0 ? 1 : s.face === 2 ? -1 : 0;
    b.setTransform(s.x, s.y, s.z, Math.atan2(nx, nz));
    b.box(0, 1.1, 0, 0.08, 2.2, 0.08, "#f7f2e8");
    b.box(0.62, 1.85, 0, 1.15, 0.48, 0.05, "#b3402c");
    b.box(0.62, 1.85, 0.04, 0.9, 0.28, 0.02, "#f3e6cb");
  }
  return b.build();
}

/** One cone. The component lays it on its side and spins it. */
export function beamModel(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.2, 1.25, 14, 8, "#fff6d2");
  return b.build();
}

export function pillarModel(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  b.cylinder(0, 0, 0, 0.45, 0.08, 8.5, 7, "#fff3c4");
  return b.build();
}
