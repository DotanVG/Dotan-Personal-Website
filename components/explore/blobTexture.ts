"use client";

import * as THREE from "three";

export function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(40,30,25,0.55)");
  grad.addColorStop(0.6, "rgba(40,30,25,0.28)");
  grad.addColorStop(1, "rgba(40,30,25,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
