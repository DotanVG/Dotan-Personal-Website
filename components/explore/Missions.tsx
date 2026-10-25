"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createCity, CURB_HEIGHT, MONUMENT_SPOT, type City } from "@/lib/game/city";
import { damp } from "@/lib/game/math";
import { checklist, chipModel, liveProjectCount, missionBrief, type MissionTarget, type RewardCopy } from "@/lib/game/missions";
import { HelpContent, Modal } from "./Dialogs";
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

/** Quest chip. Opens the mission panel. Guidance itself is the screen marker, not this button. */
export function MissionChip({ driving }: { driving: boolean }) {
  const missions = useExploreUi((s) => s.missions);
  const aim = useExploreUi((s) => s.aim);
  const narrow = useNarrowChip();
  const model = chipModel(missions, { projectCount: liveProjectCount(), driving, targetName: aim?.name ?? null });
  if (!model) return null;
  return (
    <button
      type="button"
      data-testid="mission-chip"
      aria-label={model.live}
      onClick={() => useExploreUi.getState().setBrief(true)}
      className="pointer-events-auto flex min-h-11 max-w-[min(22rem,calc(100vw-1.5rem))] items-center rounded-full border border-white/25 bg-[#1d222b]/75 px-3.5 text-sm font-medium text-white shadow-md backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#facc15] [@media(max-height:500px)]:max-w-[min(13rem,calc(100vw-18rem))]"
    >
      <span className="truncate">{narrow ? model.compact : model.long}</span>
    </button>
  );
}

const _v = new THREE.Vector3();

/** Screen marker. Called from the HUD frame. Positions a DOM node; no React state. */
export function updateGuideMarker(camera: THREE.PerspectiveCamera, target: MissionTarget | null, player: { x: number; z: number }) {
  const el = missionRefs.marker;
  if (!el) return;
  const label = missionRefs.markerLabel;
  const arrow = missionRefs.markerArrow;
  const distEl = missionRefs.panelDist;
  if (!target) {
    el.style.display = "none";
    return;
  }
  const host = el.offsetParent instanceof HTMLElement ? el.offsetParent : el.parentElement;
  const w = host?.clientWidth || window.innerWidth;
  const h = host?.clientHeight || window.innerHeight;
  const dist = Math.max(0, Math.round(Math.hypot(target.x - player.x, target.z - player.z)));
  const meters = `${dist} m`;
  if (label && label.textContent !== `${target.name} · ${meters}`) label.textContent = `${target.name} · ${meters}`;
  if (distEl && distEl.textContent !== meters) distEl.textContent = meters;

  camera.updateWorldMatrix(true, false);
  _v.set(target.x, CURB_HEIGHT + (target.slug === "car" ? 1.8 : 3.4), target.z);
  _v.applyMatrix4(camera.matrixWorldInverse);
  const behind = _v.z > 0;
  _v.applyMatrix4(camera.projectionMatrix);
  let sx = (_v.x * 0.5 + 0.5) * w;
  let sy = (-_v.y * 0.5 + 0.5) * h;
  if (behind) {
    sx = w - sx;
    sy = h - sy;
  }
  const top = 76;
  const bottom = Math.min(140, h * 0.22);
  const side = 12;
  const onScreen = !behind && sx >= side && sx <= w - side && sy >= top && sy <= h - bottom;
  el.style.display = "flex";
  if (onScreen) {
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.transform = "translate(-50%, -120%)";
    if (arrow) arrow.style.opacity = "0";
    return;
  }
  const cx = w / 2;
  const cy = h / 2;
  let dx = sx - cx;
  let dy = sy - cy;
  if (Math.hypot(dx, dy) < 8) {
    dx = 0;
    dy = -1;
  }
  const maxX = w / 2 - side;
  const maxYTop = cy - top;
  const maxYBottom = h - bottom - cy;
  const ang = Math.atan2(dy, dx);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const limY = sin < 0 ? maxYTop : maxYBottom;
  const scale = Math.min(maxX / Math.max(0.001, Math.abs(cos)), limY / Math.max(0.001, Math.abs(sin)));
  el.style.left = `${cx + cos * scale}px`;
  el.style.top = `${cy + sin * scale}px`;
  el.style.transform = "translate(-50%, -50%)";
  if (arrow) {
    arrow.style.opacity = "1";
    arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
  }
}

export function GuideMarker() {
  return (
    <div
      ref={(el) => {
        missionRefs.marker = el;
      }}
      data-testid="mission-marker"
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 hidden max-w-[11rem] items-center gap-1.5 rounded-full border border-[#f2cf7e]/70 bg-[#1d222b]/85 py-1 pl-1.5 pr-2.5 text-xs font-semibold text-white shadow-md"
    >
      <span
        ref={(el) => {
          missionRefs.markerArrow = el;
        }}
        className="grid size-6 shrink-0 place-items-center"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.2 L12 12 H2 Z" fill="#f2cf7e" />
        </svg>
      </span>
      <span
        ref={(el) => {
          missionRefs.markerLabel = el;
        }}
        className="truncate"
      />
    </div>
  );
}

export function MissionBrief({ driving }: { driving: boolean }) {
  const open = useExploreUi((s) => s.brief);
  const missions = useExploreUi((s) => s.missions);
  const aim = useExploreUi((s) => s.aim);
  const ref = useRef<HTMLDialogElement>(null);
  const [help, setHelp] = useState(false);
  const landmarks = useMemo(() => createCity(7).landmarks, []);
  const brief = missionBrief(missions, { projectCount: liveProjectCount(), driving });
  const items = checklist(missions, landmarks, liveProjectCount());
  const show = open && !!brief;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show && !d.open) {
      d.show();
      d.focus();
    }
    if (!show && d.open) d.close();
  }, [show]);
  if (!brief) return null;
  const close = () => useExploreUi.getState().setBrief(false);
  return (
    <dialog
      ref={ref}
      aria-labelledby="mission-brief-title"
      aria-modal="false"
      data-testid="mission-brief"
      tabIndex={-1}
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="pointer-events-auto fixed left-1/2 top-[calc(max(10px,env(safe-area-inset-top))+104px)] z-40 m-0 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70dvh,26rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[#1d222b]/15 bg-[#f7f0e2] p-0 text-[#1d222b] shadow-2xl"
    >
      <div className="p-3.5">
        <h2 id="mission-brief-title" className="font-display text-lg font-semibold">
          {brief.title}
        </h2>
        <p className="mt-1 text-sm leading-snug text-[#1d222b]/85">{brief.what}</p>
        <p className="mt-2 text-sm font-medium">
          {aim?.name ?? "Next stop"} ·{" "}
          <span
            ref={(el) => {
              missionRefs.panelDist = el;
            }}
          >
            —
          </span>
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#b3402c]">Progress {brief.progress}</p>
        <ul className="mt-1 grid grid-cols-2 gap-x-2">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-7 items-center gap-1.5 text-xs">
              <span aria-hidden className={item.checked ? "text-[#2f7d4a]" : "text-[#1d222b]/35"}>
                {item.checked ? "✓" : "○"}
              </span>
              <span className={item.checked ? "" : "text-[#1d222b]/70"}>{item.label}</span>
              <span className="sr-only">{item.checked ? ", read" : ", not read"}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 min-h-11 text-sm font-semibold underline underline-offset-4"
          aria-expanded={help}
          onClick={() => setHelp((v) => !v)}
        >
          {help ? "Hide controls" : "Controls"}
        </button>
        {help && <HelpContent />}
        <button
          type="button"
          onClick={close}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1d222b] px-4 text-[15px] font-semibold text-white"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

export function RewardDialog({ onContact }: { onContact: () => void }) {
  const reward = useExploreUi((s) => s.reward);
  const close = () => useExploreUi.getState().dismissReward();
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
    mat.opacity = reduced ? 0.55 : 0.42 + Math.sin(performance.now() / 280) * 0.12;
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
