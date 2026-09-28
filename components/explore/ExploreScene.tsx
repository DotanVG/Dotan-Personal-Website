"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyKey, clearInput, createInput, type InputState } from "@/lib/game/input";
import { BUDGETS, advance, createGame, doorAnchor, getCar, resetGame, snapshot, type Game } from "@/lib/game/sim";
import { trackEvent } from "@/lib/analytics";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { Avatar } from "./Avatar";
import { CameraRig } from "./CameraRig";
import { PauseMenu } from "./Dialogs";
import { createQualityGovernor } from "./quality";
import { Effects } from "./Effects";
import { FRAME_ORDER, GameContext, createFrameBus, useGame, type FrameCtx, type GameContextValue, type Quality } from "./gameContext";
import { Hud, type HudRefs } from "./Hud";
import { InfoPanel } from "./InfoPanel";
import { LoadingScreen } from "./LoadingScreen";
import { TouchControls } from "./TouchControls";
import { COACH_KEY, initialTouchMode, readStorage, touchVisible, useExploreUi, writeStorage } from "./uiStore";
import { Vehicles } from "./Vehicles";
import { FOG_COLOR, World } from "./World";

const CITY_SEED = 7;
const TEST_HOOK = process.env.EXPLORE_TEST_HOOK === "1" || process.env.NODE_ENV === "development";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function initialQuality(): Quality {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.screen.width, window.screen.height) < 820;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  return (coarse && small) || fewCores ? "low" : "high";
}

/** Clean-view URL: same page and query, without the mode switch. */
function cleanUrl(hash = "") {
  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  url.hash = hash;
  return url.pathname + url.search + url.hash;
}

export default function ExploreScene() {
  const [webgl, setWebgl] = useState<"checking" | "ok" | "none">("checking");
  useEffect(() => setWebgl(webglAvailable() ? "ok" : "none"), []);
  if (webgl === "checking") return <LoadingScreen />;
  if (webgl === "none")
    return (
      <Fallback
        title="Explore needs 3D graphics"
        body="This browser or device has WebGL turned off or unavailable, so the driving city can't start. The full portfolio is in the clean view."
      />
    );
  return <ExploreGame />;
}

function Fallback({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="fixed inset-0 z-40 grid place-items-center bg-[#eed9b9] p-6 text-[#1d222b]">
      <div className="max-w-md rounded-2xl bg-[#f7f0e2] p-6 shadow-xl">
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#1d222b]/80">{body}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {onRetry && (
            <button type="button" onClick={onRetry} className="min-h-12 rounded-xl bg-[#1d222b] px-5 font-semibold text-white">
              Retry
            </button>
          )}
          <a href={cleanUrl()} className="inline-flex min-h-12 items-center rounded-xl border border-[#1d222b]/25 px-5 font-semibold">
            Clean view
          </a>
        </div>
      </div>
    </div>
  );
}

class SceneBoundary extends Component<{ onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Explore scene failed", error);
  }
  render() {
    if (this.state.failed)
      return (
        <Fallback
          title="The city hit a snag"
          body="Something went wrong while drawing the 3D scene. You can try again, or read everything in the clean view."
          onRetry={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}
        />
      );
    return this.props.children;
  }
}

// Frame timing for the dev/test hook: ring buffer, no allocations per frame.
const perf = { times: new Float32Array(240), i: 0, n: 0 };
/** Renderer handle for the test hook's render stats. */
const glRef: { current: THREE.WebGLRenderer | null } = { current: null };

/** Runs the fixed-step simulation, then every registered view in order. */
function GameLoop() {
  const { gameRef, input, bus, cam, reduced, pausedRef } = useGame();
  const ctx = useRef<FrameCtx | null>(null);
  useFrame((state, delta) => {
    const g = gameRef.current;
    const paused = pausedRef.current;
    let alpha = 1;
    if (paused) g.accumulator = 0;
    else alpha = advance(g, delta, input, cam.yaw);
    const c = (ctx.current ??= { g, alpha, dt: 0, camera: state.camera as THREE.PerspectiveCamera, events: g.events, reduced, paused });
    c.g = g;
    c.alpha = alpha;
    c.dt = Math.min(delta, 0.1);
    c.camera = state.camera as THREE.PerspectiveCamera;
    c.events = g.events;
    c.reduced = reduced;
    c.paused = paused;
    bus.run(c);
    g.events.length = 0;
    perf.times[perf.i] = delta;
    perf.i = (perf.i + 1) % perf.times.length;
    perf.n = Math.min(perf.n + 1, perf.times.length);
  });
  return null;
}

function GlSetup({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (TEST_HOOK) glRef.current = gl;
    perf.i = perf.n = 0;
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.05;
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => {
      el.removeEventListener("webglcontextlost", lost);
      if (glRef.current === gl) glRef.current = null;
    };
  }, [gl, onLost]);
  return null;
}

function ExploreGame() {
  const reduced = useReducedMotion();
  const [quality, setQuality] = useState<Quality>(() => initialQuality());
  const gameRef = useRef<Game>(null as unknown as Game);
  if (!gameRef.current) gameRef.current = createGame({ seed: CITY_SEED, budget: BUDGETS[quality] });
  const input = useMemo<InputState>(() => createInput(), []);
  const bus = useMemo(() => createFrameBus(), []);
  const cam = useMemo(() => ({ yaw: 0, aimYaw: null as number | null }), []);
  const pausedRef = useRef(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [hidden, setHidden] = useState(false);
  const firstFrames = useRef(0);

  const overlay = useExploreUi((s) => s.overlay);
  const pauseView = useExploreUi((s) => s.pauseView);
  const infoSlug = useExploreUi((s) => s.infoSlug);
  const hud = useExploreUi((s) => s.hud);
  const toast = useExploreUi((s) => s.toast);
  const touchMode = useExploreUi((s) => s.touchMode);
  const sawTouch = useExploreUi((s) => s.sawTouch);
  const coarse = useExploreUi((s) => s.coarse);
  const status = useExploreUi((s) => s.status);
  const coach = useExploreUi((s) => s.coach);
  const showTouch = touchVisible({ touchMode, sawTouch, coarse });

  // The simulation waits while loading; rendering keeps going so loading can finish.
  const simPaused = overlay !== "none" || status !== "ready" || hidden;
  const renderPaused = overlay !== "none" || status === "lost" || hidden;
  pausedRef.current = simPaused;

  const speedRef = useRef<HTMLSpanElement>(null);
  const condBarRef = useRef<HTMLDivElement>(null);
  const condTextRef = useRef<HTMLSpanElement>(null);
  const hudRefs: HudRefs = useMemo(() => ({ speed: speedRef, condBar: condBarRef, condText: condTextRef }), []);

  useEffect(() => {
    gameRef.current.options.budget = BUDGETS[quality];
  }, [quality]);

  // One-time setup and teardown for this visit to Explore.
  useEffect(() => {
    const coarseMq = window.matchMedia("(pointer: coarse)");
    useExploreUi.setState({
      overlay: "none",
      status: "loading",
      touchMode: initialTouchMode(),
      coarse: coarseMq.matches,
      coach: readStorage(COACH_KEY) !== "1",
      toast: null,
    });
    const onCoarse = () => useExploreUi.setState({ coarse: coarseMq.matches });
    coarseMq.addEventListener("change", onCoarse);
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !useExploreUi.getState().sawTouch) useExploreUi.setState({ sawTouch: true });
    };
    window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    trackEvent("explore_enter");
    return () => {
      coarseMq.removeEventListener("change", onCoarse);
      window.removeEventListener("pointerdown", onPointer, { capture: true });
      clearInput(input);
      useExploreUi.setState({ overlay: "none", status: "loading", toast: null });
    };
  }, [input]);

  // Keyboard, focus loss and tab visibility.
  useEffect(() => {
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    const onKeyDown = (e: KeyboardEvent) => {
      // macOS drops keyup for keys released while Cmd is held: let go of everything.
      if (e.key === "Meta") input.keys.clear();
      if (e.defaultPrevented || editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const ui = useExploreUi.getState();
      if (e.key === "Escape") {
        if (ui.overlay === "none") {
          e.preventDefault();
          ui.openPause();
        }
        return;
      }
      // E toggles the landmark panel it opened.
      if (ui.overlay === "info" && e.code === "KeyE" && !e.repeat) {
        e.preventDefault();
        ui.close();
        return;
      }
      if (ui.overlay !== "none" || ui.status !== "ready") return;
      if (applyKey(input, e.code, true, e.repeat)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") input.keys.clear();
      applyKey(input, e.code, false);
    };
    const onBlur = () => clearInput(input);
    const onVisibility = () => {
      if (document.hidden) {
        clearInput(input);
        pausedRef.current = true; // immediately, not on the next render
      }
      setHidden(document.hidden);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [input]);

  // Overlays take the input: nothing stays held underneath them.
  useEffect(() => {
    if (overlay !== "none") clearInput(input);
  }, [overlay, input]);

  // HUD sync: discrete fields through the store (only on change), numbers straight to the DOM.
  useEffect(() => {
    let lastSpeed = -1;
    let lastCond = -1;
    let lastToast = -1;
    let speedEl: HTMLElement | null = null;
    return bus.add(FRAME_ORDER.hud, ({ g, events }) => {
      const ui = useExploreUi.getState();
      if (ui.status === "loading" && ++firstFrames.current > 2) ui.setStatus("ready");
      const h = g.hud;
      const cur = ui.hud;
      if (
        cur.state !== h.state ||
        cur.context !== h.context ||
        cur.contextLabel !== h.contextLabel ||
        cur.suggestUnstuck !== h.suggestUnstuck ||
        cur.wrecked !== h.wrecked ||
        cur.vehicle !== h.vehicle ||
        cur.nearLandmark !== h.nearLandmark
      ) {
        ui.setHud({
          state: h.state,
          context: h.context,
          contextLabel: h.contextLabel,
          suggestUnstuck: h.suggestUnstuck,
          wrecked: h.wrecked,
          vehicle: h.vehicle,
          nearLandmark: h.nearLandmark,
        });
      }
      // The readout remounts each time we get in a car: force a fresh write then.
      if (speedRef.current !== speedEl) {
        speedEl = speedRef.current;
        lastSpeed = lastCond = -1;
      }
      const speed = Math.round(h.speedKmh);
      if (speed !== lastSpeed && speedRef.current) {
        lastSpeed = speed;
        speedRef.current.textContent = String(speed);
      }
      const cond = Math.round(h.condition);
      if (cond !== lastCond && condBarRef.current && condTextRef.current) {
        lastCond = cond;
        condBarRef.current.style.width = `${Math.max(2, cond)}%`;
        condBarRef.current.style.backgroundColor = cond > 55 ? "#8fd18a" : cond > 25 ? "#f2c35b" : "#e0614b";
        condTextRef.current.textContent = `${cond}%`;
      }
      if (g.toast.id !== lastToast) {
        lastToast = g.toast.id;
        ui.setToast(g.toast.text ? { text: g.toast.text, id: g.toast.id } : null);
      } else if (ui.toast && g.time > g.toast.until) ui.setToast(null);
      for (const e of events) {
        if (e.type === "inspect") {
          ui.openInfo(e.slug);
          trackEvent("marker_open", { slug: e.slug });
        } else if (e.type === "enter" && ui.coach) {
          ui.setCoach(false);
          writeStorage(COACH_KEY, "1");
        }
      }
    });
  }, [bus]);

  // Quality governor: only live, unpaused frames count.
  const governor = useMemo(() => createQualityGovernor(quality), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      bus.add(FRAME_ORDER.hud + 1, ({ dt, paused }) => {
        if (paused) return governor.pause();
        const next = governor.frame(dt);
        if (next) setQuality(next);
      }),
    [bus, governor],
  );

  // Test/dev hook: read-only snapshots plus camera aiming for scripted walks.
  useEffect(() => {
    if (!TEST_HOOK) return;
    const w = window as unknown as Record<string, unknown>;
    w.__explore = {
      snapshot: () => snapshot(gameRef.current),
      aimCamera: (x: number, z: number) => {
        const p = gameRef.current.player;
        cam.aimYaw = Math.atan2(x - p.x, z - p.z);
      },
      perf: () => {
        const n = perf.n;
        if (!n) return null;
        const arr = Array.from(perf.times.slice(0, n)).sort((a, b) => a - b);
        const mean = arr.reduce((s, v) => s + v, 0) / n;
        return { frames: n, fps: 1 / mean, p95ms: arr[Math.floor(n * 0.95)] * 1000 };
      },
      /** Door anchor of a car on the side nearest the player (for scripted walks). */
      doorOf: (id: number) => {
        const g = gameRef.current;
        const car = getCar(g, id);
        if (!car) return null;
        const a = doorAnchor(car, 1, { x: 0, z: 0 });
        const b = doorAnchor(car, -1, { x: 0, z: 0 });
        const p = g.player;
        return Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b;
      },
      quality: () => quality,
      renderInfo: () => {
        const gl = glRef.current;
        if (!gl) return null;
        const { calls, triangles } = gl.info.render;
        const { geometries, textures } = gl.info.memory;
        return { calls, triangles, geometries, textures, programs: gl.info.programs?.length ?? 0, dpr: gl.getPixelRatio() };
      },
      input: () => ({ keys: [...input.keys], touch: { ...input.touch } }),
      viewer: () => ({ ...gameRef.current.viewer }),
      /** Photo-tour setup only: stand the player somewhere (on foot). */
      placePlayer: (x: number, z: number, facing: number) => {
        const p = gameRef.current.player;
        if (p.state !== "onFoot") return false;
        p.x = p.px = x;
        p.z = p.pz = z;
        p.facing = p.pfacing = facing;
        cam.aimYaw = facing;
        return true;
      },
    };
    return () => {
      delete w.__explore;
    };
  }, [cam, input, quality]);

  const ctxValue: GameContextValue = useMemo(
    () => ({ gameRef, input, bus, cam, quality, reduced, pausedRef }),
    [input, bus, cam, quality, reduced],
  );

  const goClean = useCallback(() => window.location.assign(cleanUrl()), []);
  const goContact = useCallback(() => window.location.assign(cleanUrl("#contact")), []);
  const close = useExploreUi((s) => s.close);
  const onLost = useCallback(() => useExploreUi.getState().setStatus("lost"), []);
  const retryCanvas = useCallback(() => {
    firstFrames.current = 0;
    useExploreUi.getState().setStatus("loading");
    setCanvasKey((k) => k + 1);
  }, []);
  const dismissCoach = useCallback(() => {
    useExploreUi.getState().setCoach(false);
    writeStorage(COACH_KEY, "1");
  }, []);

  return (
    <GameContext.Provider value={ctxValue}>
      <div className="fixed inset-0 z-10 h-dvh w-full touch-none select-none overflow-hidden" style={{ backgroundColor: FOG_COLOR }} data-explore>
        <SceneBoundary key={`b${canvasKey}`} onRetry={retryCanvas}>
          <Canvas
            key={canvasKey}
            shadows="percentage"
            dpr={quality === "high" ? [1, 1.75] : quality === "low" ? [1, 1.25] : 1}
            gl={{ antialias: quality === "high", powerPreference: "high-performance", stencil: false }}
            camera={{ fov: 58, near: 0.3, far: 1000, position: [0, 6, 20] }}
            frameloop={renderPaused ? "demand" : "always"}
            aria-label="Explore mode: a small city you can walk and drive around"
          >
            <GlSetup onLost={onLost} />
            <GameLoop />
            <World city={gameRef.current.city} />
            <Vehicles />
            <Avatar />
            <Effects />
            <CameraRig />
          </Canvas>
        </SceneBoundary>

        <LookLayer input={input} />
        {showTouch && status === "ready" && (
          <TouchControls
            input={input}
            hud={hud}
            onUnstuck={() => {
              input.unstuckQueued = true;
            }}
          />
        )}
        <Hud
          hud={hud}
          touch={showTouch}
          refs={hudRefs}
          toast={toast?.text ?? null}
          coach={coach && status === "ready"}
          onPause={() => useExploreUi.getState().openPause()}
          onClean={goClean}
          onContact={goContact}
          onDismissCoach={dismissCoach}
        />
        {status === "loading" && <LoadingScreen />}
        {status === "lost" && (
          <Fallback
            title="Graphics were interrupted"
            body="The browser reset the 3D graphics (this can happen after switching apps or on low memory). Your city is still here."
            onRetry={retryCanvas}
          />
        )}
        <PauseMenu
          open={overlay === "pause"}
          view={pauseView}
          driving={hud.state === "driving"}
          touchMode={touchMode}
          reduced={reduced}
          onResume={close}
          onView={(v) => useExploreUi.setState({ pauseView: v })}
          onUnstuck={() => {
            input.unstuckQueued = true;
            close();
          }}
          onRestart={() => {
            resetGame(gameRef.current);
            clearInput(input);
            close();
          }}
          onTouchMode={(m) => useExploreUi.getState().setTouchMode(m)}
          onClean={goClean}
          onContact={goContact}
        />
        <InfoPanel open={overlay === "info"} slug={infoSlug} onClose={close} />
      </div>
    </GameContext.Provider>
  );
}

/** Drag anywhere on the scenery to look around (mouse or a spare finger). */
function LookLayer({ input }: { input: InputState }) {
  const ptr = useRef<{ id: number; x: number; y: number } | null>(null);
  const release = (e: React.PointerEvent) => {
    if (ptr.current?.id === e.pointerId) ptr.current = null;
  };
  return (
    <div
      className="absolute inset-0 z-10 touch-none"
      data-look-layer
      onPointerDown={(e) => {
        if (ptr.current) return;
        if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        ptr.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const p = ptr.current;
        if (!p || p.id !== e.pointerId) return;
        input.lookDX += e.clientX - p.x;
        input.lookDY += e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
