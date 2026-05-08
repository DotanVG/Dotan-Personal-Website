"use client";

import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { World } from "./World";
import { Player } from "./Player";
import { PlayerControls } from "./PlayerControls";
import { CameraRig } from "./CameraRig";
import { LocationMarker, type MarkerData } from "./LocationMarker";
import { InfoPanel } from "./InfoPanel";
import { LoadingScreen } from "./LoadingScreen";
import { MobileJoystick } from "./MobileJoystick";
import { Instructions } from "./Instructions";
import { experience } from "@/content/experience";
import { education } from "@/content/education";
import { useApp } from "@/lib/store";
import { useIsMobile } from "@/lib/useIsMobile";
import { resetExplore } from "@/lib/explore";
import { trackEvent } from "@/lib/analytics";

function buildMarkers(): MarkerData[] {
  const expMarkers: MarkerData[] = experience.map((e) => ({
    slug: e.slug,
    title: e.role,
    subtitle: e.company,
    start: e.start,
    end: e.end,
    current: e.current,
    logo: e.logo,
    blurb: e.blurb,
    bullets: e.bullets,
    building: e.exploreBuilding ?? "block",
    position: e.position,
  }));
  const eduMarkers: MarkerData[] = education.map((e) => ({
    slug: e.slug,
    title: e.degree,
    subtitle: e.school,
    start: e.start,
    end: e.end,
    logo: e.logo,
    blurb: e.blurb,
    bullets: e.bullets,
    building: e.exploreBuilding ?? "block",
    position: e.position,
  }));
  const all = [...expMarkers, ...eduMarkers];
  all.sort((a, b) => {
    const sa = parseInt(a.start);
    const sb = parseInt(b.start);
    if (sa !== sb) return sa - sb;
    const ea = a.end === "Present" ? 9999 : parseInt(a.end);
    const eb = b.end === "Present" ? 9999 : parseInt(b.end);
    return ea - eb;
  });
  return all;
}

export default function ExploreScene() {
  const isMobile = useIsMobile();
  const activeMarker = useApp((s) => s.activeMarker);
  const setActiveMarker = useApp((s) => s.setActiveMarker);
  const [dprFactor, setDprFactor] = useState(1);
  const markers = buildMarkers();
  const active = activeMarker
    ? markers.find((m) => m.slug === activeMarker) ?? null
    : null;

  useEffect(() => {
    resetExplore();
    setActiveMarker(null);
    trackEvent("explore_enter");

    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((k === "e" || k === "escape") && useApp.getState().activeMarker) {
        setActiveMarker(null);
        trackEvent("marker_close", { via: "keyboard" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveMarker]);

  return (
    <div className="fixed inset-0 z-10 bg-canvas-inset">
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          dpr={[1, isMobile ? 1.4 : 1.8]}
          camera={{ position: [0, 6, 14], fov: isMobile ? 65 : 55, near: 0.1, far: 200 }}
          gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
        >
          <PerformanceMonitor onIncline={() => setDprFactor(1)} onDecline={() => setDprFactor(0.7)} />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <World />
          <Player />
          <PlayerControls />
          <CameraRig />
          {markers.map((m) => (
            <LocationMarker
              key={m.slug}
              data={m}
              active={activeMarker === m.slug}
              onActivate={() => {
                if (useApp.getState().activeMarker !== m.slug) {
                  setActiveMarker(m.slug);
                  trackEvent("marker_open", { slug: m.slug });
                }
              }}
              onDeactivate={() => {
                if (useApp.getState().activeMarker === m.slug) setActiveMarker(null);
              }}
            />
          ))}
          <fog attach="fog" args={["#0f172a", 30 * dprFactor + 30, 110]} />
        </Canvas>
      </Suspense>

      <Instructions />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between p-4">
        <div className="pointer-events-auto rounded-full border border-white/15 bg-black/45 px-4 py-2 backdrop-blur">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
            Explore mode
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="rounded-full border border-white/15 bg-black/45 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur hover:bg-black/60"
          >
            ← Clean view
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/#contact")}
            className="rounded-full border border-yellow-300/30 bg-yellow-300/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-yellow-100 backdrop-blur hover:bg-yellow-300/25"
          >
            Contact me →
          </button>
        </div>
      </div>

      {isMobile && <MobileJoystick />}
      {active && <InfoPanel marker={active} onClose={() => setActiveMarker(null)} />}
    </div>
  );
}
