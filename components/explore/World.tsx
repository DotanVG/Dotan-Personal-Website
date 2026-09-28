"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { experience } from "@/content/experience";
import { education } from "@/content/education";
import { CURB_HEIGHT, type City, type Landmark } from "@/lib/game/city";
import { INSPECT_RADIUS_M } from "@/lib/game/sim";
import { SUN_DIR, buildCityGeometry } from "./cityMesh";
import { MeshBuilder } from "./meshBuilder";
import { FRAME_ORDER, useGame, useGameFrame } from "./gameContext";

const SKY_TOP = new THREE.Color("#5f9fd3");
const SKY_MID = new THREE.Color("#a9cde6");
const SKY_HORIZON = new THREE.Color("#f4dcb6");
export const FOG_COLOR = "#eed9b9";

/** Everything static: sky, light, the city meshes, trees, lamps and landmark signs. */
export function World({ city }: { city: City }) {
  const { quality } = useGame();
  const geo = useMemo(() => buildCityGeometry(city), [city]);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(
    () => () => {
      geo.chunks.forEach((g) => g.dispose());
      geo.ground.dispose();
      geo.far.dispose();
      material.dispose();
    },
    [geo, material],
  );
  return (
    <>
      <Sky />
      <Sun shadowSize={quality === "high" ? 2048 : 1024} extent={quality === "high" ? 58 : 42} shadows={quality !== "minimal"} />
      <hemisphereLight args={["#e6edf1", "#e2c69e", 2.2]} />
      <fog attach="fog" args={[FOG_COLOR, 120, 480]} />
      <mesh geometry={geo.ground} material={material} receiveShadow matrixAutoUpdate={false} />
      <mesh geometry={geo.far} material={material} matrixAutoUpdate={false} />
      {geo.chunks.map((g, i) => (
        <mesh key={i} geometry={g} material={material} castShadow receiveShadow matrixAutoUpdate={false} />
      ))}
      <Trees geo={geo} />
      <Lamps matrices={geo.lamps} />
      {city.landmarks.map((l) => (
        <LandmarkSign key={l.slug} landmark={l} />
      ))}
      <Pads landmarks={city.landmarks} />
    </>
  );
}

function Sky() {
  const ref = useRef<THREE.Group>(null);
  const { geometry, material, sunGeo, sunMat, haloMat } = useMemo(() => {
    const geometry = new THREE.SphereGeometry(800, 32, 16);
    const pos = geometry.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 800;
      if (y < 0.02) c.copy(SKY_HORIZON);
      else if (y < 0.28) c.copy(SKY_HORIZON).lerp(SKY_MID, (y - 0.02) / 0.26);
      else c.copy(SKY_MID).lerp(SKY_TOP, Math.min(1, (y - 0.28) / 0.6));
      c.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const sunGeo = new THREE.CircleGeometry(1, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: "#fff4d6", fog: false, depthWrite: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: "#ffe2ad", fog: false, transparent: true, opacity: 0.35, depthWrite: false });
    return { geometry, material, sunGeo, sunMat, haloMat };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      haloMat.dispose();
    },
    [geometry, material, sunGeo, sunMat, haloMat],
  );
  useGameFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  }, FRAME_ORDER.effects);
  const sunPos = SUN_DIR.clone().multiplyScalar(700);
  return (
    <group ref={ref}>
      <mesh geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />
      <mesh geometry={sunGeo} material={haloMat} position={sunPos} scale={70} renderOrder={-9} onUpdate={(m) => m.lookAt(0, 0, 0)} />
      <mesh geometry={sunGeo} material={sunMat} position={sunPos} scale={26} renderOrder={-8} onUpdate={(m) => m.lookAt(0, 0, 0)} />
    </group>
  );
}

/** One warm, low sun. The shadow camera follows the action and snaps to texels. */
function Sun({ shadowSize, extent, shadows }: { shadowSize: number; extent: number; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    l.shadow.map?.dispose();
    l.shadow.map = null;
    l.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = l.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 320;
    cam.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
    };
  }, [scene, shadowSize, extent]);
  useGameFrame(({ g }) => {
    const l = light.current;
    if (!l) return;
    // Focus slightly ahead of the player so the visible area is covered.
    const p = g.player;
    const texel = (extent * 2) / shadowSize;
    const fx = Math.round((p.x + Math.sin(p.facing) * 10) / texel) * texel;
    const fz = Math.round((p.z + Math.cos(p.facing) * 10) / texel) * texel;
    l.target.position.set(fx, 0, fz);
    l.position.set(fx + SUN_DIR.x * 150, SUN_DIR.y * 150, fz + SUN_DIR.z * 150);
    l.target.updateMatrixWorld();
  }, FRAME_ORDER.camera + 1);
  return (
    <directionalLight
      ref={light}
      color="#ffd8a8"
      intensity={3.0}
      castShadow={shadows}
      shadow-bias={-0.0004}
      shadow-normalBias={0.05}
    />
  );
}

function treeGeometries() {
  const trunk = "#8a6446";
  const round = new MeshBuilder();
  round.cylinder(0, 0, 0, 0.2, 0.16, 1.6, 5, trunk);
  round.blob(0, 2.6, 0, 1.55, 1.35, 1.55, "#86ad68", 7);
  round.blob(0.5, 3.3, -0.3, 0.9, 0.8, 0.9, "#97bd77", 6);
  const cone = new MeshBuilder();
  cone.cylinder(0, 0, 0, 0.18, 0.14, 1.2, 5, trunk);
  cone.cylinder(0, 1.0, 0, 1.4, 0, 2.4, 7, "#6f9a5c");
  cone.cylinder(0, 2.3, 0, 1.05, 0, 2.0, 7, "#7ea866");
  const palm = new MeshBuilder();
  let x = 0;
  let y = 0;
  for (let i = 0; i < 6; i++) {
    palm.cylinder(x, y, 0, 0.19 - i * 0.015, 0.17 - i * 0.015, 1.05, 6, i % 2 ? "#a17c56" : "#8f6b48");
    x += 0.09 + i * 0.03;
    y += 1.0;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const ex = x + Math.cos(a) * 2.4;
    const ez = Math.sin(a) * 2.4;
    const ey = y - 0.9;
    palm.tri([x, y + 0.15, 0], [ex, ey, ez], [x + Math.cos(a + 0.35) * 1.1, y + 0.25, Math.sin(a + 0.35) * 1.1], "#6f9a4f", [0, 1, 0]);
    palm.tri([x, y + 0.15, 0], [ex, ey, ez], [x + Math.cos(a - 0.35) * 1.1, y + 0.25, Math.sin(a - 0.35) * 1.1], "#5f8a44", [0, 1, 0]);
  }
  palm.blob(x, y, 0, 0.35, 0.3, 0.35, "#7a5a3c", 5);
  return { round: round.build(), cone: cone.build(), palm: palm.build() };
}

function Trees({ geo }: { geo: ReturnType<typeof buildCityGeometry> }) {
  const { meshes, material } = useMemo(() => {
    const g = treeGeometries();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const meshes = (["round", "cone", "palm"] as const).map((kind) => {
      const list = geo.trees[kind];
      const m = new THREE.InstancedMesh(g[kind], material, Math.max(1, list.length));
      m.count = list.length;
      list.forEach((mat, i) => {
        m.setMatrixAt(i, mat);
        m.setColorAt(i, geo.trees.tints[kind][i]);
      });
      m.castShadow = true;
      m.receiveShadow = false;
      m.computeBoundingSphere();
      return m;
    });
    return { meshes, material };
  }, [geo]);
  useEffect(
    () => () => {
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.dispose();
      });
      material.dispose();
    },
    [meshes, material],
  );
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function Lamps({ matrices }: { matrices: THREE.Matrix4[] }) {
  const mesh = useMemo(() => {
    const b = new MeshBuilder();
    const pole = "#56615f";
    b.cylinder(0, 0, 0, 0.08, 0.06, 5, 6, pole, pole);
    b.box(0, 0.2, 0, 0.28, 0.4, 0.28, pole);
    b.box(0, 5.0, 0.55, 0.07, 0.07, 1.1, pole);
    b.box(0, 4.9, 1.05, 0.34, 0.16, 0.5, [pole, pole, "#fff0c6"]);
    const m = new THREE.InstancedMesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, matrices.length));
    m.count = matrices.length;
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.castShadow = true;
    m.computeBoundingSphere();
    return m;
  }, [matrices]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  // Knocked-over lamps disappear (their pieces fly as debris) until the sim restores them.
  const version = useRef(0);
  useGameFrame(({ g }) => {
    if (g.lampVersion === version.current) return;
    version.current = g.lampVersion;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, g.brokenLamps.has(i) ? HIDDEN : m));
    mesh.instanceMatrix.needsUpdate = true;
  }, FRAME_ORDER.views);
  return <primitive object={mesh} />;
}

/** Card with the logo and name, drawn once into a canvas texture. */
function signTexture(l: Landmark): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (img?: HTMLImageElement) => {
    ctx.fillStyle = "#f7f0e2";
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = "#e3b04b";
    ctx.fillRect(0, 300, 256, 20);
    if (img) {
      const box = 190;
      const s = Math.min(box / img.naturalWidth, (box - 20) / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (256 - w) / 2, 24 + (box - 20 - h) / 2, w, h);
    }
    ctx.fillStyle = "#2b2f36";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = l.name.length > 12 ? 24 : 34;
    ctx.font = `700 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const lines = l.name.length > 16 ? splitName(l.name) : [l.name];
    lines.forEach((line, i) => ctx.fillText(line, 128, (img ? 248 : 150) + i * (size + 4) - ((lines.length - 1) * (size + 4)) / 2, 236));
    tex.needsUpdate = true;
  };
  draw();
  const logo = LOGOS[l.slug];
  if (logo) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => draw(img);
    img.src = logo;
  }
  return tex;
}

function splitName(name: string): string[] {
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

const LOGOS: Record<string, string> = Object.fromEntries([...experience, ...education].map((e) => [e.slug, e.logo]));

function LandmarkSign({ landmark: l }: { landmark: Landmark }) {
  const { tex, board, mat } = useMemo(() => {
    const tex = signTexture(l);
    const board = new THREE.PlaneGeometry(1.5, 1.875);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    return { tex, board, mat };
  }, [l]);
  useEffect(
    () => () => {
      tex.dispose();
      board.dispose();
      mat.dispose();
    },
    [tex, board, mat],
  );
  const nx = l.face === 1 ? 1 : l.face === 3 ? -1 : 0;
  const nz = l.face === 0 ? 1 : l.face === 2 ? -1 : 0;
  const x = l.pad.x - nx * 1.25;
  const z = l.pad.z - nz * 1.25;
  const yaw = Math.atan2(nx, nz);
  return (
    <group position={[x, CURB_HEIGHT, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.55, -0.05]} castShadow>
        <boxGeometry args={[0.14, 1.1, 0.14]} />
        <meshLambertMaterial color="#3e434b" />
      </mesh>
      <mesh position={[0, 2.0, -0.06]} castShadow>
        <boxGeometry args={[1.64, 2.0, 0.1]} />
        <meshLambertMaterial color="#3e434b" />
      </mesh>
      <mesh geometry={board} material={mat} position={[0, 2.0, 0]} />
    </group>
  );
}

/** Soft glowing discs showing exactly where "About …" becomes available. */
function Pads({ landmarks }: { landmarks: Landmark[] }) {
  const { reduced } = useGame();
  const { geometry, materials } = useMemo(() => {
    const geometry = new THREE.CircleGeometry(INSPECT_RADIUS_M, 32);
    geometry.rotateX(-Math.PI / 2);
    const materials = landmarks.map(
      () => new THREE.MeshBasicMaterial({ color: "#ffd675", transparent: true, opacity: 0.18, depthWrite: false, fog: true }),
    );
    return { geometry, materials };
  }, [landmarks]);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );
  const t = useRef(0);
  useGameFrame(({ g, dt }) => {
    t.current += dt;
    const near = g.inspectTarget?.slug;
    landmarks.forEach((l, i) => {
      const m = materials[i];
      const pulse = reduced ? 0 : Math.sin(t.current * 2.2 + i) * 0.06;
      m.opacity = (l.slug === near ? 0.42 : 0.16) + pulse;
    });
  }, FRAME_ORDER.effects);
  return (
    <>
      {landmarks.map((l, i) => (
        <mesh
          key={l.slug}
          geometry={geometry}
          material={materials[i]}
          position={[l.pad.x, CURB_HEIGHT + 0.02, l.pad.z]}
          renderOrder={1}
        />
      ))}
    </>
  );
}

