"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CURB_HEIGHT, MONUMENT_SPOT, type City } from "@/lib/game/city";
import { damp } from "@/lib/game/math";
import { chipModel, liveProjectCount, type RewardCopy } from "@/lib/game/missions";
import { Modal } from "./Dialogs";
import { FRAME_ORDER, useGame, useGameFrame } from "./gameContext";
import { bannerGeometry, beamModel, pillarModel, statueModel } from "./monument";
import { missionRefs, useExploreUi } from "./uiStore";

const LAMP_Y = CURB_HEIGHT + 14.5;

function useNarrowChip() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 420px), (max-height: 500px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

/** Quest chip. The arrow is rotated from the frame loop, so this does not re-render every frame. */
export function MissionChip({ driving }: { driving: boolean }) {
  const missions = useExploreUi((s) => s.missions);
  const aim = useExploreUi((s) => s.aim);
  const narrow = useNarrowChip();
  const model = chipModel(missions, { projectCount: liveProjectCount(), driving, targetName: aim?.name ?? null });
  if (!model) return null;
  return (
    <div
      data-testid="mission-chip"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={model.live}
      className="pointer-events-none flex min-h-11 max-w-[min(22rem,calc(100vw-1.5rem))] items-center gap-2 rounded-full border border-white/25 bg-[#1d222b]/75 py-1 pl-3.5 pr-1.5 text-sm font-medium text-white shadow-md backdrop-blur-sm [@media(max-height:500px)]:max-w-[min(13rem,calc(100vw-18rem))]"
    >
      <span aria-hidden className="truncate">
        {narrow ? model.compact : model.long}
      </span>
      <span
        ref={(el) => {
          missionRefs.arrow = el;
        }}
        aria-hidden
        className="grid size-9 shrink-0 place-items-center"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2.5 L14.5 14.5 H3.5 Z" fill="#f2cf7e" />
        </svg>
      </span>
    </div>
  );
}

export function RewardDialog({ onContact }: { onContact: () => void }) {
  const reward = useExploreUi((s) => s.reward);
  const close = () => useExploreUi.getState().setReward(null);
  return (
    <Modal open={reward !== null} onClose={close} labelledBy="reward-title">
      {reward && <RewardBody reward={reward} onClose={close} onContact={onContact} />}
    </Modal>
  );
}

function RewardBody({ reward, onClose, onContact }: { reward: RewardCopy; onClose: () => void; onContact: () => void }) {
  return (
    <div className="p-5 sm:p-6" data-testid="mission-reward">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#b3402c]">Mission complete</p>
      <h2 id="reward-title" className="mt-1 font-display text-xl font-semibold">
        {reward.title}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#1d222b]/85">{reward.body}</p>
      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1d222b] px-4 text-[15px] font-semibold text-white hover:bg-[#2c333f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3402c]"
      >
        Keep exploring
      </button>
      {reward.sayHi && (
        <a
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            onContact();
          }}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[#1d222b]/75 underline underline-offset-4 hover:text-[#1d222b]"
        >
          Say hi
        </a>
      )}
    </div>
  );
}

function dispose(geo: THREE.BufferGeometry | null, mat: THREE.Material) {
  geo?.dispose();
  mat.dispose();
}

function Charter({ animate }: { animate: boolean }) {
  const { reduced } = useGame();
  const geo = useMemo(() => statueModel(), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const ref = useRef<THREE.Group>(null);
  const shown = useRef(animate && !reduced ? 0 : 1);
  useEffect(() => () => dispose(geo, mat), [geo, mat]);
  useGameFrame(({ dt, reduced: r }) => {
    shown.current = r ? 1 : damp(shown.current, 1, 2.2, dt);
    const g = ref.current;
    if (!g) return;
    g.visible = shown.current > 0.02;
    g.position.y = CURB_HEIGHT + (shown.current - 1) * 2.4;
  }, FRAME_ORDER.views);
  return (
    <group ref={ref} position={[MONUMENT_SPOT.x, CURB_HEIGHT, MONUMENT_SPOT.z]}>
      <mesh geometry={geo} material={mat} castShadow />
    </group>
  );
}

function Banners({ city, visited }: { city: City; visited: string[] }) {
  const geo = useMemo(() => {
    const spots = city.landmarks
      .filter((l) => visited.includes(l.slug))
      .map((l) => ({ x: l.x, z: l.z, y: CURB_HEIGHT + l.h, face: l.face }));
    return bannerGeometry(spots);
  }, [city, visited]);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(() => () => dispose(geo, mat), [geo, mat]);
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} castShadow />;
}

function LighthouseBeam({ city }: { city: City }) {
  const naval = city.landmarks.find((l) => l.slug === "naval");
  const geo = useMemo(() => beamModel(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fff1c2",
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const spin = useRef<THREE.Group>(null);
  useEffect(() => () => dispose(geo, mat), [geo, mat]);
  useGameFrame(({ dt, reduced }) => {
    if (spin.current && !reduced) spin.current.rotation.y += dt * 0.35;
  }, FRAME_ORDER.effects);
  if (!naval) return null;
  return (
    <group ref={spin} position={[naval.x, LAMP_Y, naval.z]}>
      <mesh geometry={geo} material={mat} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function Pillar() {
  const geo = useMemo(() => pillarModel(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffe7a8",
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => () => dispose(geo, mat), [geo, mat]);
  useGameFrame(({ reduced }) => {
    const mesh = ref.current;
    const aim = missionRefs.pillar;
    if (!mesh) return;
    if (!aim || aim.near) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.set(aim.x, CURB_HEIGHT, aim.z);
    mat.opacity = reduced ? 0.4 : 0.26 + Math.sin(performance.now() / 280) * 0.1;
  }, FRAME_ORDER.hud + 1);
  return <mesh ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

/** Monument, banners, lighthouse beam and the guide pillar. Explore chunk only. */
export function MissionScenery({ city }: { city: City }) {
  const revealed = useExploreUi((s) => s.revealed);
  const visited = useExploreUi((s) => s.missions.visited);
  const epoch = useExploreUi((s) => s.epoch);
  const born = useRef<{ epoch: number; ids: Set<string> } | null>(null);
  if (!born.current || born.current.epoch !== epoch) {
    born.current = { epoch, ids: new Set(useExploreUi.getState().revealed) };
  }
  const charter = revealed.includes("read-city");
  return (
    <>
      <Pillar />
      {charter && <Charter animate={!born.current.ids.has("read-city")} />}
      {charter && <Banners city={city} visited={visited} />}
      {revealed.includes("coast-run") && <LighthouseBeam city={city} />}
    </>
  );
}
