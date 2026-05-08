"use client";

import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import Link from "next/link";
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
  const expMarkers: MarkerData[] = experience.map((e, i) => ({
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
    index: i,
  }));
  const eduMarkers: MarkerData[] = education.map((e, i) => ({
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
    index: i + expMarkers.length,
  }));
  return [...expMarkers, ...eduMarkers];
}

export default function ExploreScene() {
  const isMobile = useIsMobile();
  const activeMarker = useApp((s) => s.activeMarker);
  const setActiveMarker = useApp((s) => s.setActiveMarker);
  const setMode = useApp((s) => s.setMode);
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
            onClick={() => {
              setMode("clean");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("mode");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className="rounded-full border border-white/15 bg-black/45 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur hover:bg-black/60"
          >
            ← Clean view
          </button>
          <Link
            href="#contact"
            scroll
            onClick={() => {
              setMode("clean");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("mode");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className="rounded-full border border-yellow-300/30 bg-yellow-300/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-yellow-100 backdrop-blur hover:bg-yellow-300/25"
          >
            Mailbox →
          </Link>
        </div>
      </div>

      {isMobile && <MobileJoystick />}
      {active && <InfoPanel marker={active} onClose={() => setActiveMarker(null)} />}
    </div>
  );
}
